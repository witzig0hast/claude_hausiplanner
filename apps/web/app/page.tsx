import Link from "next/link";
import { Logo } from "../components/Logo";

export default function HomePage() {
  return (
    <div>
      <div className="nav-bar">
        <Logo href="" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <p className="kicker">Für Schülerinnen und Schüler</p>
        <h1 style={{ lineHeight: 1.2, marginBottom: 14 }}>
          Hausaufgaben, die deine ganze Klasse im Blick hat.
        </h1>
        <p className="muted" style={{ maxWidth: 480, marginBottom: 22 }}>
          Geteilte Hausaufgabenliste, ein KI-Assistent für Zusammenfassungen und Rückfragen,
          und eine Einschätzung der Auslastung anhand deines Stundenplans - öffentlich einsehbar
          ohne Konto, bearbeitbar mit Login.
        </p>
        <div className="row">
          <Link href="/login"><button>Konto erstellen</button></Link>
          <Link href="/login"><button className="secondary">Ich habe schon eins</button></Link>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>So funktioniert es</h3>
        <div className="step-list">
          <div className="step">
            <span className="step-number">1</span>
            <p className="step-text">Klasse anlegen oder per Einladungscode beitreten.</p>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <p className="step-text">Hausaufgaben eintragen - sichtbar für die ganze Klasse, abgehakt wird individuell.</p>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <p className="step-text">Der Agent fasst zusammen, beantwortet Rückfragen und schätzt die Auslastung ein.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
