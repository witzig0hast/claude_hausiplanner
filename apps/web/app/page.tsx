import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1>Hausiplanner</h1>
      <p style={{ color: "var(--muted)" }}>
        Öffne den Link deiner Klasse, um alle offenen Hausaufgaben zu sehen - ganz ohne Login. Zum
        Hinzufügen oder Abhaken für dich selbst musst du dich einloggen.
      </p>
      <div className="card">
        <p>Noch keinen Klassenlink? Frag den Admin deiner Klasse nach dem Link, oder</p>
        <Link href="/login"><button>Einloggen / Registrieren</button></Link>
      </div>
    </div>
  );
}
