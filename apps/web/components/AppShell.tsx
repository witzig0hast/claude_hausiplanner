"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckIcon, HomeIcon, LogoutIcon, MenuIcon, PencilIcon, SettingsIcon, UsersIcon, XIcon } from "./icons";
import { Logo } from "./Logo";
import { initTheme } from "../lib/theme";
import { setDisplayName } from "../lib/api";

export function AppShell({
  user,
  children,
}: {
  user: { display_name: string; is_class_admin?: boolean } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.display_name ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [displayName, setDisplayNameState] = useState(user?.display_name ?? "");

  useEffect(() => {
    setDisplayNameState(user?.display_name ?? "");
  }, [user?.display_name]);

  useEffect(() => {
    initTheme();
  }, []);

  async function saveName() {
    const token = localStorage.getItem("hausiplanner_token");
    const trimmed = nameDraft.trim();
    if (!token || !trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setNameBusy(true);
    try {
      const updated = await setDisplayName(token, trimmed);
      setDisplayNameState(updated.display_name);
      const stored = localStorage.getItem("hausiplanner_user");
      if (stored) {
        localStorage.setItem("hausiplanner_user", JSON.stringify({ ...JSON.parse(stored), display_name: updated.display_name }));
      }
      setEditingName(false);
    } catch {
      // keep the field open with the user's draft so they can retry instead of silently reverting
    } finally {
      setNameBusy(false);
    }
  }

  const nav = [
    { href: "/dashboard", label: "Hausaufgaben", sub: "Deine Aufgaben & Prüfungen", icon: HomeIcon },
    {
      href: "/class",
      label: "Klasse",
      sub: user?.is_class_admin ? "Mitglieder, Fächer, Kurse, Stundenplan, Teilen" : "Mitglieder, Stundenplan, Teilen",
      icon: UsersIcon,
    },
    { href: "/settings", label: "Einstellungen", sub: "Konto, Benachrichtigungen, Kalender", icon: SettingsIcon },
  ];

  function logout() {
    localStorage.removeItem("hausiplanner_token");
    localStorage.removeItem("hausiplanner_user");
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo href="/dashboard" />
        <div className="app-header-right">
          {user && (
            <button
              type="button"
              className="avatar avatar-button"
              title={`${displayName} - Profil öffnen`}
              onClick={() => setOpen(true)}
            >
              {displayName.charAt(0).toUpperCase()}
            </button>
          )}
          <button
            type="button"
            className={`menu-button ${open ? "open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
          >
            {open ? <XIcon size={19} /> : <MenuIcon size={19} />}
          </button>
        </div>
      </header>

      {open && (
        <div
          className="nav-drawer-overlay"
          onClick={() => {
            setOpen(false);
            setEditingName(false);
          }}
        >
          <nav className="nav-drawer" onClick={(e) => e.stopPropagation()}>
            {user && (
              <div className="nav-drawer-user">
                <span className="avatar">{displayName.charAt(0).toUpperCase()}</span>
                {editingName ? (
                  <div className="row" style={{ gap: 6, flex: 1 }}>
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      style={{ marginBottom: 0, fontSize: 14, padding: "6px 8px" }}
                      disabled={nameBusy}
                    />
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: "6px 8px", boxShadow: "none" }}
                      onClick={saveName}
                      disabled={nameBusy}
                      aria-label="Namen speichern"
                    >
                      <CheckIcon size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="nav-drawer-user-name" style={{ flex: 1 }}>{displayName}</span>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: "6px 8px", boxShadow: "none" }}
                      onClick={() => {
                        setNameDraft(displayName);
                        setEditingName(true);
                      }}
                      aria-label="Namen bearbeiten"
                      title="Namen bearbeiten"
                    >
                      <PencilIcon size={14} />
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="sidebar-nav">
              {nav.map(({ href, label, sub, icon: Icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <a key={href} href={href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
                    <Icon size={17} />
                    <span>
                      <span style={{ display: "block" }}>{label}</span>
                      <span className="nav-link-sub">{sub}</span>
                    </span>
                  </a>
                );
              })}
            </div>

            <button className="ghost nav-link logout-link" onClick={logout}>
              <LogoutIcon size={17} />
              Abmelden
            </button>
          </nav>
        </div>
      )}

      <div className="app-content">{children}</div>
    </div>
  );
}
