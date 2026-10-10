"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarEvent,
  ClassInvite,
  createLessonPeriod,
  demoteMember,
  deleteLessonPeriod,
  downloadIcsExport,
  extractTimetableFromImage,
  fetchLessonPeriods,
  fetchMembers,
  LessonPeriod,
  Member,
  promoteMember,
  Subject,
  User,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchInvite,
  fetchMySubjects,
  updateCalendarEvent,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { BookIcon, CalendarIcon, ClockIcon, ShareIcon, UsersIcon } from "../../components/icons";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
// Select-Wert für "ausdrücklich frei, kein Unterricht" - unterscheidet sich von "" (Zelle noch
// nie befüllt, zeigt "fehlt noch"), damit man einer leeren Stunde bestätigen kann, dass sie
// wirklich frei ist, statt dass sie für immer rot als unbearbeitet markiert bleibt.
const FREE_MARKER = "__FREE__";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatEventTime(ev: CalendarEvent) {
  const start = new Date(ev.starts_at);
  if (ev.is_recurring_weekly && ev.weekday !== null) {
    return `${WEEKDAYS[ev.weekday]} · ${timeOf(ev.starts_at)}–${timeOf(ev.ends_at)}`;
  }
  return `${start.toLocaleDateString("de-DE")} · ${timeOf(ev.starts_at)}–${timeOf(ev.ends_at)}`;
}

export default function ClassPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [invite, setInvite] = useState<ClassInvite | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [periods, setPeriods] = useState<LessonPeriod[]>([]);
  const [newPeriodStart, setNewPeriodStart] = useState("08:00");
  const [newPeriodEnd, setNewPeriodEnd] = useState("08:45");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("08:00");
  const [eventEnd, setEventEnd] = useState("08:45");

  type DraftLesson = {
    included: boolean;
    subjectName: string;
    subjectRaw?: string;
    weekday: number;
    start: string;
    end: string;
    customTime?: boolean;
  };
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWeekday, setScanWeekday] = useState(WEEKDAYS[0]);
  const [timetablePreview, setTimetablePreview] = useState<DraftLesson[] | null>(null);
  const [detectedSlots, setDetectedSlots] = useState<{ start: string; end: string }[]>([]);
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
      const [inv, subj, evs, per, mem] = await Promise.all([
        fetchInvite(token),
        fetchMySubjects(token),
        fetchCalendarEvents(token),
        fetchLessonPeriods(token),
        fetchMembers(token),
      ]);
      setInvite(inv);
      setSubjects(subj);
      setEvents(evs);
      setPeriods(per);
      setMembers(mem);
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

  async function handleAddPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      const nextNumber = periods.length > 0 ? Math.max(...periods.map((p) => p.number)) + 1 : 1;
      await createLessonPeriod(token, { number: nextNumber, start_time: newPeriodStart, end_time: newPeriodEnd });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeletePeriod(id: string) {
    if (!token) return;
    await deleteLessonPeriod(token, id);
    refresh();
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    // Regelmäßige Unterrichtsstunden trägt man über den Stundenplan oben ein - dieses
    // Formular ist nur noch für einmalige Termine (Ausflug, Elternabend, Vertretung o.ä.).
    if (!token || !eventTitle || !eventDate) return;
    try {
      await createCalendarEvent(token, {
        title: eventTitle,
        starts_at: `${eventDate}T${eventStart}:00`,
        ends_at: `${eventDate}T${eventEnd}:00`,
        is_recurring_weekly: false,
        weekday: null,
      });
      setEventTitle("");
      setEventDate("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function eventForSlot(weekday: number, period: LessonPeriod): CalendarEvent | undefined {
    return events.find(
      (ev) =>
        ev.is_recurring_weekly &&
        ev.weekday === weekday &&
        timeOf(ev.starts_at) === period.start_time &&
        timeOf(ev.ends_at) === period.end_time
    );
  }

  // "" = komplett zurücksetzen (zurück zu "fehlt noch", Event wird gelöscht), FREE_MARKER =
  // ausdrücklich als frei/kein Unterricht markiert (Event ohne Fach bleibt bestehen), sonst
  // die subject_id der zugewiesenen Stunde.
  async function handleGridAssign(weekday: number, period: LessonPeriod, selection: string) {
    if (!token) return;
    const existing = eventForSlot(weekday, period);
    try {
      if (!selection) {
        if (existing) await deleteCalendarEvent(token, existing.id);
      } else {
        const subject = selection === FREE_MARKER ? null : subjects.find((s) => s.id === selection);
        if (selection !== FREE_MARKER && !subject) return;
        const refDate = "2026-01-05"; // a Monday - only weekday + time matter for recurring lessons
        const day = new Date(refDate);
        day.setDate(day.getDate() + weekday);
        const iso = day.toISOString().slice(0, 10);
        const payload = {
          title: subject ? subject.name : "Frei",
          starts_at: `${iso}T${period.start_time}:00`,
          ends_at: `${iso}T${period.end_time}:00`,
          is_recurring_weekly: true,
          weekday,
          subject_id: subject ? subject.id : null,
        };
        if (existing) {
          await updateCalendarEvent(token, existing.id, payload);
        } else {
          await createCalendarEvent(token, payload);
        }
      }
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
    try {
      // Scanned per weekday on purpose: a model asked to place lessons on a full week table
      // has to get both the weekday AND the period right for every cell, which is where it
      // kept going wrong. Fixing the weekday here (from the dropdown, not the model) turns
      // each scan into a much simpler top-to-bottom read of a single day.
      const result = await extractTimetableFromImage(token, file, scanWeekday);
      const weekdayIndex = WEEKDAYS.findIndex((w) => w === scanWeekday);
      const drafts: DraftLesson[] = result.entries.map((entry) => ({
        included: true,
        subjectName: entry.subject_guess || "",
        subjectRaw: entry.subject_raw || undefined,
        weekday: weekdayIndex >= 0 ? weekdayIndex : 0,
        start: /^\d{2}:\d{2}$/.test(entry.starts_at_guess) ? entry.starts_at_guess : "08:00",
        end: /^\d{2}:\d{2}$/.test(entry.ends_at_guess) ? entry.ends_at_guess : "08:45",
      }));
      // Accumulate across days instead of replacing - the admin scans one day at a time and
      // reviews/applies everything together at the end.
      setTimetablePreview((prev) => [...(prev || []), ...drafts]);

      setDetectedSlots((prev) => {
        const seen = new Set(prev.map((s) => `${s.start}|${s.end}`));
        const merged = [...prev];
        for (const d of drafts) {
          const key = `${d.start}|${d.end}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push({ start: d.start, end: d.end });
          }
        }
        return merged.sort((a, b) => a.start.localeCompare(b.start));
      });

      if (drafts.length === 0) {
        const preview = result.raw_model_output?.trim().slice(0, 300);
        setScanError(
          `Konnte für ${scanWeekday} keine Stunden aus dem Foto erkennen - bitte manuell eintragen.` +
            (preview ? ` (Modell-Antwort: "${preview}${result.raw_model_output.length > 300 ? "…" : ""}")` : "")
        );
      } else if (result.low_confidence) {
        setScanError(
          `Die Erkennung für ${scanWeekday} wirkt unsicher (z.B. gleiches Fach bei allen Stunden) - bitte jede Zeile vor dem Übernehmen genau prüfen.`
        );
      } else {
        // Nudge the dropdown to the next weekday so scanning the whole week is just
        // "pick a file" repeated five times.
        const nextIndex = WEEKDAYS.findIndex((w) => w === scanWeekday) + 1;
        if (nextIndex >= 0 && nextIndex < 5) setScanWeekday(WEEKDAYS[nextIndex]);
      }
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
      setDetectedSlots([]);
      setScanWeekday(WEEKDAYS[0]);
      refresh();
    } catch (err) {
      setScanError((err as Error).message);
    }
  }

  // The class's own fixed period grid (if set up) always wins over times merely derived
  // from a scan result - it's the ground truth the admin entered, scans just confirm it.
  const timeSlotOptions =
    periods.length > 0
      ? periods.map((p) => ({ number: p.number, start: p.start_time, end: p.end_time }))
      : detectedSlots.map((s, i) => ({ number: i + 1, start: s.start, end: s.end }));

  if (!user) return null;
  const isAdmin = !!user.is_class_admin;

  return (
    <AppShell user={user}>
      <h1 style={{ marginBottom: 24 }}>Klasse</h1>

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
              {isAdmin && (
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

      {isAdmin ? (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-header-icon"><CalendarIcon size={16} /></span>
              <div className="card-header-title">Stundenplan</div>
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>
              Die Schule stellt den Stundenplan nicht automatisch bereit - trage ihn hier einmalig
              ein, oder lass ihn dir aus einem Foto vorschlagen.
            </p>

            <div className="card" style={{ background: "var(--surface-alt)", marginBottom: 16 }}>
              <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                <ClockIcon size={16} />
                <p className="section-title" style={{ margin: 0 }}>Stunden-Raster</p>
              </div>
              <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                Trage hier einmalig die echten Uhrzeiten eurer Schulstunden ein. Die Foto-Erkennung
                ordnet jede erkannte Stunde dann nur noch einer dieser Nummern zu, statt selbst eine
                Uhrzeit zu erraten - so kann sie bei den Zeiten nichts mehr falsch machen.
              </p>
              {periods.length > 0 && (
                <div className="stack" style={{ marginBottom: 12 }}>
                  {periods.map((p) => (
                    <div key={p.id} className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span>{p.number}. Stunde: {p.start_time}–{p.end_time}</span>
                      <button className="ghost" onClick={() => handleDeletePeriod(p.id)}>Löschen</button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddPeriod} className="row wrap" style={{ alignItems: "center" }}>
                <input
                  type="time"
                  value={newPeriodStart}
                  onChange={(e) => setNewPeriodStart(e.target.value)}
                  style={{ marginBottom: 0, width: 100 }}
                />
                <span className="muted">–</span>
                <input
                  type="time"
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                  style={{ marginBottom: 0, width: 100 }}
                />
                <button type="submit" style={{ flexShrink: 0 }}>
                  Als {periods.length > 0 ? Math.max(...periods.map((p) => p.number)) + 1 : 1}. Stunde hinzufügen
                </button>
              </form>
            </div>

            <div className="card" style={{ background: "var(--surface-alt)", marginBottom: 16 }}>
              <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                <BookIcon size={16} />
                <p className="section-title" style={{ margin: 0 }}>Dein Stundenplan</p>
              </div>
              {periods.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Trage zuerst oben deine Unterrichtszeiten ein - dann kannst du hier für jede
                  Stunde ein Fach auswählen.
                </p>
              ) : subjects.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Lege zuerst auf der Admin-Seite ein paar Fächer an - dann kannst du sie hier den
                  Stunden zuordnen.
                </p>
              ) : (
                <>
                  <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                    Wähle pro Stunde das Fach aus. Rot markierte Felder sind noch leer.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 6px", fontSize: 12, color: "var(--muted)" }}>
                            Stunde
                          </th>
                          {WEEKDAYS.slice(0, 5).map((w) => (
                            <th key={w} style={{ textAlign: "left", padding: "4px 6px", fontSize: 12, color: "var(--muted)" }}>
                              {w}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((p) => (
                          <tr key={p.id}>
                            <td style={{ padding: "4px 6px", fontSize: 12, whiteSpace: "nowrap", color: "var(--muted)" }}>
                              {p.number}. Stunde<br />{p.start_time}–{p.end_time}
                            </td>
                            {WEEKDAYS.slice(0, 5).map((w, wi) => {
                              const existing = eventForSlot(wi, p);
                              const selectValue = existing ? existing.subject_id || FREE_MARKER : "";
                              return (
                                <td key={w} style={{ padding: "4px 6px" }}>
                                  <select
                                    value={selectValue}
                                    onChange={(e) => handleGridAssign(wi, p, e.target.value)}
                                    style={{
                                      marginBottom: 0,
                                      width: "100%",
                                      minWidth: 110,
                                      borderColor: existing ? undefined : "#ef4444",
                                    }}
                                  >
                                    <option value="">{existing ? "– zurücksetzen –" : "fehlt noch"}</option>
                                    <option value={FREE_MARKER}>– frei (kein Unterricht) –</option>
                                    {subjects.map((s) => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <hr className="divider" />
            <p className="field-label" style={{ marginBottom: 10 }}>
              Oder: Stundenplan aus einem Foto vorschlagen lassen
            </p>
            <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
              Pro Foto nur EIN Wochentag (z.B. zugeschnitten oder einzeln fotografiert) - wähle
              zuerst den Tag, dann das Foto dazu. So muss die KI nur noch von oben nach unten
              lesen, statt Wochentag und Stunde gleichzeitig zu erraten.
            </p>
            <div className="row" style={{ marginBottom: 8, alignItems: "center" }}>
              <select
                value={scanWeekday}
                onChange={(e) => setScanWeekday(e.target.value)}
                style={{ marginBottom: 0 }}
                disabled={scanning}
              >
                {WEEKDAYS.slice(0, 5).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
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
            {scanning && <p className="faint pulse" style={{ marginBottom: 12 }}>Stundenplan für {scanWeekday} wird erkannt...</p>}
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
                        title={
                          draft.subjectRaw && draft.subjectRaw.trim().toLowerCase() !== draft.subjectName.trim().toLowerCase()
                            ? `KI hat im Bild "${draft.subjectRaw}" erkannt und "${draft.subjectName}" vorgeschlagen`
                            : undefined
                        }
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
                      <select
                        value={draft.customTime ? "custom" : `${draft.start}|${draft.end}`}
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            updateDraft(i, { customTime: true });
                          } else {
                            const [start, end] = e.target.value.split("|");
                            updateDraft(i, { start, end, customTime: false });
                          }
                        }}
                        style={{ marginBottom: 0, minWidth: 170 }}
                      >
                        {timeSlotOptions.map((slot) => (
                          <option key={slot.number} value={`${slot.start}|${slot.end}`}>
                            {slot.number}. Stunde ({slot.start}–{slot.end})
                          </option>
                        ))}
                        <option value="custom">Eigene Zeit…</option>
                      </select>
                      {draft.customTime && (
                        <>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <datalist id="known-subjects">
                  {subjects.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setTimetablePreview(null);
                      setDetectedSlots([]);
                      setScanWeekday(WEEKDAYS[0]);
                    }}
                  >
                    Verwerfen
                  </button>
                  <button type="button" onClick={handleApplyTimetable}>Übernehmen</button>
                </div>
              </div>
            )}

            <hr className="divider" />
            <p className="field-label" style={{ marginBottom: 6 }}>Einmaliger Termin</p>
            <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
              Für Dinge, die nur einmal stattfinden (Ausflug, Elternabend, Vertretungsstunde).
              Normale, wöchentliche Unterrichtsstunden trägst du oben im Stundenplan ein.
            </p>
            <form onSubmit={handleAddEvent}>
              <label className="field-label">Titel</label>
              <input placeholder="z.B. Wandertag" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              <div className="row">
                <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
              </div>
              <button type="submit">Termin speichern</button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-header-icon"><CalendarIcon size={16} /></span>
              <div className="card-header-title">Einmalige Termine</div>
            </div>
            {events.filter((ev) => !ev.is_recurring_weekly).length === 0 && (
              <p className="muted">Noch keine einmaligen Termine.</p>
            )}
            <div className="stack">
              {events.filter((ev) => !ev.is_recurring_weekly).map((ev) => (
                <div key={ev.id} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{ev.title} <span className="faint">· {formatEventTime(ev)}</span></span>
                  <button className="ghost" onClick={() => handleDeleteEvent(ev.id)}>Löschen</button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Stundenplan und Rollen werden vom Klassen-Admin gepflegt.</p>
      )}
    </AppShell>
  );
}
