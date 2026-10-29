'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Bell,
  ChevronDown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  Store,
  Users,
} from 'lucide-react';
import { skeletonFor } from '@/components/dashboard/RouteSkeletons';
import SignOutButton from '@/components/SignOutButton';
import { useMessaging } from '@/components/messages/MessagingProvider';
import { siteConfig } from '@/lib/site';

// Navigation per dashboard area, in labelled sections. An item with `children` is a group that opens to its pages
// (shown on a guide line). Defined here (client module) because icons are components.
const AREAS = {
  admin: {
    label: 'Admin',
    subtitle: 'Admin console',
    home: '/admin',
    messages: '/admin/messages',
    action: { href: '/admin/products/add', label: 'Add product' },
    sections: [
      {
        label: 'General',
        items: [
          { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/admin' },
          { href: '/admin/system', label: 'System Health', icon: Activity, match: (p) => p.startsWith('/admin/system') },
        ],
      },
      {
        label: 'Catalog',
        items: [
          {
            label: 'Products',
            icon: Package,
            children: [
              { href: '/admin/products', label: 'All products', match: (p) => p.startsWith('/admin/products') && p !== '/admin/products/add' },
              { href: '/admin/products/add', label: 'Add new product', match: (p) => p === '/admin/products/add' },
            ],
          },
          { href: '/admin/categories', label: 'Categories', icon: FolderTree, match: (p) => p.startsWith('/admin/categories') },
        ],
      },
      {
        label: 'Commerce',
        items: [
          { href: '/admin/orders', label: 'Orders & Sales', icon: Receipt, match: (p) => p.startsWith('/admin/orders') },
          { href: '/admin/payouts', label: 'Seller Payouts', icon: Banknote, match: (p) => p.startsWith('/admin/payouts') },
        ],
      },
      {
        label: 'People',
        items: [
          { href: '/admin/users', label: 'Users', icon: Users, match: (p) => p.startsWith('/admin/users') },
          { href: '/admin/messages', label: 'Messages', icon: Mail, match: (p) => p.startsWith('/admin/messages'), badge: 'unread' },
        ],
      },
    ],
  },
  seller: {
    label: 'Seller',
    subtitle: 'Seller studio',
    home: '/seller/dashboard',
    messages: '/seller/messages',
    action: { href: '/seller/listings/new', label: 'New listing' },
    sections: [
      {
        label: 'General',
        items: [{ href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/seller/dashboard' }],
      },
      {
        label: 'Store',
        items: [
          { href: '/seller/listings', label: 'Listings', icon: Package, match: (p) => p.startsWith('/seller/listings') },
          { href: '/seller/dashboard#shop', label: 'Shop Settings', icon: Store, match: () => false },
        ],
      },
      {
        label: 'Sales',
        items: [
          { href: '/seller/sales', label: 'Sales History', icon: Receipt, match: (p) => p.startsWith('/seller/sales') },
          { href: '/seller/payouts', label: 'Payouts & Bank Details', icon: Banknote, match: (p) => p.startsWith('/seller/payouts') },
          { href: '/seller/messages', label: 'Messages', icon: MessageSquare, match: (p) => p.startsWith('/seller/messages'), badge: 'unread' },
        ],
      },
    ],
  },
};

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true };
// The active page: a white pill lifted off the tinted sidebar.
const ACTIVE = 'bg-white font-medium text-ink shadow-[0_1px_2px_rgba(16,16,16,0.06),0_6px_16px_-8px_rgba(16,16,16,0.18)]';
const IDLE = 'text-stone-600 hover:bg-black/[0.04] hover:text-ink';

function Brand({ area, onNavigate, compact = false }) {
  return (
    <Link
      href={area.home}
      onNavigate={() => onNavigate(area.home)}
      className={`flex items-center gap-3 ${compact ? '' : 'rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-black/[0.04]'}`}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <Store size={18} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{siteConfig.name}</span>
        <span className="block truncate text-xs text-stone-500">{area.subtitle}</span>
      </span>
    </Link>
  );
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="min-w-5 rounded-full bg-brand-500 px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold text-ink tabular-nums">
      <span className="sr-only">, </span>
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/** A group that opens to its pages, drawn on a guide line with a curved branch to each. */
function NavGroup({ item, pathname, onNavigate }) {
  const { label, icon: Icon, children } = item;
  const activeChild = children.some((c) => c.match(pathname));
  const [open, setOpen] = useState(true);
  const id = `nav-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] transition ${activeChild && !open ? ACTIVE : IDLE}`}
      >
        <Icon {...ICON} className={`shrink-0 ${activeChild ? 'text-brand-700' : ''}`} />
        <span className={`flex-1 ${activeChild ? 'font-medium text-ink' : ''}`}>{label}</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={`text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <ul id={id} hidden={!open} className="mt-0.5 ml-[21px] space-y-0.5">
        {children.map((c) => {
          const active = c.match(pathname);
          return (
            <li
              key={c.href}
              className="relative pl-4 before:absolute before:top-0 before:left-0 before:h-1/2 before:w-3 before:rounded-bl-[9px] before:border-b before:border-l before:border-stone-300 after:absolute after:top-0 after:bottom-0 after:left-0 after:border-l after:border-stone-300 last:after:hidden"
            >
              <Link
                href={c.href}
                onNavigate={() => onNavigate(c.href)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center rounded-xl px-3 py-1.5 text-[13px] transition ${active ? ACTIVE : IDLE}`}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function SidebarBody({ pathname, area, user, onNavigate }) {
  const { unread } = useMessaging();
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <Brand area={area} onNavigate={onNavigate} />

      <nav aria-label={`${area.label} navigation`} className="flex-1 space-y-5">
        {area.sections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                if (item.children) return <NavGroup key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />;
                const { href, label, icon: Icon, match, badge } = item;
                const active = match(pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onNavigate={() => onNavigate(href)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition ${active ? ACTIVE : IDLE}`}
                    >
                      <Icon {...ICON} className={`shrink-0 ${active ? 'text-brand-700' : ''}`} />
                      <span className="flex-1">{label}</span>
                      <Badge count={badge === 'unread' ? unread : 0} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3">
        <a href="/" target="_blank" rel="noopener" className="group block overflow-hidden rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs text-stone-400">Your storefront</p>
          <p className="mt-0.5 truncate text-sm font-medium">{siteConfig.name}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium transition-colors group-hover:bg-white/20">
            View store
            <ArrowUpRight size={14} strokeWidth={1.9} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>
        <div className="flex items-center gap-3 rounded-2xl p-2">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-medium text-ink uppercase">
            {user.name?.charAt(0) ?? '?'}
            <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-canvas bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <SignOutButton className="grid size-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-white hover:text-ink">
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Sign out</span>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}

/** Desktop bar above every page: greeting, inbox, storefront and the area's main action. */
function TopBar({ area, user, onNavigate }) {
  const { unread } = useMessaging();
  const first = user.name?.split(' ')[0];
  const round = 'grid size-10 place-items-center rounded-full bg-white text-stone-600 shadow-card ring-1 ring-black/[0.04] transition-colors hover:text-ink';
  return (
    <div className="mb-8 hidden items-center justify-between gap-4 lg:flex">
      <p className="text-sm text-stone-500">
        Welcome back{first ? ', ' : ''}
        {first && <span className="font-medium text-ink">{first}</span>}
      </p>
      <div className="flex items-center gap-2">
        <Link href={area.messages} onNavigate={() => onNavigate(area.messages)} className={`relative ${round}`} aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}>
          <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          {unread > 0 && <span aria-hidden="true" className="absolute top-2 right-2.5 size-2 rounded-full bg-brand-500 ring-2 ring-white" />}
        </Link>
        <a href="/" target="_blank" rel="noopener" className={round} aria-label={`View ${siteConfig.name} (opens in a new tab)`}>
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <Link href={area.action.href} onNavigate={() => onNavigate(area.action.href)} className="btn btn-md btn-primary ml-1 shadow-[0_8px_20px_-10px_rgba(220,154,47,0.8)]">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          {area.action.label}
        </Link>
      </div>
    </div>
  );
}

/**
 * Sidebar layout shared by the admin and seller dashboards.
 *
 * Sidebar clicks feel instant: the moment a link is clicked, the sidebar highlights it and the main area shows that
 * page's skeleton (the same one its loading.jsx renders), instead of waiting for the server to answer first.
 */
export default function DashboardShell({ area: areaKey, user, children }) {
  const area = AREAS[areaKey];
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // { to, from }: a sidebar navigation that has started but not landed yet. Only valid while still on `from`,
  // so the real page replaces the skeleton in the same render the URL changes.
  const [pending, setPending] = useState(null);
  const pendingPath = pending?.from === pathname ? pending.to : null;
  const currentPath = pendingPath ?? pathname;
  const Skeleton = pendingPath ? skeletonFor(pendingPath) : null;

  useEffect(() => {
    setMobileOpen(false);
    setPending(null);
  }, [pathname]);

  // Back/forward while a navigation is still pending: drop the optimistic state.
  useEffect(() => {
    const cancel = () => setPending(null);
    window.addEventListener('popstate', cancel);
    return () => window.removeEventListener('popstate', cancel);
  }, []);

  function onNavigate(href) {
    setMobileOpen(false);
    const to = href.split('#')[0];
    if (to === pathname) return; // same page (or an in-page #anchor): nothing to wait for
    setPending({ to, from: pathname });
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar: on the tinted canvas, no border. */}
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <SidebarBody pathname={currentPath} area={area} user={user} onNavigate={onNavigate} />
      </aside>

      {/* Mobile top bar + slide-in sidebar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/5 bg-canvas/85 px-4 backdrop-blur lg:hidden">
        <Brand area={area} onNavigate={onNavigate} compact />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="dashboard-mobile-nav"
          className="grid size-10 place-items-center rounded-full bg-white text-stone-700 shadow-card ring-1 ring-black/[0.04] hover:text-black"
        >
          <span className="sr-only">Open navigation</span>
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div id="dashboard-mobile-nav" className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} inert={!mobileOpen}>
        <div onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`} />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-canvas shadow-lift transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <SidebarBody pathname={currentPath} area={area} user={user} onNavigate={onNavigate} />
        </aside>
      </div>

      <main id="main" className="dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:py-6 lg:pr-8 lg:pl-4">
        <TopBar area={area} user={user} onNavigate={onNavigate} />
        {Skeleton && <Skeleton />}
        {/* Hidden, not unmounted, so the current page keeps its state if the navigation is abandoned. */}
        <div hidden={Boolean(Skeleton)}>{children}</div>
      </main>
    </div>
  );
}
