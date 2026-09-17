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
      setError("Konnte Daten nicht laden.");
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

  return (
    <div>
      <div className="top-bar">
        <h1>Hey {user.display_name}</h1>
        <button className="secondary" onClick={logout}>Ausloggen</button>
      </div>

      {subjects.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Noch keine Fächer angelegt. {user.is_class_admin ? "Lege welche über die API/App an." : "Bitte den Admin, Fächer anzulegen."}
        </p>
      )}

      <button onClick={() => setShowForm(!showForm)}>{showForm ? "Abbrechen" : "+ Hausaufgabe hinzufügen"}</button>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 12 }}>
          <input placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
          <button type="submit">Speichern</button>
        </form>
      )}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        {items.map((hw) => (
          <div key={hw.id} className={`card ${hw.completed_by_me ? "done" : ""}`}>
            <span className="subject-tag" style={{ background: hw.subject.color, color: "#0f1115" }}>
              {hw.subject.name}
            </span>
            <h3 style={{ margin: "4px 0" }}>{hw.title}</h3>
            {hw.description && <p style={{ color: "var(--muted)" }}>{hw.description}</p>}
            <p className="due">Fällig: {formatDue(hw.due_at)} · {hw.completed_count} Mitschüler erledigt</p>
            <button className={hw.completed_by_me ? "secondary" : ""} onClick={() => handleToggle(hw)}>
              {hw.completed_by_me ? "Als offen markieren" : "Als erledigt markieren (nur für mich)"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
