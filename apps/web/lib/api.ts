export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Subject = { id: string; name: string; color: string; icon: string };

export type Priority = "niedrig" | "normal" | "hoch";

export type Homework = {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  estimated_minutes: number | null;
  priority: Priority | null;
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
  email_reminders_enabled: boolean;
  digest_enabled: boolean;
  deadline_push_enabled: boolean;
  priorities_enabled: boolean;
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Surfaces the backend's actual error (FastAPI's {"detail": "..."} shape) instead of a
// generic message, so misconfiguration (wrong API URL, CORS, etc.) is diagnosable from
// the UI instead of failing silently with no clue why.
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // not JSON - fall through to the generic message
  }
  return `${fallback} (${res.status})`;
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
  if (!res.ok) throw new Error(await errorMessage(res, "Login fehlgeschlagen"));
  return res.json();
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
  if (!res.ok) throw new Error(await errorMessage(res, "Registrierung fehlgeschlagen"));
  return res.json();
}

export async function fetchMyHomework(token: string): Promise<Homework[]> {
  const res = await fetch(`${API_BASE}/homework`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Hausaufgaben nicht laden");
  return res.json();
}

export async function createHomework(
  token: string,
  payload: {
    title: string;
    description?: string;
    due_at: string;
    subject_id: string;
    estimated_minutes?: number;
    priority?: Priority;
  }
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

export async function deleteHomework(token: string, homeworkId: string) {
  const res = await fetch(`${API_BASE}/homework/${homeworkId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Konnte Hausaufgabe nicht löschen");
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

export type LessonPeriod = { id: string; number: number; start_time: string; end_time: string };

export async function fetchLessonPeriods(token: string): Promise<LessonPeriod[]> {
  const res = await fetch(`${API_BASE}/classes/me/periods`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Stunden-Raster nicht laden");
  return res.json();
}

export async function createLessonPeriod(
  token: string,
  payload: { number: number; start_time: string; end_time: string }
): Promise<LessonPeriod> {
  const res = await fetch(`${API_BASE}/classes/me/periods`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Stunde nicht anlegen (nur Admin)");
  return res.json();
}

export async function deleteLessonPeriod(token: string, periodId: string) {
  const res = await fetch(`${API_BASE}/classes/me/periods/${periodId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Konnte Stunde nicht löschen");
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

export async function updateCalendarEvent(
  token: string,
  eventId: string,
  payload: {
    title: string;
    starts_at: string;
    ends_at: string;
    is_recurring_weekly: boolean;
    weekday: number | null;
    subject_id?: string | null;
  }
) {
  const res = await fetch(`${API_BASE}/calendar/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Termin nicht ändern (nur Admin)");
  return res.json();
}

export async function deleteCalendarEvent(token: string, eventId: string) {
  const res = await fetch(`${API_BASE}/calendar/${eventId}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Termin nicht löschen");
}

export type TimetableEntrySuggestion = {
  subject_guess: string;
  subject_raw: string | null;
  weekday_guess: string;
  starts_at_guess: string;
  ends_at_guess: string;
};

export type TimetableSuggestion = {
  entries: TimetableEntrySuggestion[];
  raw_model_output: string;
  low_confidence: boolean;
};

export async function extractTimetableFromImage(
  token: string,
  file: File,
  weekday?: string
): Promise<TimetableSuggestion> {
  const form = new FormData();
  form.append("file", file);
  if (weekday) form.append("weekday", weekday);
  const res = await fetch(`${API_BASE}/calendar/extract-from-image`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) {
    if (res.status === 503) throw new Error("KI-Agent (Ollama) ist gerade nicht erreichbar.");
    throw new Error("Konnte Stundenplan nicht erkennen");
  }
  return res.json();
}

export async function postponeToNextLesson(token: string, homeworkId: string): Promise<Homework> {
  const res = await fetch(`${API_BASE}/homework/${homeworkId}/postpone-to-next-lesson`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 422) throw new Error("Kein Stundenplan-Eintrag für dieses Fach hinterlegt");
    throw new Error("Konnte Hausaufgabe nicht verschieben");
  }
  return res.json();
}

export type Workload = {
  level: "green" | "yellow" | "red";
  minutes_needed: number;
  minutes_available: number;
  message: string;
};

export async function fetchWorkload(token: string): Promise<Workload> {
  const res = await fetch(`${API_BASE}/agent/workload`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Workload nicht laden");
  return res.json();
}

export async function fetchAgentSummary(token: string): Promise<{ summary: string }> {
  const res = await fetch(`${API_BASE}/agent/summary`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Zusammenfassung nicht laden");
  return res.json();
}

export async function chatWithAgent(token: string, question: string): Promise<{ answer: string }> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Konnte Frage nicht stellen");
  return res.json();
}

export async function setAgentTone(token: string, tone: "locker" | "streng"): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me/tone`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ tone }),
  });
  if (!res.ok) throw new Error("Konnte Tonfall nicht ändern");
  return res.json();
}

export async function setEmailReminders(token: string, enabled: boolean): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me/email-reminders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Konnte E-Mail-Erinnerungen nicht ändern");
  return res.json();
}

export async function setNotificationPrefs(
  token: string,
  prefs: { digest_enabled: boolean; deadline_push_enabled: boolean }
): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me/notifications`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Konnte Benachrichtigungen nicht ändern");
  return res.json();
}

export async function setPrioritiesEnabled(token: string, enabled: boolean): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me/priorities`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Konnte Dringlichkeitsstufen nicht ändern");
  return res.json();
}

export async function sendTestEmail(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/me/test-email`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Konnte Test-E-Mail nicht senden"));
}

export type Member = { id: string; display_name: string; email: string; is_class_admin: boolean };

export async function fetchMembers(token: string): Promise<Member[]> {
  const res = await fetch(`${API_BASE}/classes/me/members`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Mitglieder nicht laden");
  return res.json();
}

export async function promoteMember(token: string, userId: string): Promise<Member> {
  const res = await fetch(`${API_BASE}/classes/me/members/${userId}/promote`, {
    method: "PUT",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Konnte Mitglied nicht befördern");
  return res.json();
}

export async function demoteMember(token: string, userId: string): Promise<Member> {
  const res = await fetch(`${API_BASE}/classes/me/members/${userId}/demote`, {
    method: "PUT",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 409) throw new Error("Es muss mindestens ein Admin übrig bleiben");
    throw new Error("Konnte Admin-Rechte nicht entziehen");
  }
  return res.json();
}

export type SubjectStat = {
  subject_id: string;
  subject_name: string;
  subject_color: string;
  homework_count: number;
  avg_completion_rate: number;
};

export async function fetchClassStats(token: string): Promise<SubjectStat[]> {
  const res = await fetch(`${API_BASE}/classes/me/stats`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Statistik nicht laden (nur Admin)");
  return res.json();
}

export async function downloadIcsExport(token: string) {
  const res = await fetch(`${API_BASE}/homework/export.ics`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Kalenderexport nicht laden");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hausaufgaben.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export type PendingSuggestion = {
  id: string;
  raw_transcript: string;
  subject_guess: string | null;
  subject: Subject | null;
  title: string;
  description: string | null;
  due_date_guess: string | null;
  due_time_guess: string | null;
  due_is_estimated: boolean;
  created_at: string;
};

export async function captureVoiceNote(token: string, audio: Blob): Promise<PendingSuggestion> {
  const form = new FormData();
  form.append("file", audio, "note.webm");
  const res = await fetch(`${API_BASE}/voice/capture`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) {
    if (res.status === 503) throw new Error("Spracherkennung oder KI-Agent ist gerade nicht erreichbar.");
    if (res.status === 422) throw new Error("Konnte nichts aus der Aufnahme verstehen.");
    throw new Error("Konnte Aufnahme nicht verarbeiten");
  }
  return res.json();
}

export async function fetchPendingSuggestion(token: string): Promise<PendingSuggestion | null> {
  const res = await fetch(`${API_BASE}/voice/pending-suggestion`, { headers: authHeaders(token), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Konnte Vorschlag nicht laden");
  return res.json();
}

export async function applySuggestion(
  token: string,
  payload: { title: string; description?: string; due_at: string; subject_id: string; estimated_minutes?: number }
): Promise<Homework> {
  const res = await fetch(`${API_BASE}/voice/pending-suggestion/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Hausaufgabe nicht speichern");
  return res.json();
}

export async function dismissSuggestion(token: string) {
  const res = await fetch(`${API_BASE}/voice/pending-suggestion`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Vorschlag nicht verwerfen");
}

export async function createHomeworkWithRepeat(
  token: string,
  payload: {
    title: string;
    description?: string;
    due_at: string;
    subject_id: string;
    estimated_minutes?: number;
    repeat_weeks?: number;
    priority?: Priority;
  }
) {
  const res = await fetch(`${API_BASE}/homework`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Konnte Hausaufgabe nicht erstellen");
  return res.json();
}

export type AgentBusStatus = { connected: boolean; enabled: boolean; base_url: string };

export type AgentBusLogEntry = {
  id: string;
  remote_id: string;
  direction: "inbound" | "outbound";
  peer_label: string;
  kind: "text" | "task";
  content: string | null;
  task_type: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  result: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchAgentBusStatus(token: string): Promise<AgentBusStatus> {
  const res = await fetch(`${API_BASE}/agent-bus/status`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Agent-Bus-Status nicht laden");
  return res.json();
}

export async function connectAgentBus(token: string, apiKey: string, baseUrl?: string): Promise<AgentBusStatus> {
  const res = await fetch(`${API_BASE}/agent-bus/connect`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ api_key: apiKey, base_url: baseUrl || undefined }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Konnte Agent Bus nicht verbinden"));
  return res.json();
}

export async function disconnectAgentBus(token: string): Promise<AgentBusStatus> {
  const res = await fetch(`${API_BASE}/agent-bus/connect`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Agent Bus nicht trennen");
  return res.json();
}

export async function setAgentBusEnabled(token: string, enabled: boolean): Promise<AgentBusStatus> {
  const res = await fetch(`${API_BASE}/agent-bus/enabled`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Konnte Agent Bus nicht umschalten");
  return res.json();
}

export async function fetchAgentBusLog(token: string): Promise<AgentBusLogEntry[]> {
  const res = await fetch(`${API_BASE}/agent-bus/log`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Agent-Bus-Log nicht laden");
  return res.json();
}
