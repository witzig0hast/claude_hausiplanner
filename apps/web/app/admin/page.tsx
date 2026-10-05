"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AgentBusLogEntry,
  AgentBusStatus,
  createSubject,
  deleteSubject,
  fetchAgentBusLog,
  fetchAgentBusStatus,
  fetchClassStats,
  fetchMembers,
  fetchMySubjects,
  Member,
  Subject,
  SubjectStat,
  User,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { BookIcon, ShareIcon, TrendIcon, UsersIcon } from "../../components/icons";

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<SubjectStat[]>([]);
  const [busStatus, setBusStatus] = useState<AgentBusStatus | null>(null);
  const [busLog, setBusLog] = useState<AgentBusLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3B82F6");

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    const u = localStorage.getItem("hausiplanner_user");
    if (!t || !u) {
      router.push("/login");
      return;
    }
    const parsedUser: User = JSON.parse(u);
    if (!parsedUser.is_class_admin) {
      router.push("/dashboard");
      return;
    }
    setToken(t);
    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  async function refresh() {
    if (!token) return;
    try {
      const [subj, mem, classStats] = await Promise.all([
        fetchMySubjects(token),
        fetchMembers(token),
        fetchClassStats(token),
      ]);
      setSubjects(subj);
      setMembers(mem);
      setStats(classStats);
    } catch {
      setError("Konnte Daten nicht laden.");
    }
    try {
      const status = await fetchAgentBusStatus(token);
      setBusStatus(status);
      if (status.configured) setBusLog(await fetchAgentBusLog(token));
    } catch {
      // Agent Bus is optional - a failure here shouldn't block the rest of the admin page.
    }
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

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 style={{ marginBottom: 24 }}>Admin</h1>

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

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

      {busStatus?.configured && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon"><ShareIcon size={16} /></span>
            <div>
              <div className="card-header-title">OwnAI Agent Bus</div>
              <div className="card-header-sub">Letzte Nachrichten mit {busStatus.user_email}</div>
            </div>
          </div>
          {busLog.length === 0 && <p className="muted">Noch keine Nachrichten.</p>}
          <div className="stack">
            {busLog.map((entry) => (
              <div key={entry.id} className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div>
                    <strong>{entry.direction === "inbound" ? "Von" : "An"} {entry.peer_label}</strong>{" "}
                    <span className="faint">· {entry.kind === "text" ? "Text" : `Task: ${entry.task_type}`}</span>
                  </div>
                  {entry.content && <div className="muted">{entry.content}</div>}
                  {!!entry.result?.error && <div style={{ color: "#f19999" }}>{String(entry.result.error)}</div>}
                </div>
                <span className={`pill ${entry.status === "failed" ? "red" : entry.status === "completed" ? "green" : ""}`}>
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
