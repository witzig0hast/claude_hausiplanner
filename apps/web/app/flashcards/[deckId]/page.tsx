"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addCard, deleteCard, deleteDeck, DeckDetail, fetchDeck, FlashcardOut, reviewCard, User } from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { TrashIcon } from "../../../components/icons";

export default function DeckPage({ params }: { params: { deckId: string } }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [practicing, setPracticing] = useState(false);
  const [queue, setQueue] = useState<FlashcardOut[]>([]);
  const [current, setCurrent] = useState<FlashcardOut | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    const u = localStorage.getItem("hausiplanner_user");
    if (!t || !u) {
      router.push("/login");
      return;
    }
    setToken(t);
    setUser(JSON.parse(u));
    load(t);
  }, [router]);

  function load(t: string) {
    setLoading(true);
    fetchDeck(t, params.deckId)
      .then(setDeck)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  function startPractice() {
    if (!deck) return;
    const due = deck.cards.filter((c) => c.due);
    const list = due.length > 0 ? due : deck.cards;
    setQueue(list.slice(1));
    setCurrent(list[0] ?? null);
    setFlipped(false);
    setDone(list.length === 0);
    setPracticing(true);
  }

  async function handleReview(result: "know" | "again") {
    if (!token || !current) return;
    try {
      await reviewCard(token, current.id, result);
    } catch {
      // keep the practice flow moving even if the network hiccups
    }
    const next = queue[0] ?? null;
    setQueue((q) => q.slice(1));
    setCurrent(next);
    setFlipped(false);
    if (!next) setDone(true);
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !question.trim() || !answer.trim()) return;
    const card = await addCard(token, params.deckId, question.trim(), answer.trim());
    setDeck((d) => (d ? { ...d, cards: [...d.cards, card], card_count: d.card_count + 1, due_count: d.due_count + 1 } : d));
    setQuestion("");
    setAnswer("");
    setShowAdd(false);
  }

  async function handleDeleteCard(cardId: string) {
    if (!token || !deck) return;
    await deleteCard(token, cardId);
    setDeck({ ...deck, cards: deck.cards.filter((c) => c.id !== cardId), card_count: deck.card_count - 1 });
  }

  async function handleDeleteDeck() {
    if (!token) return;
    if (!confirm("Dieses Deck wirklich löschen? Das betrifft alle Mitschüler.")) return;
    await deleteDeck(token, params.deckId);
    router.push("/flashcards");
  }

  if (!token) return null;

  return (
    <AppShell user={user}>
      {loading && <p className="muted">Lädt...</p>}
      {error && <p style={{ color: "#f19999" }}>{error}</p>}

      {deck && !practicing && (
        <>
          <a href="/flashcards" className="faint" style={{ display: "inline-block", marginBottom: 10 }}>
            ← Alle Decks
          </a>
          <div className="top-bar">
            <div>
              <h1>{deck.title}</h1>
              <p className="subtitle" style={{ margin: 0 }}>
                {deck.card_count} Karte{deck.card_count === 1 ? "" : "n"} · {deck.due_count} fällig für dich
              </p>
            </div>
            <div className="row">
              <button onClick={startPractice} disabled={deck.cards.length === 0}>Üben</button>
              <button className="ghost" onClick={handleDeleteDeck}>Deck löschen</button>
            </div>
          </div>

          <button className="ghost" onClick={() => setShowAdd((s) => !s)} style={{ marginBottom: 16 }}>
            {showAdd ? "Abbrechen" : "+ Karte manuell hinzufügen"}
          </button>

          {showAdd && (
            <form onSubmit={handleAddCard} className="card" style={{ marginBottom: 20 }}>
              <input placeholder="Frage" value={question} onChange={(e) => setQuestion(e.target.value)} />
              <input placeholder="Antwort" value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <button type="submit" style={{ width: "100%" }}>Hinzufügen</button>
            </form>
          )}

          <p className="section-title">Karten</p>
          <div className="stack">
            {deck.cards.map((card) => (
              <div key={card.id} className="card">
                <div className="top-bar" style={{ marginBottom: 0, alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{card.question}</p>
                    <p className="muted" style={{ margin: "4px 0 0" }}>{card.answer}</p>
                  </div>
                  <div className="row">
                    {card.due ? <span className="pill yellow">fällig</span> : <span className="pill green">Box {card.box}</span>}
                    <button className="ghost" onClick={() => handleDeleteCard(card.id)}><TrashIcon size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deck && practicing && !done && current && (
        <>
          <div className="top-bar">
            <h1 style={{ margin: 0 }}>{deck.title}</h1>
            <button className="ghost" onClick={() => setPracticing(false)}>Beenden</button>
          </div>
          <p className="faint" style={{ marginBottom: 16 }}>Noch {queue.length + 1} Karte{queue.length === 0 ? "" : "n"}</p>

          <div
            className={`flip-card ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            style={{ minHeight: 180 }}
          >
            <div className="flip-card-inner">
              <div className="flip-card-face front">
                <div className="flip-card-label">Frage</div>
                <p className="flip-card-text">{current.question}</p>
              </div>
              <div className="flip-card-face back">
                <div className="flip-card-label">Antwort</div>
                <p className="flip-card-text">{current.answer}</p>
              </div>
            </div>
          </div>

          {flipped && (
            <div className="row" style={{ marginTop: 16 }}>
              <button className="ghost" onClick={() => handleReview("again")} style={{ flex: 1 }}>
                Nochmal
              </button>
              <button onClick={() => handleReview("know")} style={{ flex: 1 }}>
                Weiß ich
              </button>
            </div>
          )}
          {!flipped && <p className="faint" style={{ marginTop: 12 }}>Zum Umdrehen anklicken</p>}
        </>
      )}

      {deck && practicing && done && (
        <div className="empty-state">
          <p>Geschafft - alle fälligen Karten geübt.</p>
          <button onClick={() => { setPracticing(false); load(token); }} style={{ marginTop: 12 }}>
            Zurück zum Deck
          </button>
        </div>
      )}
    </AppShell>
  );
}
