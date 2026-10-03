import json
import re
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.calendar_event import CalendarEvent
from app.models.homework import Homework
from app.models.user import User

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)

WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

VOICE_HOMEWORK_PROMPT_TEMPLATE = """Ein Schüler hat eine Hausaufgabe eingesprochen, hier die Transkription:
"{transcript}"

Heutiges Datum: {today} ({weekday})

Deine einzige Aufgabe ist es, diese Transkription in Felder aufzuteilen - du erfindest nichts
Neues, du gibst nur in anderer Form wieder, was dort wortwörtlich steht. Der "title" muss aus
Wörtern bestehen, die tatsächlich in der Transkription vorkommen (z.B. das genannte Fach und
die genannte Aufgabe) - niemals ein Thema, das dort nicht erwähnt wird.

Fasse den Titel so kurz wie möglich mit gängigen Abkürzungen: "Seite" -> "S.", eine genannte
Aufgaben-/Nummer wird mit Schrägstrich angehängt (z.B. "Seite 23, Aufgabe/Nummer 4" -> "S. 23/4").

Fristangaben (z.B. "bis morgen", "bis nächste Stunde", "bis Montag") gehören AUSSCHLIESSLICH in
die Felder "due_date_guess"/"due_next_lesson" - nimm sie NIEMALS zusätzlich in "title" oder
"description" auf, das wäre eine doppelte Nennung.

Antworte NUR mit einem JSON-Objekt, ohne weitere Erklärung, in exakt diesem Format:
{{"subject_guess": "<im Transkript genanntes Schulfach oder null>", "title": "<kurzer, abgekürzter Titel ohne Fristangabe>", "description": "<weitere Details aus der Transkription ohne Fristangabe, oder null>", "due_date_guess": "<Datum im Format JJJJ-MM-TT falls ein konkretes Datum/Tag erkennbar ist (auch aus relativen Angaben wie \\"morgen\\" oder \\"nächsten Montag\\" ausgehend vom heutigen Datum), sonst null>", "due_next_lesson": <true, wenn die Frist "bis zur nächsten [Fach-]Stunde" ist (die genaue Zeit kommt dann aus dem Stundenplan, nicht von dir) - sonst false>}}

due_date_guess ist entweder null oder GENAU eine Zeichenkette im Format JJJJ-MM-TT (zehn Zeichen,
z.B. "2026-10-04") - niemals in spitzen Klammern, niemals mit zusätzlichem Text drumherum.

Beispiele (angenommen heute wäre der 2026-10-03, ein Samstag):
Transkript "Mathe, Seite 42 Aufgabe 3, bis morgen" -> {{"subject_guess": "Mathematik", "title": "S. 42/3", "description": null, "due_date_guess": "2026-10-04", "due_next_lesson": false}}
Transkript "Mathe aus Aufgabe Seite 23 Nummer 4 bis nächste Stunde" -> {{"subject_guess": "Mathematik", "title": "S. 23/4", "description": null, "due_date_guess": null, "due_next_lesson": true}}

Bekannte Fächer dieser Klasse (bevorzuge diese, falls passend): {subjects}
"""

TONE_INSTRUCTIONS = {
    "locker": "Locker, freundlich, wie ein entspannter älterer Freund. Kein Alarmismus, kein erhobener Zeigefinger.",
    "streng": "Direkt und bestimmt, wie ein disziplinierter Trainer. Klar sagen, was ansteht, ohne unhöflich zu werden.",
}

# Shared across every student-facing prompt: this app has no teacher role - homework is
# entered by classmates (often the class admin, who is also just a student) for the whole
# class to share, never "assigned" by a named person. Without this, models default to
# generic "homework" framing and invent a teacher-like assigner, which is simply wrong here
# and was surfacing as a hallucinated name in the dashboard summary.
NO_ASSIGNER_INSTRUCTION = (
    "Es gibt in dieser App keine Lehrkraft und keine Person, die Hausaufgaben \"aufgibt\" oder "
    "\"zuweist\" - Mitschüler tragen sie nur für die ganze Klasse ein. Erwähne NIEMALS einen "
    "Namen oder eine Person im Zusammenhang mit einer Hausaufgabe (nicht einmal vage wie \"dein "
    "Lehrer\" oder \"diejenige Person\") - sprich ausschließlich über Fach, Aufgabe und Frist."
)

SUMMARY_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Fasse in maximal 2 kurzen Sätzen (unter 35 Wörtern) zusammen, was an Hausaufgaben ansteht.
Nutze AUSSCHLIESSLICH die unten gelisteten Hausaufgaben - erfinde keine zusätzlichen Fächer,
Aufgaben, Zahlen oder Fristen, die dort nicht stehen. Wenn die Liste leer ist, sag das auch so.
""" + NO_ASSIGNER_INSTRUCTION + """
Auf Deutsch, ein entspannter Hinweis, kein Alarm.

Offene Hausaufgaben von {name}:
{items}
"""

EMAIL_REMINDER_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Schreibe eine kurze, freundliche E-Mail (max. 80 Wörter) an {name}. Erinnere unaufdringlich
daran, dass die folgende Hausaufgabe noch nicht als erledigt markiert ist und bald fällig ist.
Nutze AUSSCHLIESSLICH die folgenden Fakten - erfinde keine zusätzlichen Details, Fristen oder
Aufgaben, die dort nicht stehen.
""" + NO_ASSIGNER_INSTRUCTION + """

Fach: {subject}
Aufgabe: {title}
Fällig: {due}

Schreibe NUR den E-Mail-Text selbst (keine Betreffzeile, keine Floskel wie "Sehr geehrte/r"),
mit natürlicher Anrede beim Vornamen, auf Deutsch.
"""

CHAT_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Antworte kurz und konkret auf Deutsch (max. 100 Wörter), basierend NUR auf dem Kontext unten -
erfinde keine Hausaufgaben, Fächer oder Termine, die dort nicht auftauchen.
Wenn die Frage nichts mit Hausaufgaben/Zeitplanung zu tun hat, beantworte sie trotzdem freundlich.
""" + NO_ASSIGNER_INSTRUCTION + """

Offene Hausaufgaben von {name}:
{items}

Kommende Termine:
{events}

Frage von {name}: {question}
"""


def _format_items(items: list[Homework], user_id) -> str:
    if not items:
        return "Keine offenen Hausaufgaben. Alles erledigt!"
    lines = []
    for hw in items:
        done = any(c.user_id == user_id for c in hw.completions)
        if done:
            continue
        remaining = hw.due_at - datetime.utcnow()
        hours_left = max(0, int(remaining.total_seconds() // 3600))
        lines.append(f"- {hw.subject.name}: \"{hw.title}\" (fällig in ca. {hours_left}h)")
    return "\n".join(lines) if lines else "Keine offenen Hausaufgaben. Alles erledigt!"


def _format_events(events: list[CalendarEvent]) -> str:
    if not events:
        return "Keine besonderen Termine hinterlegt."
    lines = [f"- {e.title} am {e.starts_at.strftime('%a %d.%m. %H:%M')}" for e in events[:10]]
    return "\n".join(lines)


async def _call_text_model(
    prompt: str,
    model: str | None = None,
    json_mode: bool = False,
    num_predict: int | None = None,
) -> str | None:
    """Returns None (instead of raising) when Ollama is unreachable, so every
    caller can fall back to something useful instead of a 500.

    json_mode constrains Ollama to emit only JSON (no chatty filler before/after),
    and num_predict caps how many tokens it's allowed to generate - both cut
    response time for short, structured answers like the voice/flashcards extraction."""
    payload: dict = {"model": model or settings.ollama_model, "prompt": prompt, "stream": False}
    if json_mode:
        payload["format"] = "json"
    options: dict = {"temperature": 0}
    if num_predict is not None:
        options["num_predict"] = num_predict
    payload["options"] = options
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=60.0) as client:
        try:
            response = await client.post("/api/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip()
        except httpx.HTTPError:
            return None


def _open_homework_query(db: Session, user: User):
    return (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(
            Homework.school_class_id == user.school_class_id,
            Homework.due_at >= datetime.utcnow() - timedelta(days=1),
        )
        .order_by(Homework.due_at.asc())
        .all()
    )


async def generate_email_reminder(user: User, hw: Homework) -> str:
    """AI-personalized reminder email body for one not-yet-completed homework item.
    Falls back to a plain deterministic text if Ollama is unreachable - the email still
    gets sent, just without the personalized phrasing."""
    prompt = EMAIL_REMINDER_PROMPT_TEMPLATE.format(
        tone=TONE_INSTRUCTIONS.get(user.agent_tone, TONE_INSTRUCTIONS["locker"]),
        name=user.display_name,
        subject=hw.subject.name,
        title=hw.title,
        due=hw.due_at.strftime("%d.%m.%Y %H:%M"),
    )
    result = await _call_text_model(prompt)
    if result:
        return result
    return (
        f"Hallo {user.display_name},\n\n"
        f"kleine Erinnerung: \"{hw.title}\" im Fach {hw.subject.name} ist am "
        f"{hw.due_at.strftime('%d.%m.%Y um %H:%M')} fällig und du hast sie noch nicht als "
        "erledigt markiert.\n\nKein Stress, nur ein Hinweis!"
    )


async def generate_summary_for_user(db: Session, user: User) -> str:
    items = _open_homework_query(db, user)
    prompt = SUMMARY_PROMPT_TEMPLATE.format(
        tone=TONE_INSTRUCTIONS.get(user.agent_tone, TONE_INSTRUCTIONS["locker"]),
        name=user.display_name,
        items=_format_items(items, user.id),
    )
    result = await _call_text_model(prompt)
    return result if result is not None else _format_items(items, user.id)


async def answer_question(db: Session, user: User, question: str) -> str:
    items = _open_homework_query(db, user)
    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.school_class_id == user.school_class_id)
        .order_by(CalendarEvent.starts_at.asc())
        .limit(10)
        .all()
    )
    prompt = CHAT_PROMPT_TEMPLATE.format(
        tone=TONE_INSTRUCTIONS.get(user.agent_tone, TONE_INSTRUCTIONS["locker"]),
        name=user.display_name,
        items=_format_items(items, user.id),
        events=_format_events(events),
        question=question,
    )
    result = await _call_text_model(prompt)
    if result is not None:
        return result
    return (
        "Der KI-Agent (Ollama) ist gerade nicht erreichbar. Hier trotzdem deine offenen "
        f"Hausaufgaben:\n{_format_items(items, user.id)}"
    )


class AgentUnavailableError(Exception):
    pass


_STOPWORDS_DE = {
    "der", "die", "das", "und", "oder", "für", "von", "mit", "auf", "aus", "ist", "sind",
    "ein", "eine", "einen", "einem", "einer", "wir", "ich", "müssen", "muss", "dass", "auch",
}


def _shares_no_words_with(text: str, transcript: str) -> bool:
    """Catches a model inventing an unrelated topic (e.g. transcript about a math exercise,
    title about something else entirely) regardless of which model produced it - a cheap,
    model-agnostic safety net alongside the prompt instructions."""
    text_words = {w for w in re.findall(r"\w{4,}", text.lower())} - _STOPWORDS_DE
    if not text_words:
        return False
    transcript_words = {w for w in re.findall(r"\w{4,}", transcript.lower())} - _STOPWORDS_DE
    return text_words.isdisjoint(transcript_words)


def _numbers_hallucinated(text: str, transcript: str) -> bool:
    """`_shares_no_words_with` alone misses a wrong page/exercise number (e.g. transcript says
    "Seite 33 Nummer 4" but the model writes "S. 42/3") since "Mathe" still overlaps - any
    digit sequence in the text that doesn't appear anywhere in the transcript is invented."""
    text_numbers = set(re.findall(r"\d+", text))
    if not text_numbers:
        return False
    transcript_numbers = set(re.findall(r"\d+", transcript))
    return not text_numbers.issubset(transcript_numbers)


async def extract_homework_from_voice(transcript: str, known_subjects: list[str]) -> dict:
    """Turns a dictated voice note transcript into a homework suggestion - same shape as
    the photo-based extraction (vision_agent.extract_homework_from_image)."""
    today = datetime.utcnow()
    prompt = VOICE_HOMEWORK_PROMPT_TEMPLATE.format(
        transcript=transcript[:2000],
        today=today.strftime("%Y-%m-%d"),
        weekday=WEEKDAYS_DE[today.weekday()],
        subjects=", ".join(known_subjects) or "keine hinterlegt",
    )
    raw = await _call_text_model(
        prompt,
        model=settings.ollama_voice_model,
        json_mode=True,
        num_predict=250,
    )
    if raw is None:
        raise AgentUnavailableError(f"Ollama ({settings.ollama_base_url}) nicht erreichbar")
    match = _JSON_OBJECT.search(raw)
    if not match:
        parsed = {"subject_guess": None, "title": transcript[:200], "description": None, "due_date_guess": None, "due_next_lesson": False}
    else:
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            parsed = {"subject_guess": None, "title": transcript[:200], "description": None, "due_date_guess": None, "due_next_lesson": False}
    parsed.setdefault("title", transcript[:200] or "Hausaufgabe")
    parsed.setdefault("subject_guess", None)
    parsed.setdefault("description", None)
    parsed.setdefault("due_date_guess", None)
    parsed["due_next_lesson"] = bool(parsed.get("due_next_lesson"))

    # The DB column is a strict "JJJJ-MM-TT" (10 chars) - never trust the model to stick to
    # that format (it has, for example, wrapped the date in "<...>" despite instructions not
    # to), or an oversized/malformed value crashes the save with a DB error instead of just
    # being dropped here.
    due_date_guess = parsed.get("due_date_guess")
    if not (isinstance(due_date_guess, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", due_date_guess)):
        parsed["due_date_guess"] = None

    # The model invented a title/description with zero words from the actual transcript, or
    # invented a page/exercise number that was never said - both are telltale hallucinations.
    # Fall back to the transcript itself rather than keep nonsense.
    title = parsed.get("title") or ""
    if _shares_no_words_with(title, transcript) or _numbers_hallucinated(title, transcript):
        parsed["title"] = transcript[:200] or "Hausaufgabe"
    description = parsed.get("description")
    if description and (_shares_no_words_with(description, transcript) or _numbers_hallucinated(description, transcript)):
        parsed["description"] = None

    return parsed
