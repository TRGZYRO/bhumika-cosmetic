import { useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, Tags, ShoppingBag, Users, Settings, LogOut, Menu, X, ExternalLink } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const ADMIN_NAV = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { key: "orders", label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { key: "products", label: "Products", href: "/admin/products", icon: Package },
  { key: "categories", label: "Categories", href: "/admin/categories", icon: Tags },
  { key: "staff", label: "Staff", href: "/admin/staff", icon: Users },
  { key: "settings", label: "Shop settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { signOut, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isAdmin) {
    navigate("/login");
    return null;
  }

  const isActive = (item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));
  const current = ADMIN_NAV.find(isActive);

  const navList = (
    <nav aria-label="Admin" className="space-y-1 px-3">
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.key}
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3.5 rounded-xl px-4 py-3 transition-colors ${
              active ? "bg-white text-rosewood shadow-sm" : "text-mauve hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} strokeWidth={1.6} />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-blush text-cocoa md:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-ink transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Link to="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold font-display text-xl font-semibold text-gold">B</span>
            <span className="leading-none">
              <span className="block font-display text-xl font-semibold text-white">Bhumika</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.3em] text-petal">Admin</span>
            </span>
          </Link>
          <button type="button" className="p-2 text-mauve hover:text-white md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-2 flex-1 overflow-y-auto">{navList}</div>

        <div className="space-y-2 border-t border-white/10 p-5">
          <p className="truncate px-2 text-xs text-mauve/70">{user?.email}</p>
          <Link to="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-mauve hover:bg-white/10 hover:text-white">
            <ExternalLink size={16} strokeWidth={1.6} /> View shop
          </Link>
          <button
            type="button"
            onClick={() => signOut().then(() => navigate("/login"))}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm text-[#f5b5a9] hover:bg-white/10"
          >
            <LogOut size={16} strokeWidth={1.6} /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-ink/50 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-petal/60 bg-white/90 px-6 backdrop-blur md:px-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-full border border-petal p-2 text-rosewood md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose">Bhumika Cosmetic</p>
              <h1 className="font-display text-2xl font-semibold text-rosewood md:text-3xl">{current?.label || "Admin"}</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
