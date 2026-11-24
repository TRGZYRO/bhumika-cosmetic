import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Menu, X, ShoppingBag, User, Shield, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import { site } from "../data/site";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

const linkClass = ({ isActive }) =>
  `nav-link text-sm font-medium tracking-wide transition-colors duration-300 ${
    isActive ? "text-white" : "text-mauve hover:text-white"
  }`;

/** Search box that sends the shopper to the Shop page with ?q= in the address. */
function SearchBox({ onSubmitted, className = "" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") || "");

  function submit(e) {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onSubmitted?.();
  }

  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mauve" aria-hidden="true" />
      <input
        id="site-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search lipsticks, serums, perfumes…"
        className="w-full rounded-full border border-petal/25 bg-white/5 py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-mauve/70 focus:border-petal focus:bg-white/10 focus:outline-none"
      />
    </form>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, signOut, isAuthenticated, isAdmin, loading } = useAuth();
  const { itemCount } = useCart();

  // Close the mobile menu whenever the page changes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cartBadge = itemCount > 0 && (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white ring-2 ring-ink">
      {itemCount > 99 ? "99+" : itemCount}
    </span>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-500 ${
        scrolled
          ? "border-rose/30 bg-ink/95 shadow-[0_18px_40px_-24px_rgb(192_85_122/0.6)] backdrop-blur-xl"
          : "border-transparent bg-ink/90 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-6 md:h-24 lg:px-10">
        <Link to="/" className="flex-none" aria-label="Bhumika Cosmetic homepage">
          <Logo variant="nav" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {site.nav.filter((i) => i.key !== "cart").map((item) => (
            <NavLink key={item.key} to={item.href} end={item.href === "/"} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <SearchBox className="ml-auto hidden w-full max-w-xs md:block" />

        <div className="hidden flex-none items-center gap-5 md:flex">
          {!loading && isAuthenticated && isAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-petal hover:text-white" aria-label="Admin panel">
              <Shield size={16} strokeWidth={1.6} /> Admin
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/account" className="inline-flex items-center gap-2 text-sm font-medium text-mauve hover:text-white">
                <User size={16} strokeWidth={1.6} /> {user?.displayName?.split(" ")[0] || "Account"}
              </Link>
              <button
                type="button"
                onClick={() => signOut().then(() => {})}
                className="text-sm font-medium text-mauve hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost-light px-5 py-2.5 text-sm">
              Sign in
            </Link>
          )}
          <Link to="/cart" className="relative p-2 text-mauve transition-colors hover:text-white" aria-label={`Cart (${itemCount} items)`}>
            <ShoppingBag size={21} strokeWidth={1.6} />
            {cartBadge}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link to="/cart" className="relative p-2 text-white" aria-label={`Cart (${itemCount} items)`}>
            <ShoppingBag size={22} strokeWidth={1.6} />
            {cartBadge}
          </Link>
          <button
            type="button"
            className="rounded-full border border-petal/30 p-2.5 text-white transition-colors hover:bg-white/10"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.5, 1, 0.89, 1] }}
            className="border-t border-rose/20 bg-ink md:hidden"
          >
            <div className="px-6 pt-4">
              <SearchBox onSubmitted={() => setOpen(false)} />
            </div>
            <ul className="flex flex-col px-6 py-3">
              {site.nav.map((item, index) => (
                <li key={item.key} className="menu-item border-b border-white/10" style={{ "--i": index }}>
                  <NavLink
                    to={item.href}
                    end={item.href === "/"}
                    className={({ isActive }) =>
                      `flex items-center justify-between py-4 font-display text-2xl transition-colors ${
                        isActive ? "text-white" : "text-mauve"
                      }`
                    }
                  >
                    {item.label}
                    {item.key === "cart" && itemCount > 0 && (
                      <span className="rounded-full bg-rose px-2.5 py-0.5 font-body text-xs font-bold text-white">{itemCount}</span>
                    )}
                  </NavLink>
                </li>
              ))}
              <li className="menu-item border-b border-white/10" style={{ "--i": site.nav.length }}>
                {isAuthenticated ? (
                  <div className="flex items-center justify-between py-4">
                    <NavLink to="/account" className="font-display text-2xl text-mauve hover:text-white">
                      My Account
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        signOut().then(() => {});
                      }}
                      className="text-sm font-medium text-mauve hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <NavLink to="/login" className="block py-4 font-display text-2xl text-mauve hover:text-white">
                    Sign in
                  </NavLink>
                )}
              </li>
              {!loading && isAuthenticated && isAdmin && (
                <li className="menu-item border-b border-white/10" style={{ "--i": site.nav.length + 1 }}>
                  <Link to="/admin" className="block py-4 font-display text-2xl text-petal hover:text-white">
                    Admin Panel
                  </Link>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
