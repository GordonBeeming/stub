'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'new' },
  { href: '/dashboard/links', label: 'links' },
  { href: '/dashboard/notes', label: 'notes' },
  { href: '/dashboard/settings', label: 'settings' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="dashboard sections"
      style={{
        display: 'flex',
        gap: 24,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--line)',
        paddingBottom: 12,
        marginBottom: 40,
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              color: active ? 'var(--primary)' : 'var(--text-3)',
              borderBottom: active ? '1px solid var(--primary)' : '1px solid transparent',
              paddingBottom: 2,
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// `/dashboard` should only match exactly. `/dashboard/links`, `/notes`, `/settings`
// match themselves and any deeper path under them so that future sub-routes keep
// the parent highlighted.
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}
