"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createDeck, DeckSummary, fetchDecks, User } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CardsIcon, ClockIcon, PlusIcon } from "../../components/icons";

export default function FlashcardsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    const u = localStorage.getItem("hausiplanner_user");
    if (!t || !u) {
      router.push("/login");
      return;
    }
    setToken(t);
    setUser(JSON.parse(u));
    fetchDecks(t)
      .then(setDecks)
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || (!text.trim() && !file)) return;
    setBusy(true);
    setError(null);
    try {
      const deck = await createDeck(token, { title: title.trim() || undefined, text: text.trim() || undefined, file: file ?? undefined });
      setDecks((prev) => [deck, ...prev]);
      setShowForm(false);
      setTitle("");
      setText("");
      setFile(null);
      router.push(`/flashcards/${deck.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <AppShell user={user}>
      <div className="top-bar">
        <div>
          <h1>Karteikarten</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Decks aus Text oder Foto - jeder übt für sich, der Fortschritt bleibt privat.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? (
            "Abbrechen"
          ) : (
            <span className="row" style={{ gap: 6 }}>
              <PlusIcon size={15} /> Neues Deck
            </span>
          )}
        </button>
      </div>

      {decks.length > 0 && (
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-tile-top">
              <span className="stat-tile-label">Decks</span>
              <CardsIcon size={15} />
            </div>
            <div className="stat-tile-value">{decks.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-top">
              <span className="stat-tile-label">Karten fällig</span>
              <ClockIcon size={15} />
            </div>
            <div className={`stat-tile-value ${decks.some((d) => d.due_count > 0) ? "warn" : ""}`}>
              {decks.reduce((sum, d) => sum + d.due_count, 0)}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 24 }}>
          <input
            placeholder="Titel (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Lernstoff einfügen - der Agent erstellt daraus Frage-Antwort-Karten"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ height: 120 }}
            disabled={!!file}
          />
          <div className="row" style={{ margin: "10px 0" }}>
            <span className="faint">oder</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ marginBottom: 0 }}
            />
            {file && (
              <button type="button" className="ghost" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>
                Entfernen
              </button>
            )}
          </div>
          <button type="submit" disabled={busy || (!text.trim() && !file)} style={{ width: "100%" }}>
            {busy ? "Wird erstellt..." : "Deck erstellen"}
          </button>
          {error && <p style={{ color: "#f19999", marginTop: 10 }}>{error}</p>}
        </form>
      )}

      {loading && <p className="muted">Lädt...</p>}

      {!loading && decks.length === 0 && !showForm && (
        <div className="empty-state">
          <p>Noch keine Karteikarten-Decks.</p>
          <p className="faint">Erstelle das erste Deck aus einem Foto oder eingefügtem Text.</p>
        </div>
      )}

      {decks.length > 0 && (
        <div className="stack">
          {decks.map((deck) => (
            <a key={deck.id} href={`/flashcards/${deck.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card interactive">
                <div className="top-bar" style={{ marginBottom: 0 }}>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{deck.title}</p>
                    <p className="faint" style={{ margin: "4px 0 0" }}>
                      {deck.card_count} Karte{deck.card_count === 1 ? "" : "n"}
                    </p>
                  </div>
                  {deck.due_count > 0 ? (
                    <span className="pill yellow">{deck.due_count} fällig</span>
                  ) : (
                    <span className="pill green">alles gelernt</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </AppShell>
  );
}
