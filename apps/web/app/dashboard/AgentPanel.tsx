"use client";

import { useEffect, useState } from "react";
import { chatWithAgent, fetchAgentSummary, fetchWorkload, Workload } from "../../lib/api";

const LEVEL_LABEL: Record<Workload["level"], string> = {
  green: "Entspannt",
  yellow: "Machbar",
  red: "Eng",
};

type Message = { role: "user" | "agent"; text: string };

export default function AgentPanel({ token }: { token: string }) {
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetchWorkload(token).then(setWorkload).catch(() => {});
    fetchAgentSummary(token).then((s) => setSummary(s.summary)).catch(() => {});
  }, [token]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await chatWithAgent(token, q);
      setMessages((m) => [...m, { role: "agent", text: res.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "Der Agent konnte nicht erreicht werden." }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="card">
      <div className="workload-row">
        {workload && <span className={`pill ${workload.level}`}>{LEVEL_LABEL[workload.level]}</span>}
        {workload && <span className="muted" style={{ fontSize: 14 }}>{workload.message}</span>}
      </div>

      {summary && <p className="muted" style={{ marginBottom: 14 }}>{summary}</p>}

      {messages.length > 0 && (
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>{m.text}</div>
          ))}
        </div>
      )}

      <form onSubmit={ask} className="row">
        <input
          placeholder="Frage an den Agenten, z.B. „Wie viel Zeit brauche ich noch für Mathe?“"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <button type="submit" disabled={asking}>{asking ? "..." : "Senden"}</button>
      </form>
    </div>
  );
}
