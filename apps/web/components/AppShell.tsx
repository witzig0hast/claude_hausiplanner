"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeIcon, LogoutIcon, MenuIcon, SettingsIcon, ShieldIcon, UsersIcon, XIcon } from "./icons";
import { Logo } from "./Logo";
import { initTheme } from "../lib/theme";

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

  useEffect(() => {
    initTheme();
  }, []);

  const nav = [
    { href: "/dashboard", label: "Hausaufgaben", icon: HomeIcon },
    { href: "/class", label: "Klasse", icon: UsersIcon },
    ...(user?.is_class_admin ? [{ href: "/admin", label: "Admin", icon: ShieldIcon }] : []),
    { href: "/settings", label: "Einstellungen", icon: SettingsIcon },
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
            <span className="avatar" title={user.display_name}>
              {user.display_name.charAt(0).toUpperCase()}
            </span>
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
        <div className="nav-drawer-overlay" onClick={() => setOpen(false)}>
          <nav className="nav-drawer" onClick={(e) => e.stopPropagation()}>
            {user && (
              <div className="nav-drawer-user">
                <span className="avatar" title={user.display_name}>
                  {user.display_name.charAt(0).toUpperCase()}
                </span>
                <span className="nav-drawer-user-name">{user.display_name}</span>
              </div>
            )}

            <div className="sidebar-nav">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <a key={href} href={href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
                    <Icon size={17} />
                    {label}
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
