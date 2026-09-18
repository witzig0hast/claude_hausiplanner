"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (inviteFromLink) {
      setMode("register");
      setInviteCode(inviteFromLink);
    }
  }, [inviteFromLink]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, displayName, inviteCode || undefined);
      localStorage.setItem("hausiplanner_token", data.access_token);
      localStorage.setItem("hausiplanner_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err) {
      setError(mode === "login" ? "E-Mail oder Passwort falsch." : "Registrierung fehlgeschlagen.");
    }
  }

  return (
    <div>
      <h1>{mode === "login" ? "Einloggen" : "Konto erstellen"}</h1>
      <form onSubmit={submit} className="card">
        <input placeholder="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          placeholder="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "register" && (
          <>
            <input
              placeholder="Dein Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <input
              placeholder="Einladungscode deiner Klasse (leer = neue Klasse als Admin anlegen)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </>
        )}
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        <button type="submit">{mode === "login" ? "Einloggen" : "Registrieren"}</button>
      </form>
      <button className="secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Einloggen"}
      </button>
    </div>
  );
}
