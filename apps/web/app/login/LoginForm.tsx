"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../components/Logo";
import { fetchSsoStatus, login, register, ssoLoginUrl } from "../../lib/api";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "SSO-Anmeldung abgebrochen oder unvollständig.",
  invalid_state: "SSO-Anmeldung abgelaufen - bitte erneut versuchen.",
  incomplete_profile: "Der SSO-Anbieter hat keine E-Mail-Adresse übermittelt.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromLink = searchParams.get("invite");
  const ssoErrorCode = searchParams.get("sso_error");
  const [mode, setMode] = useState<"login" | "register">(inviteFromLink ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromLink ?? "");
  const [className, setClassName] = useState("");
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [error, setError] = useState<string | null>(
    ssoErrorCode ? SSO_ERROR_MESSAGES[ssoErrorCode] ?? `SSO-Anmeldung fehlgeschlagen (${ssoErrorCode}).` : null
  );
  const [busy, setBusy] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    if (inviteFromLink) {
      setMode("register");
      setInviteCode(inviteFromLink);
    }
  }, [inviteFromLink]);

  useEffect(() => {
    fetchSsoStatus().then((s) => setSsoEnabled(s.enabled));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data =
        mode === "login"
          ? await login(email, password)
          : await register(
              email,
              password,
              displayName,
              inviteCode || undefined,
              className || undefined,
              emailRemindersEnabled
            );
      localStorage.setItem("hausiplanner_token", data.access_token);
      localStorage.setItem("hausiplanner_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || (mode === "login" ? "E-Mail oder Passwort falsch." : "Registrierung fehlgeschlagen."));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 40, paddingLeft: 20, paddingRight: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <Logo href="/" />
      </div>

      <div className="toggle-group" style={{ display: "flex", width: "100%", marginBottom: 24 }}>
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          style={{ flex: 1 }}
          onClick={() => setMode("login")}
        >
          Einloggen
        </button>
        <button
          type="button"
          className={mode === "register" ? "active" : ""}
          style={{ flex: 1 }}
          onClick={() => setMode("register")}
        >
          Registrieren
        </button>
      </div>

      <form onSubmit={submit} className="card">
        <label className="field-label">E-Mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />

        <label className="field-label">Passwort</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {mode === "register" && (
          <>
            <label className="field-label">Dein Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />

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

            <div
              style={{
                background: "var(--card-bg, rgba(255,255,255,0.03))",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "10px 14px",
                marginTop: 4,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <p className="muted" style={{ margin: 0, marginBottom: 8 }}>
                Du bekommst automatisch eine E-Mail, sobald eine deiner Hausaufgaben zeitlich knapp
                wird. Falls du das nicht möchtest, kannst du es hier direkt abschalten (später
                jederzeit in den Einstellungen änderbar).
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={emailRemindersEnabled}
                  onChange={(e) => setEmailRemindersEnabled(e.target.checked)}
                  style={{ width: "auto", marginBottom: 0 }}
                />
                Per E-Mail erinnern, wenn eine Hausaufgabe bald fällig ist
              </label>
            </div>
          </>
        )}

        {error && (
          <p style={{ color: "#f19999", background: "var(--red-bg)", border: "1px solid #4d2323", padding: "10px 14px", borderRadius: 6, fontSize: 13.5 }}>
            {error}
          </p>
        )}

        <button type="submit" style={{ width: "100%", marginTop: 4 }} disabled={busy}>
          {busy ? "Wird verarbeitet..." : mode === "login" ? "Einloggen" : "Konto erstellen"}
        </button>

        {ssoEnabled && (
          <>
            <div className="row" style={{ alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="faint">oder</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: "100%" }}
              onClick={() => { window.location.href = ssoLoginUrl("/dashboard"); }}
            >
              Mit SSO anmelden
            </button>
          </>
        )}
      </form>
    </div>
  );
}
