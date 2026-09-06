import Link from "next/link";

const links = [
  { href: "/today", label: "Today", mark: "●" },
  { href: "/library", label: "Library", mark: "⌕" },
  { href: "/add", label: "Add", mark: "+" },
  { href: "/record-post", label: "Record Post", mark: "✓" },
];

export function Navigation() {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <Link className="brand" href="/today" aria-label="SFL Brain home">
        <span className="brand-mark">SFL</span>
        <span>
          <strong>Brain</strong>
          <small>Styled For Less</small>
        </span>
      </Link>
      <div className="nav-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span aria-hidden="true">{link.mark}</span>
            {link.label}
          </Link>
        ))}
      </div>
      <p className="privacy-note">Private workspace · local MVP</p>
    </nav>
  );
}
