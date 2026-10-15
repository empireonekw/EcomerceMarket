'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Banknote, LayoutDashboard, Menu, Package, Plus, Receipt, Store, Users } from 'lucide-react';
import SignOutButton from '@/components/SignOutButton';
import { siteConfig } from '@/lib/site';

// Navigation per dashboard area. Defined here (client module) because icons are components.
const AREAS = {
  admin: {
    label: 'Admin',
    home: '/admin',
    nav: [
      { href: '/admin', label: 'Dashboard Overview', icon: LayoutDashboard, match: (p) => p === '/admin' },
      { href: '/admin/products', label: 'Products Management', icon: Package, match: (p) => p.startsWith('/admin/products') && p !== '/admin/products/add' },
      { href: '/admin/products/add', label: 'Add New Product', icon: Plus, match: (p) => p === '/admin/products/add' },
      { href: '/admin/users', label: 'Users', icon: Users, match: (p) => p.startsWith('/admin/users') },
      { href: '/admin/orders', label: 'Orders & Sales', icon: Receipt, match: (p) => p.startsWith('/admin/orders') },
      { href: '/admin/payouts', label: 'Seller Payouts', icon: Banknote, match: (p) => p.startsWith('/admin/payouts') },
    ],
  },
  seller: {
    label: 'Seller',
    home: '/seller/dashboard',
    nav: [
      { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/seller/dashboard' },
      { href: '/seller/products/add', label: 'Add Product', icon: Plus, match: (p) => p.startsWith('/seller/products/add') },
      { href: '/seller/dashboard#payouts', label: 'Payouts & Bank Details', icon: Banknote, match: () => false },
      { href: '/seller/dashboard#shop', label: 'Shop Settings', icon: Store, match: () => false },
    ],
  },
};

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true };

function Brand({ area }) {
  return (
    <Link href={area.home} className="flex items-center gap-2 text-lg leading-none tracking-[-0.01em]">
      <span aria-hidden="true" className="size-2 rounded-full bg-brand-600" />
      <span>
        <span className="font-[560] text-black">{siteConfig.name.split(' ')[0]}</span>
        <span className="ml-1 font-[320] text-stone-500">{area.label}</span>
      </span>
    </Link>
  );
}

function SidebarBody({ pathname, area, user }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-4 pt-3">
        <Brand area={area} />
      </div>
      <nav aria-label={`${area.label} navigation`} className="flex-1">
        <ul className="space-y-1">
          {area.nav.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                    active ? 'bg-stone-100 text-black' : 'text-stone-600 hover:bg-stone-100 hover:text-black'
                  }`}
                >
                  <Icon {...ICON} className="shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-3 border-t border-stone-200 pt-4">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="flex items-center justify-between rounded-full px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-black"
        >
          View {siteConfig.name}
          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <div className="flex items-center gap-3 px-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-medium uppercase text-white">
            {user.name?.charAt(0) ?? '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
        </div>
        <SignOutButton className="w-full rounded-full px-4 py-2 text-left text-sm text-stone-600 hover:bg-stone-100 hover:text-black" />
      </div>
    </div>
  );
}

/** Sidebar layout shared by the admin and seller dashboards. */
export default function DashboardShell({ area: areaKey, user, children }) {
  const area = AREAS[areaKey];
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-stone-50 lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r border-stone-200 bg-white lg:block">
        <SidebarBody pathname={pathname} area={area} user={user} />
      </aside>

      {/* Mobile top bar + slide-in sidebar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 lg:hidden">
        <Brand area={area} />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="dashboard-mobile-nav"
          className="grid size-10 place-items-center rounded-full text-stone-700 hover:bg-stone-100 hover:text-black"
        >
          <span className="sr-only">Open navigation</span>
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div id="dashboard-mobile-nav" className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} inert={!mobileOpen}>
        <div onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`} />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-lift transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <SidebarBody pathname={pathname} area={area} user={user} />
        </aside>
      </div>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
