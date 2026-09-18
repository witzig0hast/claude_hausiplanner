"use client";

import { useEffect, useState } from "react";
import { chatWithAgent, fetchAgentSummary, fetchWorkload, Workload } from "../../lib/api";

const LEVEL_COLOR: Record<Workload["level"], string> = {
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
};

const LEVEL_LABEL: Record<Workload["level"], string> = {
  green: "Entspannt",
  yellow: "Machbar",
  red: "Eng",
};

export default function AgentPanel({ token }: { token: string }) {
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetchWorkload(token).then(setWorkload).catch(() => {});
    fetchAgentSummary(token).then((s) => setSummary(s.summary)).catch(() => {});
  }, [token]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await chatWithAgent(token, question);
      setAnswer(res.answer);
    } catch {
      setAnswer("Konnte den Agenten nicht erreichen.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="card">
      {workload && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: LEVEL_COLOR[workload.level],
              display: "inline-block",
            }}
          />
          <strong>{LEVEL_LABEL[workload.level]}</strong>
          <span style={{ color: "var(--muted)" }}>· {workload.message}</span>
        </div>
      )}
      {summary && <p style={{ color: "var(--muted)", marginBottom: 12 }}>{summary}</p>}

      <form onSubmit={ask} className="row">
        <input
          placeholder="Frag den Agenten, z.B. 'Wie viel Zeit brauche ich noch für Mathe?'"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" disabled={asking}>{asking ? "..." : "Fragen"}</button>
      </form>
      {answer && <p style={{ marginTop: 10 }}>{answer}</p>}
    </div>
  );
}
