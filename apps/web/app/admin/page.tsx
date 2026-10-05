"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createSubject,
  deleteSubject,
  fetchClassStats,
  fetchMembers,
  fetchMySubjects,
  Member,
  Subject,
  SubjectStat,
  User,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { BookIcon, TrendIcon, UsersIcon } from "../../components/icons";

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<SubjectStat[]>([]);
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
    </AppShell>
  );
}
