"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flashcard, generateFlashcards } from "../../lib/api";

export default function FlashcardsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
  }, [router]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !text.trim()) return;
    setBusy(true);
    setError(null);
    setCards([]);
    setFlipped({});
    try {
      const res = await generateFlashcards(token, text);
      setCards(res.cards);
      if (res.cards.length === 0) setError("Der Agent konnte daraus keine Karteikarten erstellen.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div>
      <div className="top-bar">
        <h1>Karteikarten</h1>
        <a href="/dashboard"><button className="secondary">Zurück</button></a>
      </div>

      <form onSubmit={handleGenerate} className="card">
        <textarea
          placeholder="Lernstoff einfügen, z.B. aus deinem Heft oder Buch..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ height: 140 }}
        />
        <button type="submit" disabled={busy}>{busy ? "Erstellt Karteikarten..." : "Karteikarten erstellen"}</button>
      </form>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {cards.map((card, i) => (
        <div
          key={i}
          className="card"
          style={{ cursor: "pointer" }}
          onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
        >
          <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
            {flipped[i] ? "ANTWORT (klicken zum Umdrehen)" : "FRAGE (klicken zum Umdrehen)"}
          </p>
          <p style={{ fontSize: 16 }}>{flipped[i] ? card.answer : card.question}</p>
        </div>
      ))}
    </div>
  );
}
