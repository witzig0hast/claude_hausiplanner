"use client";

import { useEffect, useState } from "react";
import { chatWithAgent, fetchAgentSummary, fetchWorkload, Workload } from "../../lib/api";
import { SparkleIcon } from "../../components/icons";

const LEVEL_LABEL: Record<Workload["level"], string> = {
  green: "Entspannt",
  yellow: "Machbar",
  red: "Eng",
};

const LEVEL_COLOR: Record<Workload["level"], string> = {
  green: "var(--accent)",
  yellow: "#f0b84e",
  red: "var(--red)",
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

  const loadPercent =
    workload && workload.minutes_available > 0
      ? Math.min(100, Math.round((workload.minutes_needed / workload.minutes_available) * 100))
      : workload
      ? Math.min(100, workload.minutes_needed > 0 ? 100 : 0)
      : 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-icon"><SparkleIcon size={16} /></span>
        <div>
          <div className="card-header-title">KI-Assistent</div>
          <div className="card-header-sub">Zusammenfassung, Auslastung &amp; Rückfragen</div>
        </div>
      </div>

      {workload && (
        <>
          <div className="workload-row" style={{ marginBottom: 8 }}>
            <span className={`pill ${workload.level}`}>{LEVEL_LABEL[workload.level]}</span>
            <span className="muted" style={{ fontSize: 14 }}>{workload.message}</span>
          </div>
          <div className="progress-track" style={{ marginBottom: 16 }}>
            <div
              className="progress-fill"
              style={{ width: `${loadPercent}%`, background: LEVEL_COLOR[workload.level] }}
            />
          </div>
        </>
      )}

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
