import Link from "next/link";
import { Logo } from "../../../components/Logo";
import { fetchPublicHomework } from "../../../lib/api";
import { subjectEmoji } from "../../../lib/icons";

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
    return (
      <div className="empty-state">
        <span className="emoji">🤔</span>
        Klasse nicht gefunden oder Server gerade nicht erreichbar.
      </div>
    );
  }

  return (
    <div>
      <div className="nav-bar">
        <Logo href="/" />
        <Link href="/login"><button className="secondary">Einloggen</button></Link>
      </div>

      <h1>Offene Hausaufgaben</h1>
      <p className="subtitle">Öffentliche Ansicht deiner Klasse - kein Login nötig.</p>

      {items.length === 0 && (
        <div className="empty-state">
          <span className="emoji">🎉</span>
          Aktuell nichts offen.
        </div>
      )}
      <div className="stack">
        {items.map((hw) => (
          <div key={hw.id} className="card interactive">
            <span className="subject-tag">
              <span className="subject-dot" style={{ background: hw.subject.color, color: hw.subject.color }} />
              {subjectEmoji(hw.subject.icon)} {hw.subject.name}
            </span>
            <h3>{hw.title}</h3>
            {hw.description && <p className="muted" style={{ marginTop: 6 }}>{hw.description}</p>}
            <p className="due">
              🕐 {formatDue(hw.due_at)}
              {hw.completed_count > 0 && <span className="faint">· {hw.completed_count} erledigt</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
