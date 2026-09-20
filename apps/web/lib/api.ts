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
  agent_tone: "locker" | "streng";
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

export type DeckSummary = {
  id: string;
  title: string;
  created_at: string;
  card_count: number;
  due_count: number;
};

export type FlashcardOut = {
  id: string;
  question: string;
  answer: string;
  box: number;
  next_review_at: string;
  due: boolean;
};

export type DeckDetail = DeckSummary & { cards: FlashcardOut[] };

export async function fetchDecks(token: string): Promise<DeckSummary[]> {
  const res = await fetch(`${API_BASE}/flashcards/decks`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Karteikarten-Decks nicht laden");
  return res.json();
}

export async function fetchDeck(token: string, deckId: string): Promise<DeckDetail> {
  const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}`, { headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error("Konnte Deck nicht laden");
  return res.json();
}

export async function createDeck(
  token: string,
  { title, text, file }: { title?: string; text?: string; file?: File }
): Promise<DeckDetail> {
  const form = new FormData();
  if (title) form.append("title", title);
  if (text) form.append("text", text);
  if (file) form.append("file", file);
  const res = await fetch(`${API_BASE}/flashcards/decks`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) {
    if (res.status === 503) throw new Error("KI-Agent (Ollama) ist gerade nicht erreichbar.");
    throw new Error("Konnte Deck nicht erstellen");
  }
  return res.json();
}

export async function addCard(token: string, deckId: string, question: string, answer: string): Promise<FlashcardOut> {
  const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) throw new Error("Konnte Karte nicht hinzufügen");
  return res.json();
}

export async function deleteDeck(token: string, deckId: string) {
  const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Deck nicht löschen (nur Ersteller oder Admin)");
}

export async function deleteCard(token: string, cardId: string) {
  const res = await fetch(`${API_BASE}/flashcards/cards/${cardId}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error("Konnte Karte nicht löschen");
}

export async function reviewCard(token: string, cardId: string, result: "know" | "again"): Promise<FlashcardOut> {
  const res = await fetch(`${API_BASE}/flashcards/cards/${cardId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) throw new Error("Konnte Wiederholung nicht speichern");
  return res.json();
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

export async function createHomeworkWithRepeat(
  token: string,
  payload: {
    title: string;
    description?: string;
    due_at: string;
    subject_id: string;
    estimated_minutes?: number;
    repeat_weeks?: number;
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
