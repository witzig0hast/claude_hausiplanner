export function Logo({ href = "/" }: { href?: string }) {
  const content = (
    <div className="brand">
      <span className="brand-mark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="white" strokeWidth="3" strokeLinecap="square" />
        </svg>
      </span>
      Hausiplanner
    </div>
  );
  if (!href) return content;
  return <a href={href} style={{ textDecoration: "none" }}>{content}</a>;
}
