"use client";

import { useState } from "react";
import { setEmailReminders } from "../lib/api";

/** Shown once right after a new account was actually created (not before, while the form could
 * still fail) - offers the opt-in "Vorschlags-E-Mail" reminder, off by default like for every
 * other account, with a one-click way to turn it on right here instead of hunting for it in
 * Settings afterwards. */
export function EmailReminderNotice({ token, onDone }: { token: string; onDone: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleContinue() {
    setBusy(true);
    try {
      if (enabled) {
        await setEmailReminders(token, true);
      }
    } catch {
      // Account already exists at this point - worst case the user flips it later in Settings,
      // never worth blocking the signup flow over.
    } finally {
      onDone();
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 style={{ marginBottom: 6 }}>Willkommen!</h3>
        <p className="faint" style={{ marginBottom: 16 }}>
          Auf Wunsch schickt dir der Planer zusätzlich eine Vorschlags-E-Mail, sobald eine
          Hausaufgabe zeitlich knapp wird - standardmäßig aus, jederzeit in den Einstellungen
          änderbar.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: "auto", marginBottom: 0 }}
          />
          Vorschlags-E-Mail aktivieren
        </label>
        <button type="button" style={{ width: "100%" }} onClick={handleContinue} disabled={busy}>
          {busy ? "Wird gespeichert..." : "Weiter"}
        </button>
      </div>
    </div>
  );
}
