export function Logo({ href = "/" }: { href?: string }) {
  const content = (
    <div className="brand">
      <span className="brand-mark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Hausiplanner
    </div>
  );
  if (!href) return content;
  return <a href={href} style={{ textDecoration: "none" }}>{content}</a>;
}
