"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flashcard, generateFlashcards } from "../../lib/api";
import { Logo } from "../../components/Logo";

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
      <div className="nav-bar">
        <Logo href="/dashboard" />
        <a href="/dashboard"><button className="ghost">← Zurück</button></a>
      </div>

      <h1>Karteikarten 🃏</h1>
      <p className="subtitle">Lernstoff einfügen, der Agent macht daraus Frage-Antwort-Karten zum Üben.</p>

      <form onSubmit={handleGenerate} className="card">
        <textarea
          placeholder="z.B. aus deinem Heft oder Buch abtippen..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ height: 140 }}
        />
        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "✨ Erstellt Karteikarten..." : "Karteikarten erstellen"}
        </button>
      </form>

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

      {cards.length > 0 && (
        <>
          <p className="section-title">{cards.length} Karte{cards.length === 1 ? "" : "n"} · zum Umdrehen klicken</p>
          <div className="stack">
            {cards.map((card, i) => (
              <div
                key={i}
                className={`flip-card ${flipped[i] ? "flipped" : ""}`}
                onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
              >
                <div className="flip-card-inner">
                  <div className="flip-card-face front">
                    <div className="flip-card-label">❓ Frage</div>
                    <div className="flip-card-text">{card.question}</div>
                  </div>
                  <div className="flip-card-face back">
                    <div className="flip-card-label">💡 Antwort</div>
                    <div className="flip-card-text">{card.answer}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
