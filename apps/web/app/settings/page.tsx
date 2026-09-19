"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarEvent,
  ClassInvite,
  Subject,
  User,
  createCalendarEvent,
  createSubject,
  deleteCalendarEvent,
  deleteSubject,
  fetchCalendarEvents,
  fetchInvite,
  fetchMySubjects,
  setAgentTone,
} from "../../lib/api";
import { Logo } from "../../components/Logo";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function formatEventTime(ev: CalendarEvent) {
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const time = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (ev.is_recurring_weekly && ev.weekday !== null) {
    return `${WEEKDAYS[ev.weekday]} · ${time(start)}–${time(end)}`;
  }
  return `${start.toLocaleDateString("de-DE")} · ${time(start)}–${time(end)}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [invite, setInvite] = useState<ClassInvite | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3B82F6");

  const [eventTitle, setEventTitle] = useState("");
  const [eventRecurring, setEventRecurring] = useState(true);
  const [eventWeekday, setEventWeekday] = useState(0);
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("08:00");
  const [eventEnd, setEventEnd] = useState("08:45");

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    const u = localStorage.getItem("hausiplanner_user");
    if (!t || !u) {
      router.push("/login");
      return;
    }
    setToken(t);
    setUser(JSON.parse(u));
  }, [router]);

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  async function refresh() {
    if (!token) return;
    try {
      const [inv, subj, evs] = await Promise.all([
        fetchInvite(token),
        fetchMySubjects(token),
        fetchCalendarEvents(token),
      ]);
      setInvite(inv);
      setSubjects(subj);
      setEvents(evs);
    } catch {
      setError("Konnte Daten nicht laden.");
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !subjectName) return;
    try {
      await createSubject(token, { name: subjectName, color: subjectColor });
      setSubjectName("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteSubject(id: string) {
    if (!token) return;
    await deleteSubject(token, id);
    refresh();
  }

  async function handleSetTone(tone: "locker" | "streng") {
    if (!token) return;
    const updated = await setAgentTone(token, tone);
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !eventTitle) return;
    try {
      let startsAt: string;
      let endsAt: string;
      if (eventRecurring) {
        // Anchor recurring lessons on an arbitrary reference week - only weekday + time matter.
        const refDate = "2026-01-05"; // a Monday
        const dayOffset = eventWeekday;
        const d = new Date(refDate);
        d.setDate(d.getDate() + dayOffset);
        const iso = d.toISOString().slice(0, 10);
        startsAt = `${iso}T${eventStart}:00`;
        endsAt = `${iso}T${eventEnd}:00`;
      } else {
        if (!eventDate) return;
        startsAt = `${eventDate}T${eventStart}:00`;
        endsAt = `${eventDate}T${eventEnd}:00`;
      }
      await createCalendarEvent(token, {
        title: eventTitle,
        starts_at: startsAt,
        ends_at: endsAt,
        is_recurring_weekly: eventRecurring,
        weekday: eventRecurring ? eventWeekday : null,
      });
      setEventTitle("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!token) return;
    await deleteCalendarEvent(token, id);
    refresh();
  }

  if (!user) return null;

  return (
    <div>
      <div className="nav-bar">
        <Logo href="/dashboard" />
        <a href="/dashboard"><button className="ghost">Zurück</button></a>
      </div>

      <h1 style={{ marginBottom: 24 }}>Einstellungen</h1>

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

      {invite && (
        <div className="card">
          <h3>Klasse teilen</h3>
          <p className="muted" style={{ marginBottom: 8 }}>
            Öffentliche Ansicht ohne Login - zeigt allen mit diesem Link die offenen Hausaufgaben:
          </p>
          <div className="copy-row">
            <input readOnly value={invite.public_view_url} />
            <button className="secondary" onClick={() => copy(invite.public_view_url, "public")}>
              {copied === "public" ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 16, marginBottom: 8 }}>
            Einladungscode zum Registrieren mit eigenem Konto (zum Hinzufügen/Abhaken):
          </p>
          <div className="copy-row">
            <input readOnly value={invite.invite_code} />
            <button className="secondary" onClick={() => copy(invite.invite_code, "code")}>
              {copied === "code" ? "Kopiert" : "Kopieren"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Tonfall des Agenten</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Bestimmt den Stil von Zusammenfassung und Chat-Antworten.
        </p>
        <div className="toggle-group">
          <button
            type="button"
            className={user.agent_tone === "locker" ? "active" : ""}
            onClick={() => handleSetTone("locker")}
          >
            Locker
          </button>
          <button
            type="button"
            className={user.agent_tone === "streng" ? "active" : ""}
            onClick={() => handleSetTone("streng")}
          >
            Sachlich
          </button>
        </div>
      </div>

      {user.is_class_admin ? (
        <>
          <p className="section-title">Admin-Bereich</p>

          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Fächer verwalten</h3>
            <form onSubmit={handleAddSubject} className="row" style={{ marginBottom: 16 }}>
              <input placeholder="Neues Fach" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} style={{ marginBottom: 0 }} />
              <input
                type="color"
                value={subjectColor}
                onChange={(e) => setSubjectColor(e.target.value)}
                style={{ width: 48, padding: 3, marginBottom: 0, flexShrink: 0 }}
              />
              <button type="submit" style={{ flexShrink: 0 }}>Hinzufügen</button>
            </form>
            <div className="stack">
              {subjects.map((s) => (
                <div key={s.id} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="subject-tag" style={{ marginBottom: 0 }}>
                    <span className="subject-dot" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <button className="ghost" onClick={() => handleDeleteSubject(s.id)}>Löschen</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Stundenplan / Kalender</h3>
            <p className="muted" style={{ marginBottom: 16 }}>
              Da die WebUntis-API der Schule gesperrt ist, pflegst du den Stundenplan hier manuell.
            </p>
            <form onSubmit={handleAddEvent}>
              <label className="field-label">Titel</label>
              <input placeholder="z.B. Mathe" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />

              <label className="row" style={{ marginBottom: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={eventRecurring}
                  onChange={(e) => setEventRecurring(e.target.checked)}
                />
                <span style={{ fontSize: 14 }}>Wöchentlich wiederkehrend (normale Unterrichtsstunde)</span>
              </label>

              {eventRecurring ? (
                <select value={eventWeekday} onChange={(e) => setEventWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i}>{w}</option>
                  ))}
                </select>
              ) : (
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              )}
              <div className="row">
                <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
              </div>
              <button type="submit">Termin speichern</button>
            </form>
          </div>

          <div className="card">
            {events.length === 0 && <p className="muted">Noch keine Termine.</p>}
            <div className="stack">
              {events.map((ev) => (
                <div key={ev.id} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{ev.title} <span className="faint">· {formatEventTime(ev)}</span></span>
                  <button className="ghost" onClick={() => handleDeleteEvent(ev.id)}>Löschen</button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Fächer und Kalender werden vom Klassen-Admin gepflegt.</p>
      )}
    </div>
  );
}
