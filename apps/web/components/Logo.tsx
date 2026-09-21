export function Logo({ href = "/" }: { href?: string }) {
  const content = (
    <div className="brand">
      <span className="brand-mark">H</span>
      Hausaufgabenplaner
    </div>
  );
  if (!href) return content;
  return <a href={href} style={{ textDecoration: "none" }}>{content}</a>;
}
