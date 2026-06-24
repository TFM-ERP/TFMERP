'use client';

/**
 * SYS-UX Phase 1 — collapsible grouped navigation rail (ADDITIVE; previewed at /nav-preview,
 * wired into the dashboard layout behind NEXT_PUBLIC_FF_NAV only when you flip it).
 * Presentational + data-driven: it renders whatever MODULES/GROUPS you pass, so it keeps
 * full parity with the existing sidebar. Collapses to an icon strip; expands to labels +
 * the active module's pages. Token-driven, so it themes with the rest of the system.
 */
import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type RailPage = { label: string; href: string; divider?: boolean };
export type RailModule = { key: string; label: string; icon: ComponentType<any>; pages: RailPage[] };
export type RailGroup = { caption: string; modules: RailModule[] };

const isActive = (pathname: string, href: string) =>
  href !== '#' && !href.startsWith('#') && (pathname === href || pathname.startsWith(href + '/'));

export default function GroupedRail({
  groups, collapsed: controlled, onToggleCollapse,
}: {
  groups: RailGroup[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname() || '';
  const [internalCollapsed, setInternal] = useState(false);
  const collapsed = controlled ?? internalCollapsed;
  const toggle = onToggleCollapse ?? (() => setInternal((v) => !v));

  // which module is "open" (shows its pages): the one matching the current path, else none
  const activeModuleKey = groups
    .flatMap((g) => g.modules)
    .find((m) => m.pages.some((p) => isActive(pathname, p.href)))?.key;
  const [openKey, setOpenKey] = useState<string | null>(activeModuleKey ?? null);

  const W = collapsed ? 64 : 232;

  return (
    <aside
      style={{
        width: W, flexShrink: 0, transition: 'width .18s ease', overflowX: 'hidden', overflowY: 'auto',
        background: 'var(--surface-1)', borderRight: '1px solid var(--border-1)', color: 'var(--text-2)',
        fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', height: '100%',
      }}
    >
      {/* brand + collapse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid var(--border-1)' }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: 'var(--accent)', color: 'var(--accent-on)' }}>T</span>
        {!collapsed && <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-1)', flex: 1 }}>TFM</span>}
        <button onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'} aria-label="Toggle navigation"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav style={{ padding: '8px 8px 20px', flex: 1 }}>
        {groups.map((g) => (
          <div key={g.caption} style={{ marginBottom: 10 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', fontWeight: 700, padding: '8px 8px 5px' }}>{g.caption}</div>
            )}
            {collapsed && <div style={{ height: 1, background: 'var(--border-1)', margin: '8px 6px' }} />}
            {g.modules.map((m) => {
              const Icon = m.icon;
              const open = !collapsed && openKey === m.key;
              const moduleActive = m.pages.some((p) => isActive(pathname, p.href));
              return (
                <div key={m.key}>
                  <button
                    onClick={() => setOpenKey((k) => (k === m.key ? null : m.key))}
                    title={collapsed ? m.label : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
                      padding: collapsed ? '9px 0' : '8px 9px', justifyContent: collapsed ? 'center' : 'flex-start',
                      border: 'none', borderRadius: 8, marginBottom: 1, fontFamily: 'inherit', fontSize: 13,
                      fontWeight: moduleActive ? 700 : 500,
                      background: moduleActive ? 'var(--accent-soft)' : 'transparent',
                      color: moduleActive ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    <Icon size={17} style={{ flexShrink: 0 }} />
                    {!collapsed && <span style={{ flex: 1, textAlign: 'start' }}>{m.label}</span>}
                    {!collapsed && m.pages.length > 1 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{open ? '▾' : '▸'}</span>}
                  </button>
                  {open && (
                    <div style={{ margin: '0 0 4px 0', paddingInlineStart: 10 }}>
                      {m.pages.filter((p) => !p.divider).map((p) => {
                        const act = isActive(pathname, p.href);
                        return (
                          <Link key={p.href} href={p.href}
                            style={{
                              display: 'block', textDecoration: 'none', fontSize: 12.5, padding: '6px 9px 6px 28px',
                              borderRadius: 7, marginBottom: 1, fontWeight: act ? 700 : 500,
                              color: act ? 'var(--accent)' : 'var(--text-3)',
                              background: act ? 'var(--accent-soft)' : 'transparent',
                            }}>
                            {p.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
