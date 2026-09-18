export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Subject = { id: string; name: string; color: string; icon: string };

export type Homework = {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  estimated_minutes: number | null;
  subject: Subject;
  completed_by_me: boolean;
  completed_count: number;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  is_class_admin: boolean;
  school_class_id: string | null;
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPublicHomework(classId: string): Promise<Homework[]> {
  const res = await fetch(`${API_BASE}/public/classes/${classId}/homework`, { cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Hausaufgaben nicht laden");
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login fehlgeschlagen");
  return res.json();
}

export async function register(
  email: string,
  password: string,
  display_name: string,
  invite_code?: string
) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name, invite_code }),
  });
  if (!res.ok) throw new Error("Registrierung fehlgeschlagen");
  return res.json();
}

export async function fetchMyHomework(token: string): Promise<Homework[]> {
  const res = await fetch(`${API_BASE}/homework`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Hausaufgaben nicht laden");
  return res.json();
}

export async function createHomework(
  token: string,
  payload: { title: string; description?: string; due_at: string; subject_id: string; estimated_minutes?: number }
) {
  const res = await fetch(`${API_BASE}/homework`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Hausaufgabe nicht erstellen");
  return res.json();
}

export async function toggleComplete(token: string, homeworkId: string, done: boolean) {
  const res = await fetch(`${API_BASE}/homework/${homeworkId}/complete`, {
    method: done ? "POST" : "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Konnte Status nicht ändern");
  return res.json();
}

export async function fetchMySubjects(token: string): Promise<Subject[]> {
  const res = await fetch(`${API_BASE}/classes/me/subjects`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Fächer nicht laden");
  return res.json();
}

export async function createSubject(token: string, payload: { name: string; color: string; icon?: string }) {
  const res = await fetch(`${API_BASE}/classes/me/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ icon: "book", ...payload }),
  });
  if (!res.ok) throw new Error("Konnte Fach nicht erstellen (nur Admin)");
  return res.json();
}

export async function deleteSubject(token: string, subjectId: string) {
  const res = await fetch(`${API_BASE}/classes/me/subjects/${subjectId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Konnte Fach nicht löschen");
}

export type ClassInvite = { invite_code: string; join_url: string; public_view_url: string };

export async function fetchInvite(token: string): Promise<ClassInvite> {
  const res = await fetch(`${API_BASE}/classes/me/invite`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Einladung nicht laden");
  return res.json();
}

export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_recurring_weekly: boolean;
  weekday: number | null;
  subject_id: string | null;
};

export async function fetchCalendarEvents(token: string): Promise<CalendarEvent[]> {
  const res = await fetch(`${API_BASE}/calendar`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Kalender nicht laden");
  return res.json();
}

export async function createCalendarEvent(
  token: string,
  payload: {
    title: string;
    starts_at: string;
    ends_at: string;
    is_recurring_weekly: boolean;
    weekday: number | null;
    subject_id?: string | null;
  }
) {
  const res = await fetch(`${API_BASE}/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Termin nicht erstellen (nur Admin)");
  return res.json();
}

export async function deleteCalendarEvent(token: string, eventId: string) {
  const res = await fetch(`${API_BASE}/calendar/${eventId}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Termin nicht löschen");
}
