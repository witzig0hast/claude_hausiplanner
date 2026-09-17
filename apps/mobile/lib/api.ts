import Constants from "expo-constants";

export const API_BASE = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:8000";

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

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handle<{ access_token: string; user: User }>(res);
}

export async function register(email: string, password: string, display_name: string, invite_code?: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name, invite_code }),
  });
  return handle<{ access_token: string; user: User }>(res);
}

export async function fetchMyHomework(token: string) {
  const res = await fetch(`${API_BASE}/homework`, { headers: authHeaders(token) });
  return handle<Homework[]>(res);
}

export async function fetchMySubjects(token: string) {
  const res = await fetch(`${API_BASE}/classes/me/subjects`, { headers: authHeaders(token) });
  return handle<Subject[]>(res);
}

export async function createHomework(
  token: string,
  payload: { title: string; description?: string; due_at: string; subject_id: string }
) {
  const res = await fetch(`${API_BASE}/homework`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  return handle<Homework>(res);
}

export async function toggleComplete(token: string, homeworkId: string, done: boolean) {
  const res = await fetch(`${API_BASE}/homework/${homeworkId}/complete`, {
    method: done ? "POST" : "DELETE",
    headers: authHeaders(token),
  });
  return handle<Homework>(res);
}

export async function fetchAgentSummary(token: string) {
  const res = await fetch(`${API_BASE}/agent/summary`, { headers: authHeaders(token) });
  return handle<{ summary: string; generated_at: string }>(res);
}

export async function registerPushToken(token: string, expoPushToken: string, platform: "ios" | "android") {
  const res = await fetch(`${API_BASE}/push/register-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ token: expoPushToken, platform }),
  });
  return handle<void>(res);
}
