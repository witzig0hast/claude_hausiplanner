"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe } from "../../../lib/api";

function SsoCallbackInner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The token travels in the URL fragment (#...), not a query string, so it's never sent to
    // or logged by any server in between - only JS running on this page can read it.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");
    const next = hash.get("next") || "/dashboard";

    if (!token) {
      setError("Kein Anmelde-Token erhalten.");
      return;
    }

    fetchMe(token)
      .then((user) => {
        localStorage.setItem("hausiplanner_token", token);
        localStorage.setItem("hausiplanner_user", JSON.stringify(user));
        router.replace(next);
      })
      .catch(() => setError("Anmeldung fehlgeschlagen."));
  }, [router]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 80, textAlign: "center" }}>
      {error ? (
        <>
          <p style={{ color: "#f19999" }}>{error}</p>
          <a href="/login">Zurück zum Login</a>
        </>
      ) : (
        <p className="muted">Anmeldung läuft...</p>
      )}
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={null}>
      <SsoCallbackInner />
    </Suspense>
  );
}
