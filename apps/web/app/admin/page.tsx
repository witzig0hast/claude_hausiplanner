"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Course,
  createCourse,
  createSubject,
  deleteCourse,
  deleteSubject,
  fetchClassStats,
  fetchCourses,
  fetchMembers,
  fetchMyClass,
  fetchMySubjects,
  Member,
  SchoolClass,
  setOrganizationMode,
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
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseSubjectId, setCourseSubjectId] = useState("");
  const [modeBusy, setModeBusy] = useState(false);

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
      const [subj, mem, classStats, cls, crs] = await Promise.all([
        fetchMySubjects(token),
        fetchMembers(token),
        fetchClassStats(token),
        fetchMyClass(token),
        fetchCourses(token),
      ]);
      setSubjects(subj);
      setMembers(mem);
      setStats(classStats);
      setSchoolClass(cls);
      setCourses(crs);
    } catch {
      setError("Konnte Daten nicht laden.");
    }
  }

  async function handleSetMode(mode: "timetable" | "courses") {
    if (!token || modeBusy) return;
    setModeBusy(true);
    try {
      const updated = await setOrganizationMode(token, mode);
      setSchoolClass(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setModeBusy(false);
    }
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !courseName) return;
    try {
      await createCourse(token, { name: courseName, subject_id: courseSubjectId || null });
      setCourseName("");
      setCourseSubjectId("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteCourse(id: string) {
    if (!token) return;
    if (!confirm("Kurs wirklich löschen? Alle Mitgliedschaften gehen verloren.")) return;
    await deleteCourse(token, id);
    refresh();
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !subjectName) return;
    try {
      await createSubject(token, { name: subjectName });
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

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

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
          <span className="card-header-icon"><UsersIcon size={16} /></span>
          <div>
            <div className="card-header-title">Organisation</div>
            <div className="card-header-sub">
              Stundenplan: ein gemeinsamer Wochenplan für alle. Kurssystem: kein fester Plan,
              Mitglieder wählen sich stattdessen in einzelne Kurse ein (z.B. Oberstufe).
            </div>
          </div>
        </div>
        <div className="toggle-group" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={schoolClass?.organization_mode === "timetable" ? "active" : ""}
            onClick={() => handleSetMode("timetable")}
            disabled={modeBusy}
          >
            Stundenplan
          </button>
          <button
            type="button"
            className={schoolClass?.organization_mode === "courses" ? "active" : ""}
            onClick={() => handleSetMode("courses")}
            disabled={modeBusy}
          >
            Kurssystem
          </button>
        </div>

        <p className="field-label" style={{ marginBottom: 6 }}>Kurse</p>
        <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
          Z.B. "Religion katholisch"/"Religion evangelisch"/"Ethik" nebeneinander, oder im
          Kurssystem "Mathe LK"/"Mathe GK". Mitglieder wählen in den Einstellungen selbst einen
          Kurs pro Fach (bei fachlosen Kursen beliebig viele); Hausaufgaben für einen Kurs sehen
          nur dessen Mitglieder.
        </p>
        <form onSubmit={handleAddCourse} className="row" style={{ marginBottom: 16 }}>
          <input
            placeholder="Neuer Kurs, z.B. Mathe LK"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <select value={courseSubjectId} onChange={(e) => setCourseSubjectId(e.target.value)} style={{ marginBottom: 0, flexShrink: 0, width: 160 }}>
            <option value="">Kein Fach</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" style={{ flexShrink: 0 }}>Hinzufügen</button>
        </form>
        {courses.length === 0 && <p className="muted">Noch keine Kurse angelegt.</p>}
        <div className="stack">
          {courses.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {c.name}{" "}
                <span className="faint">
                  · {c.member_count} Mitglied{c.member_count === 1 ? "" : "er"}
                  {c.subject_id && ` · ${subjects.find((s) => s.id === c.subject_id)?.name ?? ""}`}
                </span>
              </span>
              <button className="ghost" onClick={() => handleDeleteCourse(c.id)}>Löschen</button>
            </div>
          ))}
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
                <span className="subject-tag" style={{ marginBottom: 0 }}>{s.subject_name}</span>
                <span className="faint">
                  {s.homework_count} Aufgabe{s.homework_count === 1 ? "" : "n"} · {Math.round(s.avg_completion_rate * 100)}% erledigt
                </span>
              </div>
              <div style={{ height: 6, background: "var(--surface-alt)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(s.avg_completion_rate * 100)}%`,
                    background: "var(--accent)",
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
          <button type="submit" style={{ flexShrink: 0 }}>Hinzufügen</button>
        </form>
        <div className="stack">
          {subjects.map((s) => (
            <div key={s.id} className="row" style={{ justifyContent: "space-between" }}>
              <span className="subject-tag" style={{ marginBottom: 0 }}>{s.name}</span>
              <button className="ghost" onClick={() => handleDeleteSubject(s.id)}>Löschen</button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
