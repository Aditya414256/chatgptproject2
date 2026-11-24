import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingCart, Bell, Package, LayoutDashboard, ClipboardList, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { useCart } from '../../features/cart/useCart';
import { useNotifications } from '../../features/store-dashboard/NotificationContext';
import { BRAND } from '../../config/brand';
import { cn } from '../../lib/utils';
import { Footer } from './Footer';
import type { UserRole } from '../../types/database';

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const role = profile?.role as UserRole | undefined;
  const isCustomer = role === 'customer';
  const isStoreOwner = role === 'store_owner';

  const customerLinks = [
    { to: '/catalog', label: 'Medicines', icon: Package },
    { to: '/orders', label: 'My Orders', icon: ClipboardList },
  ];

  const storeLinks = [
    { to: '/dashboard', label: 'Orders', icon: LayoutDashboard },
    { to: '/dashboard/inventory', label: 'Inventory', icon: Package },
    { to: '/dashboard/setup', label: 'Store Settings', icon: Settings },
  ];

  const links = isCustomer ? customerLinks : storeLinks;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 sm:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
          </button>

          <Link to="/" className="font-heading text-lg font-bold text-primary-800">
            {BRAND.name}
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to))
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <l.icon className="h-4 w-4" strokeWidth={1.5} />
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {isCustomer && <CartButton />}
            {isStoreOwner && <NotificationBell />}
            <span className="hidden text-xs text-neutral-500 sm:inline">{profile?.full_name}</span>
            <button
              onClick={signOut}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              title="Log out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-neutral-100 bg-white px-4 py-2 sm:hidden">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                  location.pathname === l.to ? 'bg-primary-50 text-primary-800' : 'text-neutral-600 hover:bg-neutral-50'
                )}
              >
                <l.icon className="h-4 w-4" strokeWidth={1.5} />
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {isStoreOwner && (
        <div className="bg-primary-800 px-4 py-1.5 text-center text-xs text-primary-100">
          Keep this tab open to receive orders.
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function CartButton() {
  const { items } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Link
      to="/cart"
      className="relative rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
      aria-label={`Cart (${count} items)`}
    >
      <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

function NotificationBell() {
  const { unreadCount } = useNotifications();
  return (
    <Link
      to="/dashboard"
      className="relative rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
      aria-label={`Notifications (${unreadCount} unread)`}
    >
      <Bell className="h-5 w-5" strokeWidth={1.5} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
