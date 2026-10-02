"use client";

import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, LogoutIcon, SettingsIcon } from "./icons";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Hausaufgaben", icon: HomeIcon },
  { href: "/settings", label: "Einstellungen", icon: SettingsIcon },
];

export function AppShell({
  user,
  children,
}: {
  user: { display_name: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("hausiplanner_token");
    localStorage.removeItem("hausiplanner_user");
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ padding: "0 4px", marginBottom: 32 }}>
          <Logo href="/dashboard" />
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <a key={href} href={href} className={`nav-link ${active ? "active" : ""}`}>
                <Icon size={17} />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <span className="avatar" title={user.display_name}>{user.display_name.charAt(0).toUpperCase()}</span>
              <span className="sidebar-user-name">{user.display_name}</span>
            </div>
          )}
          <button className="ghost nav-link logout-link" onClick={logout}>
            <LogoutIcon size={17} />
            Abmelden
          </button>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
