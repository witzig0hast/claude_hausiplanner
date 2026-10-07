"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  attachmentDownloadUrl,
  captureVoiceNote,
  createHomeworkWithRepeat,
  deleteAttachment,
  deleteHomework,
  fetchMyHomework,
  fetchMySubjects,
  fetchPendingSuggestion,
  Homework,
  PendingSuggestion,
  postponeToNextLesson,
  Priority,
  Subject,
  toggleComplete,
  uploadAttachment,
  User,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToastProvider, useToast } from "../../components/Toast";
import { SuggestionModal } from "../../components/SuggestionModal";
import { AttachmentViewer, isViewable } from "../../components/AttachmentViewer";
import {
  CalendarIcon,
  ClockIcon,
  FileIcon,
  ListIcon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  TrashIcon,
  TrendIcon,
} from "../../components/icons";
import AgentPanel from "./AgentPanel";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDue(due: string) {
  return new Date(due).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDue(items: Homework[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Rolling 24h window, not calendar midnight: something due tomorrow 06:00 has to be done
  // today regardless (there's no "tomorrow morning" time left to do it in), so it belongs in
  // "Heute" just as much as something due at 23:59 tonight does.
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + (7 - startOfToday.getDay() + 1) * 24 * 60 * 60 * 1000);

  const today: Homework[] = [];
  const thisWeek: Homework[] = [];
  const later: Homework[] = [];

  for (const hw of items) {
    const due = new Date(hw.due_at);
    if (due < in24h) today.push(hw);
    else if (due < endOfWeek) thisWeek.push(hw);
    else later.push(hw);
  }
  return { today, thisWeek, later };
}

function DashboardInner() {
  const router = useRouter();
  const showToast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [priority, setPriority] = useState<Priority | "">("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const [suggestion, setSuggestion] = useState<PendingSuggestion | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ hwId: string; attachmentId: string; filename: string; contentType: string } | null>(
    null
  );
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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
    if (!token) return;
    refresh();
    // Account-bezogen, nicht Tab-bezogen: ein zuvor eingesprochener, noch nicht
    // bestätigter Vorschlag taucht auch Stunden später / auf einem anderen Gerät wieder auf.
    fetchPendingSuggestion(token).then(setSuggestion).catch(() => {});
  }, [token]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!token) return;
        setTranscribing(true);
        try {
          const result = await captureVoiceNote(token, blob);
          setSuggestion(result);
        } catch (err) {
          showToast((err as Error).message, "error");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast("Kein Mikrofonzugriff möglich.", "error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function refresh() {
    if (!token) return;
    try {
      const [hw, subj] = await Promise.all([fetchMyHomework(token), fetchMySubjects(token)]);
      setItems(hw);
      setSubjects(subj);
      if (subj.length > 0 && !subjectId) setSubjectId(subj[0].id);
    } catch {
      setError("Daten konnten nicht geladen werden.");
    }
  }

  async function handleToggle(hw: Homework) {
    if (!token) return;
    const nextDone = !hw.completed_by_me;
    setItems((prev) => prev.map((i) => (i.id === hw.id ? { ...i, completed_by_me: nextDone } : i)));
    try {
      await toggleComplete(token, hw.id, nextDone);
      showToast(nextDone ? "Als erledigt markiert" : "Als offen markiert");
    } catch {
      setItems((prev) => prev.map((i) => (i.id === hw.id ? { ...i, completed_by_me: !nextDone } : i)));
      showToast("Status konnte nicht geändert werden", "error");
    }
  }

  async function handleDelete(hw: Homework) {
    if (!token) return;
    if (!confirm(`"${hw.title}" wirklich löschen?`)) return;
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== hw.id));
    try {
      await deleteHomework(token, hw.id);
      showToast("Hausaufgabe gelöscht");
    } catch {
      setItems(previous);
      showToast("Konnte Hausaufgabe nicht löschen", "error");
    }
  }

  async function handleUpload(hw: Homework, file: File) {
    if (!token) return;
    setUploadingFor(hw.id);
    try {
      const updated = await uploadAttachment(token, hw.id, file);
      setItems((prev) => prev.map((i) => (i.id === hw.id ? updated : i)));
      showToast("Material hochgeladen");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleDeleteAttachment(hw: Homework, attachmentId: string) {
    if (!token) return;
    if (!confirm("Diese Datei wirklich löschen?")) return;
    try {
      await deleteAttachment(token, hw.id, attachmentId);
      setItems((prev) =>
        prev.map((i) => (i.id === hw.id ? { ...i, attachments: i.attachments.filter((a) => a.id !== attachmentId) } : i))
      );
      showToast("Datei gelöscht");
    } catch {
      showToast("Konnte Datei nicht löschen", "error");
    }
  }

  async function handlePostpone(hw: Homework) {
    if (!token) return;
    try {
      const updated = await postponeToNextLesson(token, hw.id);
      setItems((prev) => prev.map((i) => (i.id === hw.id ? updated : i)));
      showToast("Auf nächste Stunde verschoben");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !subjectId || !dueAt) return;
    try {
      await createHomeworkWithRepeat(token, {
        title,
        description: description || undefined,
        due_at: new Date(dueAt).toISOString(),
        subject_id: subjectId,
        repeat_weeks: repeatWeeks || undefined,
        priority: priority || undefined,
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      setRepeatWeeks(0);
      setPriority("");
      setShowForm(false);
      refresh();
      showToast("Hausaufgabe gespeichert");
    } catch {
      showToast("Konnte Hausaufgabe nicht speichern", "error");
    }
  }

  if (!user) return null;

  const isAdmin = user.is_class_admin;
  const prioritiesEnabled = user.priorities_enabled;
  const openCount = items.filter((i) => !i.completed_by_me).length;
  const { today: dueTodayAll } = groupByDue(items.filter((i) => !i.completed_by_me));
  const dueTodayCount = dueTodayAll.length;
  const completedCount = items.length - openCount;
  const completionRate = items.length > 0 ? Math.round((completedCount / items.length) * 100) : null;

  const filtered = items
    .filter((hw) => !filterSubject || hw.subject.id === filterSubject)
    .filter(
      (hw) =>
        !search.trim() ||
        hw.title.toLowerCase().includes(search.toLowerCase()) ||
        hw.description?.toLowerCase().includes(search.toLowerCase())
    );
  const { today, thisWeek, later } = groupByDue(filtered);

  function renderGroup(label: string, group: Homework[]) {
    if (group.length === 0) return null;
    return (
      <>
        <p className="group-heading">
          {label} <span className="count">· {group.length}</span>
        </p>
        <div className="stack">
          {group.map((hw) => (
            <div key={hw.id} className={`card interactive ${hw.completed_by_me ? "done" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <span className="subject-tag" style={{ marginBottom: 0 }}>
                    <span className="subject-dot" style={{ background: hw.subject.color }} />
                    {hw.subject.name}
                  </span>
                  {prioritiesEnabled && hw.priority === "hoch" && (
                    <span className="pill" style={{ background: "#d9707022", color: "#d97070" }}>Hoch</span>
                  )}
                  {prioritiesEnabled && hw.priority === "niedrig" && (
                    <span className="pill" style={{ background: "var(--surface)", color: "var(--muted)" }}>Niedrig</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className="ghost"
                      title="Auf nächste Stunde verschieben (z.B. wenn die Stunde ausfällt)"
                      onClick={(e) => { e.stopPropagation(); handlePostpone(hw); }}
                    >
                      <CalendarIcon size={15} />
                    </button>
                    <button
                      className="ghost"
                      title="Hausaufgabe löschen"
                      onClick={(e) => { e.stopPropagation(); handleDelete(hw); }}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                )}
              </div>
              <h3>{hw.title}</h3>
              {hw.description && <p className="muted" style={{ marginTop: 6 }}>{hw.description}</p>}
              <p className="due">
                Fällig {formatDue(hw.due_at)}
                {hw.completed_count > 0 && <span> · {hw.completed_count} Mitschüler erledigt</span>}
              </p>

              {hw.attachments.length > 0 && (
                <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                  {hw.attachments.map((a) => (
                    <div key={a.id} className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <a
                        href={attachmentDownloadUrl(hw.id, a.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="row"
                        style={{ gap: 6, alignItems: "center", textDecoration: "none", color: "var(--text)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isViewable(a.content_type)) {
                            e.preventDefault();
                            setViewing({ hwId: hw.id, attachmentId: a.id, filename: a.filename, contentType: a.content_type });
                          }
                        }}
                      >
                        <FileIcon size={14} />
                        <span style={{ fontSize: 14 }}>{a.filename}</span>
                        <span className="faint">· {formatFileSize(a.size_bytes)}</span>
                      </a>
                      <button
                        className="ghost"
                        title="Datei löschen"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(hw, a.id); }}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                style={{ display: "none" }}
                ref={(el) => {
                  if (el) fileInputRefs.current.set(hw.id, el);
                  else fileInputRefs.current.delete(hw.id);
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(hw, file);
                  e.target.value = "";
                }}
              />
              <div className="row" style={{ marginTop: 14, gap: 8 }}>
                <button
                  className="secondary"
                  style={{ flex: 1 }}
                  disabled={uploadingFor === hw.id}
                  onClick={(e) => { e.stopPropagation(); fileInputRefs.current.get(hw.id)?.click(); }}
                >
                  <span className="row" style={{ gap: 6, justifyContent: "center" }}>
                    <PaperclipIcon size={14} />
                    {uploadingFor === hw.id ? "Lädt hoch..." : "Material"}
                  </span>
                </button>
                <button
                  className={hw.completed_by_me ? "secondary" : ""}
                  style={{ flex: 2 }}
                  onClick={() => handleToggle(hw)}
                >
                  {hw.completed_by_me ? "Als offen markieren" : "Als erledigt markieren"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <AppShell user={user}>
      <div className="top-bar">
        <div>
          <h1>{user.display_name}</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {openCount === 0 ? "Keine offenen Hausaufgaben." : `${openCount} offene Hausaufgabe${openCount === 1 ? "" : "n"}.`}
          </p>
        </div>
        <div className="row">
          <button
            className={`mic-button ${recording ? "recording" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            title={recording ? "Aufnahme stoppen" : "Hausaufgabe einsprechen"}
          >
            <span className={`row ${transcribing ? "pulse" : ""}`} style={{ gap: 6 }}>
              <MicIcon size={15} />
              {transcribing ? "Wird erkannt..." : recording ? "Stoppen" : "Einsprechen"}
            </span>
          </button>
          <button onClick={() => setShowForm(!showForm)}>
            <span className="row" style={{ gap: 6 }}>
              <PlusIcon size={15} /> Hausaufgabe
            </span>
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-tile-label">Offen</span>
            <ListIcon size={15} />
          </div>
          <div className="stat-tile-value">{openCount}</div>
          <div className="stat-tile-sub">Aufgabe{openCount === 1 ? "" : "n"} insgesamt</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-tile-label">Heute fällig</span>
            <ClockIcon size={15} />
          </div>
          <div className={`stat-tile-value ${dueTodayCount > 0 ? "warn" : ""}`}>{dueTodayCount}</div>
          <div className="stat-tile-sub">in den nächsten 24h</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-tile-label">Erledigungsquote</span>
            <TrendIcon size={15} />
          </div>
          <div className="stat-tile-value accent">{completionRate === null ? "–" : `${completionRate}%`}</div>
          <div className="progress-track" style={{ marginTop: 8 }}>
            <div
              className="progress-fill"
              style={{ width: `${completionRate ?? 0}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
      </div>

      {token && <AgentPanel token={token} />}

      {subjects.length === 0 && (
        <div className="card">
          <strong>Keine Fächer angelegt.</strong>{" "}
          <span className="muted">{user.is_class_admin ? "Fächer werden in den Einstellungen verwaltet." : "Der Klassen-Admin muss zunächst Fächer anlegen."}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20 }}>
          <label className="field-label">Titel</label>
          <input placeholder="z.B. Seite 42, Aufgabe 3" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

          <label className="field-label">Beschreibung (optional)</label>
          <textarea placeholder="Details" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="row wrap" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label">Fach</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="field-label">Fällig</label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
            </div>
          </div>

          <label className="field-label">Wiederholt sich wöchentlich (z.B. Vokabeln)</label>
          <select value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))}>
            <option value={0}>Nur diese eine Woche</option>
            <option value={1}>+ 1 weitere Woche</option>
            <option value={4}>+ 4 weitere Wochen</option>
            <option value={8}>+ 8 weitere Wochen</option>
          </select>

          {user.priorities_enabled && (
            <>
              <label className="field-label">Dringlichkeit</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
                <option value="">Normal</option>
                <option value="niedrig">Niedrig</option>
                <option value="normal">Normal</option>
                <option value="hoch">Hoch</option>
              </select>
            </>
          )}

          <button type="submit">Speichern</button>
        </form>
      )}

      {error && <p style={{ color: "#f19999" }}>{error}</p>}

      {items.length > 0 && (
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <input
            placeholder="Hausaufgaben durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 180, marginBottom: 0 }}
          />
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            <option value="">Alle Fächer</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 && !showForm && (
        <div className="empty-state">Keine Hausaufgaben vorhanden.</div>
      )}

      {renderGroup("Heute", today)}
      {renderGroup("Diese Woche", thisWeek)}
      {renderGroup("Später", later)}

      {suggestion && token && (
        <SuggestionModal
          token={token}
          suggestion={suggestion}
          subjects={subjects}
          onApplied={() => {
            setSuggestion(null);
            refresh();
            showToast("Hausaufgabe gespeichert");
          }}
          onDismissed={() => setSuggestion(null)}
        />
      )}

      {viewing && (
        <AttachmentViewer
          url={attachmentDownloadUrl(viewing.hwId, viewing.attachmentId)}
          filename={viewing.filename}
          contentType={viewing.contentType}
          onClose={() => setViewing(null)}
        />
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
