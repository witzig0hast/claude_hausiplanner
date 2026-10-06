import Link from "next/link";
import { Logo } from "../../../components/Logo";
import { attachmentDownloadUrl, fetchPublicHomework } from "../../../lib/api";
import { FileIcon } from "../../../components/icons";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    <div className="page-narrow">
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
            {hw.attachments.length > 0 && (
              <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                {hw.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={attachmentDownloadUrl(hw.id, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="row"
                    style={{ gap: 6, alignItems: "center", textDecoration: "none", color: "var(--text)" }}
                  >
                    <FileIcon size={14} />
                    <span style={{ fontSize: 14 }}>{a.filename}</span>
                    <span className="faint">· {formatFileSize(a.size_bytes)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
