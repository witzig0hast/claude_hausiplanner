import Link from "next/link";
import { Logo } from "../components/Logo";

export default function HomePage() {
  return (
    <div>
      <div className="nav-bar">
        <Logo href="" />
      </div>

      <div style={{ padding: "40px 0 20px" }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.15 }}>
          Hausaufgaben, die sich <span style={{ backgroundImage: "var(--accent-grad)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>von selbst organisieren.</span>
        </h1>
        <p className="subtitle" style={{ fontSize: 17, maxWidth: 520 }}>
          Klassen-Sharing, KI-Zusammenfassung und eine Ampel, die dir sagt, wie eng es wirklich wird -
          alles an einem Ort, ganz ohne Login sichtbar für deine Klasse.
        </p>
      </div>

      <div className="card hero">
        <h3 style={{ marginBottom: 8 }}>🔗 Klassenlink schon bekommen?</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          Öffne den Link, den dir dein Admin geschickt hat, um alle offenen Hausaufgaben zu sehen -
          ganz ohne Konto.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>🚀 Noch keine Klasse?</h3>
        <p className="muted">Leg in 30 Sekunden deine eigene Klasse an und werde automatisch Admin.</p>
        <Link href="/login"><button>Loslegen</button></Link>
      </div>

      <div className="row wrap" style={{ marginTop: 32, gap: 24 }}>
        <div className="row" style={{ gap: 8 }}><span>🤖</span><span className="faint">KI-Zusammenfassung &amp; Chat</span></div>
        <div className="row" style={{ gap: 8 }}><span>🚦</span><span className="faint">Workload-Ampel</span></div>
        <div className="row" style={{ gap: 8 }}><span>🃏</span><span className="faint">Karteikarten-Generator</span></div>
      </div>
    </div>
  );
}
