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
} from "../../lib/api";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function formatEventTime(ev: CalendarEvent) {
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const time = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (ev.is_recurring_weekly && ev.weekday !== null) {
    return `${WEEKDAYS[ev.weekday]}, ${time(start)}–${time(end)} (wöchentlich)`;
  }
  return `${start.toLocaleDateString("de-DE")}, ${time(start)}–${time(end)}`;
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
      <div className="top-bar">
        <h1>Einstellungen</h1>
        <a href="/dashboard"><button className="secondary">Zurück</button></a>
      </div>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {invite && (
        <div className="card">
          <h3>Klasse teilen</h3>
          <p style={{ color: "var(--muted)" }}>
            Öffentliche Ansicht (kein Login nötig) - was ansteht, sehen alle mit diesem Link:
          </p>
          <div className="row">
            <input readOnly value={invite.public_view_url} />
            <button className="secondary" onClick={() => copy(invite.public_view_url, "public")}>
              {copied === "public" ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 12 }}>
            Einladungscode zum Registrieren mit eigenem Konto (zum Hinzufügen/Abhaken):
          </p>
          <div className="row">
            <input readOnly value={invite.invite_code} />
            <button className="secondary" onClick={() => copy(invite.invite_code, "code")}>
              {copied === "code" ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
        </div>
      )}

      {user.is_class_admin ? (
        <>
          <div className="card">
            <h3>Fächer verwalten</h3>
            <form onSubmit={handleAddSubject} className="row" style={{ marginBottom: 12 }}>
              <input placeholder="Neues Fach" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
              <input
                type="color"
                value={subjectColor}
                onChange={(e) => setSubjectColor(e.target.value)}
                style={{ width: 48, padding: 2 }}
              />
              <button type="submit">+</button>
            </form>
            {subjects.map((s) => (
              <div key={s.id} className="row" style={{ marginBottom: 6 }}>
                <span className="subject-tag" style={{ background: s.color, color: "#0f1115" }}>{s.name}</span>
                <button className="secondary" onClick={() => handleDeleteSubject(s.id)}>Löschen</button>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Stundenplan / Kalender</h3>
            <p style={{ color: "var(--muted)" }}>
              Da die WebUntis-API der Schule gesperrt ist, pflegst du den Stundenplan hier manuell.
            </p>
            <form onSubmit={handleAddEvent}>
              <input placeholder="Titel (z.B. Mathe)" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              <label className="row" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={eventRecurring}
                  onChange={(e) => setEventRecurring(e.target.checked)}
                />
                Wöchentlich wiederkehrend (normale Unterrichtsstunde)
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
            {events.length === 0 && <p style={{ color: "var(--muted)" }}>Noch keine Termine.</p>}
            {events.map((ev) => (
              <div key={ev.id} className="row" style={{ marginBottom: 6 }}>
                <span style={{ flex: 1 }}>{ev.title} · {formatEventTime(ev)}</span>
                <button className="secondary" onClick={() => handleDeleteEvent(ev.id)}>Löschen</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ color: "var(--muted)" }}>
          Fächer und Kalender werden vom Klassen-Admin gepflegt.
        </p>
      )}
    </div>
  );
}
