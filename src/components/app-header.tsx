'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTechPack } from '../app/state/tech-pack-provider';

const links = [
  { href: '/workspace', label: 'Workspace' },
  { href: '/review', label: 'Review assumptions' },
  { href: '/export', label: 'Export preview' },
];

export function AppHeader({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { document, reviewDecisions } = useTechPack();
  const pathname = usePathname();
  const title = document?.content.product.name.value ?? 'New Tech Pack';

  return (
    <header className={`app-header ${compact ? 'app-header--compact' : ''}`}>
      <Link className="brand" href="/" aria-label="Create a new Masdr tech pack">
        <span className="brand-mark">M</span>
        <span>MASDR</span>
      </Link>
      {!compact && document !== null ? (
        <nav className="app-nav" aria-label="Tech pack views">
          {links.map((link) => (
            <Link
              className={pathname === link.href ? 'app-nav__link is-active' : 'app-nav__link'}
              href={link.href}
              key={link.href}
            >
              {link.label}
              {link.href === '/review' && reviewDecisions.length > 0 ? (
                <span className="nav-count">{reviewDecisions.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : <span className="header-context">AI TECH PACK GENERATOR</span>}
      <div className="header-draft">
        <span className="status-dot" />
        <span>{title}</span>
      </div>
    </header>
  );
}
