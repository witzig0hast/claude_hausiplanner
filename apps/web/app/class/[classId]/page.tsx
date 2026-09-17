import Link from "next/link";
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
    return <p>Klasse nicht gefunden oder Server nicht erreichbar.</p>;
  }

  return (
    <div>
      <div className="top-bar">
        <h1>Offene Hausaufgaben</h1>
        <Link href="/login"><button className="secondary">Einloggen</button></Link>
      </div>
      {items.length === 0 && <p>Aktuell nichts offen. 🎉</p>}
      {items.map((hw) => (
        <div key={hw.id} className="card">
          <span className="subject-tag" style={{ background: hw.subject.color, color: "#0f1115" }}>
            {hw.subject.name}
          </span>
          <h3 style={{ margin: "4px 0" }}>{hw.title}</h3>
          {hw.description && <p style={{ color: "var(--muted)" }}>{hw.description}</p>}
          <p className="due">Fällig: {formatDue(hw.due_at)} · {hw.completed_count} erledigt</p>
        </div>
      ))}
    </div>
  );
}
