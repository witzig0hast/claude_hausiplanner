"""Shared fuzzy subject-name resolution, used by both the photo (vision_agent) and voice
(ollama_agent/voice router) homework extraction paths - a model's raw guess ("E", "Mathematik",
"Mathe") rarely matches a class's own subject name exactly, so both paths need the same
forgiving lookup instead of each doing their own (partial, inconsistent) version of it."""

# Common German school subject abbreviations, used only as a fallback when the guess doesn't
# match one of the class's own subjects - so "E" becomes a suggestion ("Englisch") the admin
# can still overrule, never a silent guess the admin can't see was made.
SUBJECT_ABBREVIATIONS = {
    "d": "Deutsch", "e": "Englisch", "m": "Mathematik", "ma": "Mathematik", "mat": "Mathematik",
    "ph": "Physik", "phu": "Physik", "c": "Chemie", "ch": "Chemie", "cu": "Chemie",
    "bio": "Biologie", "b": "Biologie", "g": "Geschichte", "ges": "Geschichte",
    "geo": "Erdkunde", "ek": "Erdkunde", "ku": "Kunst", "mu": "Musik",
    "sp": "Sport", "sm": "Sport", "sw": "Sport", "inf": "Informatik",
    "reli": "Religion", "re": "Religion", "eth": "Ethik", "f": "Französisch",
    "fr": "Französisch", "la": "Latein", "sowi": "Politik", "pug": "Politik",
    "wr": "Wirtschaft/Recht", "span": "Spanisch", "spa": "Spanisch",
}


def resolve_subject_name(raw: str, known_subjects: list[str]) -> str:
    """Turn a model's (possibly abbreviated, possibly longer-than-actual, e.g. "Mathematik"
    vs. the class's own "Mathe") subject guess into one of the class's own subject names when
    there's a reasonable match - preferring that over the generic abbreviation table. Never
    invents a subject the admin can't trace back to the raw guess."""
    text = raw.strip()
    if not text:
        return text
    lowered = text.lower()

    for name in known_subjects:
        if name.lower() == lowered:
            return name

    # Bidirectional: covers both a short abbreviation ("E" -> "Englisch") and a longer/fuller
    # guess than the class's own short name ("Mathematik" -> "Mathe").
    prefix_matches = [
        name for name in known_subjects
        if name.lower().startswith(lowered) or lowered.startswith(name.lower())
    ]
    if len(prefix_matches) == 1:
        return prefix_matches[0]

    mapped = SUBJECT_ABBREVIATIONS.get(lowered)
    if mapped:
        for name in known_subjects:
            if name.lower() == mapped.lower():
                return name
        return mapped

    return text
