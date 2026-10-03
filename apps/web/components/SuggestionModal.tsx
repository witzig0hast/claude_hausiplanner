"use client";

import { useState } from "react";
import { applySuggestion, dismissSuggestion, Homework, PendingSuggestion, Subject } from "../lib/api";
import { InfoIcon } from "./icons";

export function SuggestionModal({
  token,
  suggestion,
  subjects,
  onApplied,
  onDismissed,
}: {
  token: string;
  suggestion: PendingSuggestion;
  subjects: Subject[];
  onApplied: (hw: Homework) => void;
  onDismissed: () => void;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [description, setDescription] = useState(suggestion.description ?? "");
  const [subjectId, setSubjectId] = useState(suggestion.subject?.id ?? subjects[0]?.id ?? "");
  const [dueAt, setDueAt] = useState(
    suggestion.due_date_guess ? `${suggestion.due_date_guess}T${suggestion.due_time_guess || "18:00"}` : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !dueAt) return;
    setBusy(true);
    setError(null);
    try {
      const hw = await applySuggestion(token, {
        title,
        description: description || undefined,
        due_at: new Date(dueAt).toISOString(),
        subject_id: subjectId,
      });
      onApplied(hw);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      await dismissSuggestion(token);
    } catch {
      // ignore - worst case it reappears, no harm done
    } finally {
      onDismissed();
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleDismiss()}>
      <div className="modal">
        <p className="kicker">Eingesprochene Hausaufgabe</p>
        <h3 style={{ marginBottom: 6 }}>So speichern?</h3>
        <p className="faint" style={{ marginBottom: 16 }}>„{suggestion.raw_transcript}"</p>

        <form onSubmit={handleApply}>
          <label className="field-label">Titel</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

          <label className="field-label">Beschreibung (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="row wrap" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label className="field-label">Fach</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                {subjects.length === 0 && <option value="">Kein Fach angelegt</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="field-label row" style={{ gap: 5 }}>
                Fällig
                {suggestion.due_is_estimated && (
                  <span
                    title={
                      `Geschätzter Vorschlag: "bis zur nächsten Stunde" konnte nicht über den ` +
                      `Stundenplan aufgelöst werden (Fach unbekannt oder noch keine Stunde dafür ` +
                      `eingetragen) - lege den Stundenplan für dieses Fach an, damit die genaue ` +
                      `Stunde erkannt wird, oder passe die Zeit hier manuell an.`
                    }
                    style={{ cursor: "help", color: "var(--accent-bright)", display: "inline-flex" }}
                  >
                    <InfoIcon size={13} />
                  </span>
                )}
              </label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
              {suggestion.due_is_estimated && (
                <p className="faint" style={{ marginTop: -8, marginBottom: 12 }}>
                  Geschätzt (kein Stundenplan-Eintrag gefunden) - bitte prüfen
                </p>
              )}
            </div>
          </div>

          {error && <p style={{ color: "#f19999", marginBottom: 10 }}>{error}</p>}

          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="ghost" onClick={handleDismiss} disabled={busy} style={{ flex: 1 }}>
              Verwerfen
            </button>
            <button type="submit" disabled={busy || !subjectId} style={{ flex: 1 }}>
              {busy ? "..." : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
