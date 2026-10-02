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
  agent_tone: "locker" | "streng";
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

export async function register(
  email: string,
  password: string,
  display_name: string,
  invite_code?: string,
  class_name?: string
) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name, invite_code, class_name }),
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

export async function deleteHomework(token: string, homeworkId: string) {
  const res = await fetch(`${API_BASE}/homework/${homeworkId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handle<void>(res);
}

export type HomeworkSuggestion = {
  subject_guess: string | null;
  title: string;
  description: string | null;
  due_date_guess: string | null;
  raw_model_output: string;
};

export async function extractHomeworkFromImage(token: string, imageUri: string): Promise<HomeworkSuggestion> {
  const form = new FormData();
  // React Native's fetch accepts this shape for a file field, even though it isn't a real `Blob`.
  form.append("file", { uri: imageUri, name: "homework.jpg", type: "image/jpeg" } as unknown as Blob);

  const res = await fetch(`${API_BASE}/homework/extract-from-image`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  return handle<HomeworkSuggestion>(res);
}

export async function fetchAgentSummary(token: string) {
  const res = await fetch(`${API_BASE}/agent/summary`, { headers: authHeaders(token) });
  return handle<{ summary: string; generated_at: string }>(res);
}

export type StudySuggestion = {
  homework_id: string;
  title: string;
  subject_name: string;
  start: string;
  end: string;
  minutes: number;
};

export type FreeSlot = { start: string; end: string };

export type PlanningResult = {
  free_slots: FreeSlot[];
  suggestions: StudySuggestion[];
  unscheduled: string[];
};

export async function fetchPlanning(token: string, daysAhead = 7): Promise<PlanningResult> {
  const res = await fetch(`${API_BASE}/planning?days_ahead=${daysAhead}`, { headers: authHeaders(token) });
  return handle<PlanningResult>(res);
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
  const res = await fetch(`${API_BASE}/calendar`, { headers: authHeaders(token) });
  return handle<CalendarEvent[]>(res);
}

export type Workload = {
  level: "green" | "yellow" | "red";
  minutes_needed: number;
  minutes_available: number;
  message: string;
};

export async function fetchWorkload(token: string): Promise<Workload> {
  const res = await fetch(`${API_BASE}/agent/workload`, { headers: authHeaders(token) });
  return handle<Workload>(res);
}

export async function chatWithAgent(token: string, question: string): Promise<{ answer: string }> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ question }),
  });
  return handle<{ answer: string }>(res);
}

export async function setAgentTone(token: string, tone: "locker" | "streng"): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me/tone`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ tone }),
  });
  return handle<User>(res);
}

export async function registerPushToken(token: string, expoPushToken: string, platform: "ios" | "android") {
  const res = await fetch(`${API_BASE}/push/register-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ token: expoPushToken, platform }),
  });
  return handle<void>(res);
}
