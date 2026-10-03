"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  sendTestEmail,
  setAgentTone,
  setEmailReminders,
  setNotificationPrefs,
  setPrioritiesEnabled,
  User,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CheckIcon, MailIcon, SlidersIcon, SunIcon } from "../../components/icons";
import { Accent, ACCENTS, applyAccent, applyTheme, getStoredAccent, getStoredTheme, Theme } from "../../lib/theme";

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent, setAccent] = useState<Accent>("green");
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("hausiplanner_token");
    const u = localStorage.getItem("hausiplanner_user");
    if (!t || !u) {
      router.push("/login");
      return;
    }
    setToken(t);
    setUser(JSON.parse(u));
    setTheme(getStoredTheme());
    setAccent(getStoredAccent());
  }, [router]);

  async function handleSetTone(tone: "locker" | "streng") {
    if (!token) return;
    const updated = await setAgentTone(token, tone);
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleToggleEmailReminders(enabled: boolean) {
    if (!token) return;
    const updated = await setEmailReminders(token, enabled);
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleToggleDigest(enabled: boolean) {
    if (!token || !user) return;
    const updated = await setNotificationPrefs(token, {
      digest_enabled: enabled,
      deadline_push_enabled: user.deadline_push_enabled,
    });
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleToggleDeadlinePush(enabled: boolean) {
    if (!token || !user) return;
    const updated = await setNotificationPrefs(token, {
      digest_enabled: user.digest_enabled,
      deadline_push_enabled: enabled,
    });
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleTogglePriorities(enabled: boolean) {
    if (!token) return;
    const updated = await setPrioritiesEnabled(token, enabled);
    setUser(updated);
    localStorage.setItem("hausiplanner_user", JSON.stringify(updated));
  }

  async function handleSendTestEmail() {
    if (!token) return;
    setTestEmailStatus("sending");
    setTestEmailError(null);
    try {
      await sendTestEmail(token);
      setTestEmailStatus("sent");
    } catch (err) {
      setTestEmailStatus("error");
      setTestEmailError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }

  function handleSetTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  function handleSetAccent(next: Accent) {
    setAccent(next);
    applyAccent(next);
  }

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 style={{ marginBottom: 24 }}>Einstellungen</h1>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><SlidersIcon size={16} /></span>
          <div>
            <div className="card-header-title">Tonfall des Agenten</div>
            <div className="card-header-sub">Bestimmt den Stil von Zusammenfassung und Chat-Antworten</div>
          </div>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={user.agent_tone === "locker" ? "active" : ""}
            onClick={() => handleSetTone("locker")}
          >
            Locker
          </button>
          <button
            type="button"
            className={user.agent_tone === "streng" ? "active" : ""}
            onClick={() => handleSetTone("streng")}
          >
            Sachlich
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><MailIcon size={16} /></span>
          <div>
            <div className="card-header-title">E-Mail-Erinnerungen</div>
            <div className="card-header-sub">
              Zusätzlich zur Push-Nachricht per E-Mail erinnern, wenn eine Hausaufgabe bald
              fällig und noch nicht erledigt ist
            </div>
          </div>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={user.email_reminders_enabled ? "active" : ""}
            onClick={() => handleToggleEmailReminders(true)}
          >
            An
          </button>
          <button
            type="button"
            className={!user.email_reminders_enabled ? "active" : ""}
            onClick={() => handleToggleEmailReminders(false)}
          >
            Aus
          </button>
        </div>
        <div className="row" style={{ marginTop: 14, alignItems: "center", gap: 10 }}>
          <button type="button" className="ghost" onClick={handleSendTestEmail} disabled={testEmailStatus === "sending"}>
            {testEmailStatus === "sending" ? "Wird gesendet..." : "Test-E-Mail senden"}
          </button>
          {testEmailStatus === "sent" && <span style={{ color: "var(--accent-bright)" }}>Gesendet - schau in dein Postfach</span>}
          {testEmailStatus === "error" && <span style={{ color: "#d97070" }}>{testEmailError}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><MailIcon size={16} /></span>
          <div>
            <div className="card-header-title">Benachrichtigungen</div>
            <div className="card-header-sub">Welche Nachrichten der Agent dir überhaupt schickt</div>
          </div>
        </div>

        <p className="field-label">Abend-Zusammenfassung</p>
        <div className="toggle-group" style={{ marginBottom: 20 }}>
          <button type="button" className={user.digest_enabled ? "active" : ""} onClick={() => handleToggleDigest(true)}>
            An
          </button>
          <button type="button" className={!user.digest_enabled ? "active" : ""} onClick={() => handleToggleDigest(false)}>
            Aus
          </button>
        </div>

        <p className="field-label">Fällig-bald-Erinnerung (Push)</p>
        <div className="toggle-group">
          <button
            type="button"
            className={user.deadline_push_enabled ? "active" : ""}
            onClick={() => handleToggleDeadlinePush(true)}
          >
            An
          </button>
          <button
            type="button"
            className={!user.deadline_push_enabled ? "active" : ""}
            onClick={() => handleToggleDeadlinePush(false)}
          >
            Aus
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><SlidersIcon size={16} /></span>
          <div>
            <div className="card-header-title">Dringlichkeitsstufen</div>
            <div className="card-header-sub">
              Optional: Hausaufgaben beim Anlegen als niedrig/normal/hoch markieren
            </div>
          </div>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={user.priorities_enabled ? "active" : ""}
            onClick={() => handleTogglePriorities(true)}
          >
            An
          </button>
          <button
            type="button"
            className={!user.priorities_enabled ? "active" : ""}
            onClick={() => handleTogglePriorities(false)}
          >
            Aus
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-icon"><SunIcon size={16} /></span>
          <div>
            <div className="card-header-title">Design</div>
            <div className="card-header-sub">Hell/Dunkel und Akzentfarbe - nur auf diesem Gerät gespeichert</div>
          </div>
        </div>

        <p className="field-label">Anzeigemodus</p>
        <div className="toggle-group" style={{ marginBottom: 20 }}>
          <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => handleSetTheme("dark")}>
            Dunkel
          </button>
          <button type="button" className={theme === "light" ? "active" : ""} onClick={() => handleSetTheme("light")}>
            Hell
          </button>
        </div>

        <p className="field-label">Akzentfarbe</p>
        <div className="row wrap">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              className="ghost"
              onClick={() => handleSetAccent(a.value)}
              title={a.label}
              style={{
                padding: 4,
                borderRadius: 999,
                border: accent === a.value ? "2px solid var(--text)" : "2px solid transparent",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: a.swatch,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {accent === a.value && <CheckIcon size={14} />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
