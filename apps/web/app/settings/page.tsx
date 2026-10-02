"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarEvent,
  ClassInvite,
  demoteMember,
  downloadIcsExport,
  extractTimetableFromImage,
  fetchClassStats,
  fetchMembers,
  Member,
  promoteMember,
  Subject,
  SubjectStat,
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
import { AppShell } from "../../components/AppShell";
import {
  BookIcon,
  CalendarIcon,
  ShareIcon,
  SlidersIcon,
  TrendIcon,
  UsersIcon,
} from "../../components/icons";

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
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<SubjectStat[]>([]);
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

  type DraftLesson = { included: boolean; subjectName: string; weekday: number; start: string; end: string };
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [timetablePreview, setTimetablePreview] = useState<DraftLesson[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const [inv, subj, evs, mem] = await Promise.all([
        fetchInvite(token),
        fetchMySubjects(token),
        fetchCalendarEvents(token),
        fetchMembers(token),
      ]);
      setInvite(inv);
      setSubjects(subj);
      setEvents(evs);
      setMembers(mem);
      if (user?.is_class_admin) {
        fetchClassStats(token).then(setStats).catch(() => {});
      }
    } catch {
      setError("Konnte Daten nicht laden.");
    }
  }

  async function handlePromote(id: string) {
    if (!token) return;
    await promoteMember(token, id);
    refresh();
  }

  async function handleDemote(id: string) {
    if (!token) return;
    try {
      await demoteMember(token, id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleExportIcs() {
    if (!token) return;
    try {
      await downloadIcsExport(token);
    } catch (err) {
      setError((err as Error).message);
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

  async function handleScanTimetable(file: File) {
    if (!token) return;
    setScanning(true);
    setScanError(null);
    setTimetablePreview(null);
    try {
      const result = await extractTimetableFromImage(token, file);
      const drafts: DraftLesson[] = result.entries.map((entry) => {
        const weekdayIndex = WEEKDAYS.findIndex((w) => w.toLowerCase() === entry.weekday_guess?.toLowerCase());
        return {
          included: true,
          subjectName: entry.subject_guess || "",
          weekday: weekdayIndex >= 0 ? weekdayIndex : 0,
          start: /^\d{2}:\d{2}$/.test(entry.starts_at_guess) ? entry.starts_at_guess : "08:00",
          end: /^\d{2}:\d{2}$/.test(entry.ends_at_guess) ? entry.ends_at_guess : "08:45",
        };
      });
      setTimetablePreview(drafts);
      if (drafts.length === 0) setScanError("Konnte keine Stunden aus dem Foto erkennen - bitte manuell eintragen.");
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateDraft(index: number, patch: Partial<DraftLesson>) {
    setTimetablePreview((prev) => (prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev));
  }

  async function handleApplyTimetable() {
    if (!token || !timetablePreview) return;
    const refDate = "2026-01-05"; // a Monday - only weekday + time matter for recurring lessons
    const toApply = timetablePreview.filter((d) => d.included && d.subjectName.trim());
    if (toApply.length === 0) return;
    try {
      for (const draft of toApply) {
        const day = new Date(refDate);
        day.setDate(day.getDate() + draft.weekday);
        const iso = day.toISOString().slice(0, 10);
        const matchedSubject = subjects.find((s) => s.name.toLowerCase() === draft.subjectName.trim().toLowerCase());
        await createCalendarEvent(token, {
          title: draft.subjectName.trim(),
          starts_at: `${iso}T${draft.start}:00`,
          ends_at: `${iso}T${draft.end}:00`,
          is_recurring_weekly: true,
          weekday: draft.weekday,
          subject_id: matchedSubject ? matchedSubject.id : null,
        });
      }
      setTimetablePreview(null);
      refresh();
    } catch (err) {
      setScanError((err as Error).message);
    }
  }

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 style={{ marginBottom: 24 }}>Einstellungen</h1>

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

      {invite && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon"><ShareIcon size={16} /></span>
            <div>
              <div className="card-header-title">Klasse teilen</div>
              <div className="card-header-sub">Sharelink, Einladungscode &amp; Kalenderexport</div>
            </div>
          </div>
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
          <hr className="divider" />
          <p className="muted" style={{ marginBottom: 8 }}>
            Offene Hausaufgaben als Kalenderdatei - importierbar in Apple/Google/Outlook Kalender:
          </p>
          <button className="secondary" onClick={handleExportIcs}>Als .ics exportieren</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><UsersIcon size={16} /></span>
          <div>
            <div className="card-header-title">Mitglieder der Klasse</div>
            <div className="card-header-sub">{members.length} Mitglied{members.length === 1 ? "" : "er"}</div>
          </div>
        </div>
        <div className="stack">
          {members.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {m.display_name} <span className="faint">· {m.email}</span>
                {m.is_class_admin && <span className="pill green" style={{ marginLeft: 8 }}>Admin</span>}
              </span>
              {user.is_class_admin && (
                m.is_class_admin ? (
                  <button className="ghost" onClick={() => handleDemote(m.id)}>Admin entziehen</button>
                ) : (
                  <button className="ghost" onClick={() => handlePromote(m.id)}>Zum Admin machen</button>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><SlidersIcon size={16} /></span>
          <div>
            <div className="card-header-title">Tonfall des Agenten</div>
            <div className="card-header-sub">Bestimmt den Stil von Zusammenfassung und Chat-Antworten</div>
          </div>
        </div>
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

          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-tile-top">
                <span className="stat-tile-label">Mitglieder</span>
                <UsersIcon size={15} />
              </div>
              <div className="stat-tile-value">{members.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-top">
                <span className="stat-tile-label">Fächer</span>
                <BookIcon size={15} />
              </div>
              <div className="stat-tile-value">{subjects.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-top">
                <span className="stat-tile-label">Klassen-Quote</span>
                <TrendIcon size={15} />
              </div>
              <div className="stat-tile-value accent">
                {stats.length === 0
                  ? "–"
                  : `${Math.round((stats.reduce((sum, s) => sum + s.avg_completion_rate, 0) / stats.length) * 100)}%`}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-header-icon"><TrendIcon size={16} /></span>
              <div>
                <div className="card-header-title">Statistik nach Fach</div>
                <div className="card-header-sub">Erledigungsquote über die ganze Klasse</div>
              </div>
            </div>
            {stats.length === 0 && <p className="muted">Noch keine Hausaufgaben erfasst.</p>}
            <div className="stack">
              {stats.map((s) => (
                <div key={s.subject_id}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="subject-tag" style={{ marginBottom: 0 }}>
                      <span className="subject-dot" style={{ background: s.subject_color }} />
                      {s.subject_name}
                    </span>
                    <span className="faint">
                      {s.homework_count} Aufgabe{s.homework_count === 1 ? "" : "n"} · {Math.round(s.avg_completion_rate * 100)}% erledigt
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--surface-alt)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round(s.avg_completion_rate * 100)}%`,
                        background: s.subject_color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-header-icon"><BookIcon size={16} /></span>
              <div className="card-header-title">Fächer verwalten</div>
            </div>
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
            <div className="card-header">
              <span className="card-header-icon"><CalendarIcon size={16} /></span>
              <div className="card-header-title">Stundenplan / Kalender</div>
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>
              Da die WebUntis-API der Schule gesperrt ist, pflegst du den Stundenplan hier manuell -
              oder lässt ihn aus einem Foto deines Wochenplans vorschlagen.
            </p>

            <div className="row" style={{ marginBottom: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleScanTimetable(file);
                }}
                style={{ marginBottom: 0 }}
                disabled={scanning}
              />
            </div>
            {scanning && <p className="faint" style={{ marginBottom: 12 }}>Stundenplan wird erkannt...</p>}
            {scanError && <p style={{ color: "#f19999", marginBottom: 12 }}>{scanError}</p>}

            {timetablePreview && timetablePreview.length > 0 && (
              <div className="card" style={{ background: "var(--surface-alt)", marginBottom: 16 }}>
                <p className="section-title" style={{ marginTop: 0 }}>Erkannte Stunden - bitte prüfen</p>
                <div className="stack">
                  {timetablePreview.map((draft, i) => (
                    <div key={i} className="row wrap" style={{ alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={draft.included}
                        onChange={(e) => updateDraft(i, { included: e.target.checked })}
                      />
                      <input
                        placeholder="Fach"
                        value={draft.subjectName}
                        onChange={(e) => updateDraft(i, { subjectName: e.target.value })}
                        style={{ marginBottom: 0, flex: 1, minWidth: 100 }}
                        list="known-subjects"
                      />
                      <select
                        value={draft.weekday}
                        onChange={(e) => updateDraft(i, { weekday: Number(e.target.value) })}
                        style={{ marginBottom: 0, flex: 1, minWidth: 110 }}
                      >
                        {WEEKDAYS.slice(0, 5).map((w, wi) => (
                          <option key={w} value={wi}>{w}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={draft.start}
                        onChange={(e) => updateDraft(i, { start: e.target.value })}
                        style={{ marginBottom: 0, width: 100 }}
                      />
                      <input
                        type="time"
                        value={draft.end}
                        onChange={(e) => updateDraft(i, { end: e.target.value })}
                        style={{ marginBottom: 0, width: 100 }}
                      />
                    </div>
                  ))}
                </div>
                <datalist id="known-subjects">
                  {subjects.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
                <div className="row" style={{ marginTop: 14 }}>
                  <button type="button" className="ghost" onClick={() => setTimetablePreview(null)}>Verwerfen</button>
                  <button type="button" onClick={handleApplyTimetable}>Übernehmen</button>
                </div>
              </div>
            )}

            <hr className="divider" />
            <p className="field-label" style={{ marginBottom: 10 }}>Oder manuell eintragen</p>
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
    </AppShell>
  );
}
