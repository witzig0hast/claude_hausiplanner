"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../components/Logo";
import { login, register } from "../../lib/api";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromLink = searchParams.get("invite");
  const [mode, setMode] = useState<"login" | "register">(inviteFromLink ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (inviteFromLink) {
      setMode("register");
      setInviteCode(inviteFromLink);
    }
  }, [inviteFromLink]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, displayName, inviteCode || undefined);
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
      </form>
    </div>
  );
}
