import Link from "next/link";
import { Logo } from "../components/Logo";

export default function HomePage() {
  return (
    <div>
      <div className="nav-bar">
        <Logo href="" />
      </div>

      <div style={{ padding: "24px 0 4px" }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.25 }}>Hausaufgabenverwaltung für deine Klasse.</h1>
        <p className="subtitle" style={{ fontSize: 15.5, maxWidth: 520 }}>
          Geteilte Hausaufgabenliste, ein KI-Assistent für Zusammenfassungen und Rückfragen,
          und eine Einschätzung der Auslastung anhand deines Stundenplans - öffentlich einsehbar
          ohne Konto, bearbeitbar mit Login.
        </p>
      </div>

      <div className="card">
        <h3>Klassenlink erhalten?</h3>
        <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
          Öffne den Link deines Admins, um die offenen Hausaufgaben deiner Klasse einzusehen.
          Kein Konto notwendig.
        </p>
      </div>

      <div className="card">
        <h3>Neue Klasse einrichten</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Registrierung ohne Einladungscode legt automatisch eine neue Klasse an; der
          registrierende Nutzer wird deren Admin.
        </p>
        <Link href="/login"><button>Konto erstellen</button></Link>
      </div>

      <p className="section-title">Funktionsumfang</p>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>KI-Zusammenfassung und Rückfragen</span>
          <span className="faint">Ollama, lokal gehostet</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>Auslastungseinschätzung</span>
          <span className="faint">Bedarf vs. freie Zeit</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>Karteikarten aus Lernstoff</span>
          <span className="faint">automatisch generiert</span>
        </div>
      </div>
    </div>
  );
}
