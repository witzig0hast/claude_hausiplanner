"use client";

import { useState } from "react";
import { markProductIntroSeen } from "../lib/api";
import { SparkleIcon } from "./icons";

/** Shown exactly once per existing account, right after this round of changes shipped - new
 * signups never see it (seen_product_intro defaults to true for them). Nothing about an
 * account's data changed to get here: subjects, homework, the timetable are all exactly as
 * they were. This only explains what's new and points at where to find it. */
export function ProductIntroNotice({ token, onDismissed }: { token: string; onDismissed: () => void }) {
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    setBusy(true);
    try {
      await markProductIntroSeen(token);
    } catch {
      // ignore - worst case it shows once more next login, never blocks using the app
    } finally {
      onDismissed();
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 6 }}>
          <span className="card-header-icon"><SparkleIcon size={16} /></span>
          <h3 style={{ margin: 0 }}>Was ist neu</h3>
        </div>
        <p className="faint" style={{ marginBottom: 16 }}>
          Deine Daten (Fächer, Hausaufgaben, Stundenplan) sind unverändert - nichts wurde
          gelöscht oder umgestellt. Das ist neu:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 20, color: "var(--text)", fontSize: 14, lineHeight: 1.7 }}>
          <li>Helleres, ruhigeres Design (umschaltbar in den Einstellungen)</li>
          <li>Prüfungen als eigener Eintrag mit Countdown im Dashboard</li>
          <li>Laufendes Kalender-Abo (webcal) statt nur Einmal-Export</li>
          <li>
            Optionale <strong>Kurse</strong> (z.B. Religion-Varianten, Mathe LK/GK) - rein
            opt-in, nur wenn eure Klasse das braucht, einzurichten unter "Klasse"
          </li>
          <li>Admin-Verwaltung lebt jetzt komplett auf der "Klasse"-Seite statt auf einer eigenen</li>
        </ul>
        <button type="button" style={{ width: "100%" }} onClick={dismiss} disabled={busy}>
          {busy ? "..." : "Verstanden"}
        </button>
      </div>
    </div>
  );
}
