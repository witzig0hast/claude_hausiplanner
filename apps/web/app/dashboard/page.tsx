"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createHomework,
  fetchMyHomework,
  fetchMySubjects,
  Homework,
  Subject,
  toggleComplete,
  User,
} from "../../lib/api";
import { Logo } from "../../components/Logo";
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

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    await toggleComplete(token, hw.id, !hw.completed_by_me);
    refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !subjectId || !dueAt) return;
    await createHomework(token, {
      title,
      description: description || undefined,
      due_at: new Date(dueAt).toISOString(),
      subject_id: subjectId,
    });
    setTitle("");
    setDescription("");
    setDueAt("");
    setShowForm(false);
    refresh();
  }

  function logout() {
    localStorage.removeItem("hausiplanner_token");
    localStorage.removeItem("hausiplanner_user");
    router.push("/login");
  }

  if (!user) return null;

  const openCount = items.filter((i) => !i.completed_by_me).length;

  return (
    <div>
      <div className="nav-bar">
        <Logo href="/dashboard" />
        <div className="row">
          <a href="/flashcards"><button className="ghost">Karteikarten</button></a>
          <a href="/settings"><button className="ghost">Einstellungen</button></a>
          <button className="ghost" onClick={logout}>Abmelden</button>
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <h1>{user.display_name}</h1>
        <p className="subtitle">
          {openCount === 0 ? "Keine offenen Hausaufgaben." : `${openCount} offene Hausaufgabe${openCount === 1 ? "" : "n"}.`}
        </p>
      </div>

      {token && <AgentPanel token={token} />}

      {subjects.length === 0 && (
        <div className="card warn">
          <strong>Keine Fächer angelegt.</strong>{" "}
          <span className="muted">{user.is_class_admin ? "Fächer werden in den Einstellungen verwaltet." : "Der Klassen-Admin muss zunächst Fächer anlegen."}</span>
        </div>
      )}

      <button onClick={() => setShowForm(!showForm)}>{showForm ? "Abbrechen" : "Hausaufgabe hinzufügen"}</button>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 14 }}>
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
          <button type="submit">Speichern</button>
        </form>
      )}

      {error && <p style={{ color: "#f19999" }}>{error}</p>}

      <div style={{ marginTop: 24 }}>
        {items.length === 0 && !showForm && (
          <div className="empty-state">Keine Hausaufgaben vorhanden.</div>
        )}
        {items.map((hw) => (
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
    </div>
  );
}
