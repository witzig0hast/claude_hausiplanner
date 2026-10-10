"use client";

import { useState } from "react";
import { setEmailReminders } from "../lib/api";

/** Shown once right after a new account was actually created (not before, while the form could
 * still fail) - confirms the auto-enabled deadline-email reminders and lets the user turn them
 * off immediately, without having to find the setting in Settings afterwards. */
export function EmailReminderNotice({ token, onDone }: { token: string; onDone: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleContinue() {
    setBusy(true);
    try {
      if (!enabled) {
        await setEmailReminders(token, false);
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
          Du bekommst automatisch eine E-Mail, sobald eine deiner Hausaufgaben zeitlich knapp
          wird. Falls du das nicht möchtest, kannst du es hier direkt abschalten (später
          jederzeit in den Einstellungen änderbar).
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: "auto", marginBottom: 0 }}
          />
          Per E-Mail erinnern, wenn eine Hausaufgabe bald fällig ist
        </label>
        <button type="button" style={{ width: "100%" }} onClick={handleContinue} disabled={busy}>
          {busy ? "Wird gespeichert..." : "Weiter"}
        </button>
      </div>
    </div>
  );
}
