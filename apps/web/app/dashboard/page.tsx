"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createHomeworkWithRepeat,
  fetchMyHomework,
  fetchMySubjects,
  Homework,
  Subject,
  toggleComplete,
  User,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToastProvider, useToast } from "../../components/Toast";
import { ClockIcon, ListIcon, PlusIcon, TrendIcon } from "../../components/icons";
import AgentPanel from "./AgentPanel";

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
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + (7 - startOfToday.getDay() + 1) * 24 * 60 * 60 * 1000);

  const today: Homework[] = [];
  const thisWeek: Homework[] = [];
  const later: Homework[] = [];

  for (const hw of items) {
    const due = new Date(hw.due_at);
    if (due < endOfToday) today.push(hw);
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
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

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
  }, [token]);

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
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      setRepeatWeeks(0);
      setShowForm(false);
      refresh();
      showToast("Hausaufgabe gespeichert");
    } catch {
      showToast("Konnte Hausaufgabe nicht speichern", "error");
    }
  }

  if (!user) return null;

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
              <span className="subject-tag">
                <span className="subject-dot" style={{ background: hw.subject.color }} />
                {hw.subject.name}
              </span>
              <h3>{hw.title}</h3>
              {hw.description && <p className="muted" style={{ marginTop: 6 }}>{hw.description}</p>}
              <p className="due">
                Fällig {formatDue(hw.due_at)}
                {hw.completed_count > 0 && <span> · {hw.completed_count} Mitschüler erledigt</span>}
              </p>
              <button
                className={hw.completed_by_me ? "secondary" : ""}
                style={{ marginTop: 14, width: "100%" }}
                onClick={() => handleToggle(hw)}
              >
                {hw.completed_by_me ? "Als offen markieren" : "Als erledigt markieren"}
              </button>
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
        <button onClick={() => setShowForm(!showForm)}>
          <span className="row" style={{ gap: 6 }}>
            <PlusIcon size={15} /> Hausaufgabe
          </span>
        </button>
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
