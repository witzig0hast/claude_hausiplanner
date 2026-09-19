import Link from "next/link";
import { Logo } from "../../../components/Logo";
import { fetchPublicHomework } from "../../../lib/api";

function formatDue(due: string) {
  return new Date(due).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PublicClassPage({ params }: { params: { classId: string } }) {
  let items;
  try {
    items = await fetchPublicHomework(params.classId);
  } catch {
    return <div className="empty-state">Klasse nicht gefunden oder Server nicht erreichbar.</div>;
  }

  return (
    <div>
      <div className="nav-bar">
        <Logo href="/" />
        <Link href="/login"><button className="secondary">Einloggen</button></Link>
      </div>

      <h1>Offene Hausaufgaben</h1>
      <p className="subtitle">Öffentliche Ansicht dieser Klasse. Kein Login erforderlich.</p>

      {items.length === 0 && <div className="empty-state">Aktuell keine offenen Hausaufgaben.</div>}
      <div className="stack">
        {items.map((hw) => (
          <div key={hw.id} className="card interactive">
            <span className="subject-tag">
              <span className="subject-dot" style={{ background: hw.subject.color }} />
              {hw.subject.name}
            </span>
            <h3>{hw.title}</h3>
            {hw.description && <p className="muted" style={{ marginTop: 6 }}>{hw.description}</p>}
            <p className="due">
              Fällig {formatDue(hw.due_at)}
              {hw.completed_count > 0 && <span> · {hw.completed_count} erledigt</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
