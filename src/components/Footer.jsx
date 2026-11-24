import { Link } from "react-router-dom";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import Logo from "./Logo";
import { site } from "../data/site";
import { useCatalog } from "../contexts/CatalogContext";
import { useAuth } from "../contexts/AuthContext";

const YEAR = new Date().getFullYear();

export default function Footer() {
  const { categories, shop } = useCatalog();
  const { isAuthenticated } = useAuth();

  const name = shop?.name || site.name;
  // Contact details come from site.js so the published number, email and address are the same everywhere.
  const phone = site.phone;
  const email = site.email;
  const address = site.address;

  return (
    <footer className="section-dark border-t border-rose/20">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-4 lg:px-10">
        <div className="md:col-span-1">
          <Logo variant="footer" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-mauve">{shop?.tagline || site.tagline}</p>
        </div>

        <div>
          <h2 className="mb-5 font-body text-xs font-semibold uppercase tracking-[0.25em] text-petal">Shop</h2>
          <ul className="space-y-3 text-sm text-mauve">
            <li>
              <Link to="/shop" className="hover:text-white">All products</Link>
            </li>
            {categories.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link to={`/shop?category=${encodeURIComponent(c.slug)}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-5 font-body text-xs font-semibold uppercase tracking-[0.25em] text-petal">Account</h2>
          <ul className="space-y-3 text-sm text-mauve">
            <li><Link to="/cart" className="hover:text-white">Your cart</Link></li>
            <li>
              <Link to={isAuthenticated ? "/account" : "/login"} className="hover:text-white">
                {isAuthenticated ? "My account" : "Sign in or register"}
              </Link>
            </li>
            <li><Link to="/logout" className="hover:text-white">Sign out</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-5 font-body text-xs font-semibold uppercase tracking-[0.25em] text-petal">Contact</h2>
          <ul className="space-y-3 text-sm text-mauve">
            <li className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 flex-none text-gold" aria-hidden="true" /> {address}</li>
            <li className="flex items-center gap-2.5"><Phone size={16} className="flex-none text-gold" aria-hidden="true" /> {phone}</li>
            {email && <li className="flex items-center gap-2.5"><Mail size={16} className="flex-none text-gold" aria-hidden="true" /> {email}</li>}
            {site.whatsapp && (
              <li>
                <a href={site.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 hover:text-white">
                  <MessageCircle size={16} className="flex-none text-gold" aria-hidden="true" /> Chat on WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-mauve/80 md:flex-row md:justify-between lg:px-10">
          <span>&copy; {YEAR} {name}. All rights reserved.</span>
          <span>Cash on delivery available</span>
        </div>
      </div>
    </footer>
  );
}
