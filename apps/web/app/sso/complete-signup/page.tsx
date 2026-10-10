"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../../components/Logo";
import { EmailReminderNotice } from "../../../components/EmailReminderNotice";
import { completeSsoSignup } from "../../../lib/api";

function CompleteSignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingToken = searchParams.get("pending");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [className, setClassName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only set right after the account was actually created - shows the email-reminder
  // disclaimer/opt-out popup once, instead of asking before signup even succeeded.
  const [newAccountToken, setNewAccountToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setBusy(true);
    try {
      const data = await completeSsoSignup({
        pending_token: pendingToken,
        display_name: displayName,
        invite_code: inviteCode || undefined,
        class_name: className || undefined,
      });
      localStorage.setItem("hausiplanner_token", data.access_token);
      localStorage.setItem("hausiplanner_user", JSON.stringify(data.user));
      setBusy(false);
      setNewAccountToken(data.access_token);
    } catch (err) {
      setError((err as Error).message || "Registrierung fehlgeschlagen.");
      setBusy(false);
    }
  }

  if (!pendingToken) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 80, textAlign: "center" }}>
        <p style={{ color: "#f19999" }}>Ungültiger Registrierungslink.</p>
        <a href="/login">Zurück zum Login</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 40, paddingLeft: 20, paddingRight: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <Logo href="/" />
      </div>
      <p className="subtitle" style={{ textAlign: "center", marginBottom: 24 }}>
        Fast fertig - du bist per SSO angemeldet. Trag noch deinen Namen und deine Klasse ein.
      </p>

      <form onSubmit={submit} className="card">
        <label className="field-label">Dein Name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />

        <label className="field-label">Einladungscode (optional)</label>
        <input
          placeholder="Leer lassen = neue Klasse als Admin anlegen"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />

        {!inviteCode && (
          <>
            <label className="field-label">Klassenname</label>
            <input
              placeholder="z.B. 8b Gymnasium Musterstadt"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </>
        )}

        {error && (
          <p style={{ color: "#f19999", background: "var(--red-bg)", border: "1px solid #4d2323", padding: "10px 14px", borderRadius: 6, fontSize: 13.5 }}>
            {error}
          </p>
        )}

        <button type="submit" style={{ width: "100%", marginTop: 4 }} disabled={busy}>
          {busy ? "Wird verarbeitet..." : "Konto erstellen"}
        </button>
      </form>

      {newAccountToken && (
        <EmailReminderNotice token={newAccountToken} onDone={() => router.push("/dashboard")} />
      )}
    </div>
  );
}

export default function CompleteSignupPage() {
  return (
    <Suspense fallback={null}>
      <CompleteSignupInner />
    </Suspense>
  );
}
