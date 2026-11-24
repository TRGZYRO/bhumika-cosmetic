import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, User, Package, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import MyOrders from "../../components/MyOrders";
import Reveal from "../../components/Reveal";

/**
 * Customer account: a profile summary, editable details (including a saved delivery
 * address used at checkout), and the customer's order history.
 */
export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState({
    full_name: profile?.full_name || user?.displayName || "",
    phone: profile?.phone || "",
    email: profile?.email || user?.email || "",
    address: profile?.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const displayName = form.full_name || user?.email?.split("@")[0] || "Customer";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.put("/api/profile", {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "We couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    signOut().then(() => navigate("/login"));
  }

  const tabs = [
    { key: "details", label: "My details", icon: User },
    { key: "orders", label: "My orders", icon: Package },
  ];

  return (
    <>
      <section className="section-dark px-6 pb-16 pt-36 md:pt-44">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Reveal immediate className="flex items-center gap-6">
            <span className="flex h-20 w-20 flex-none items-center justify-center rounded-full border border-gold bg-rosewood font-display text-4xl font-semibold text-gold">
              {initial}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-petal">My account</p>
              <h1 className="mt-2 text-5xl font-semibold leading-tight text-white md:text-6xl">Hello, {displayName.split(" ")[0]}</h1>
            </div>
          </Reveal>
          <Reveal immediate delay={150}>
            <Link to="/shop" className="btn btn-ghost-light px-6 py-3 text-sm">Continue shopping</Link>
          </Reveal>
        </div>
      </section>

      <section className="section-light px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[280px_1fr]">
          {/* Side panel */}
          <aside className="space-y-4">
            <nav aria-label="Account" className="card p-3">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left text-sm font-semibold transition-colors ${
                      active ? "bg-rosewood text-white" : "text-cocoa hover:bg-blush"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.6} /> {t.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left text-sm font-semibold text-[#b42318] hover:bg-[#b42318]/5"
              >
                <LogOut size={18} strokeWidth={1.6} /> Sign out
              </button>
            </nav>

            <div className="card p-6 text-sm text-cocoa/75">
              <p className="flex items-center gap-3 break-all"><Mail size={16} className="flex-none text-gold" /> {profile?.email || user?.email || "—"}</p>
              {profile?.phone && <p className="mt-3 flex items-center gap-3"><Phone size={16} className="flex-none text-gold" /> {profile.phone}</p>}
              {profile?.address && <p className="mt-3 flex items-start gap-3"><MapPin size={16} className="mt-0.5 flex-none text-gold" /> {profile.address}</p>}
            </div>
          </aside>

          {/* Main panel */}
          <div>
            {tab === "details" && (
              <form onSubmit={handleSubmit} className="card space-y-6 p-7 md:p-10" noValidate>
                <div>
                  <h2 className="text-3xl font-semibold text-rosewood">My details</h2>
                  <p className="mt-2 text-sm text-cocoa/65">These are used to fill in your checkout form.</p>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>
                )}
                {saved && (
                  <p className="flex items-center gap-2 rounded-xl border border-[#166534]/25 bg-[#166534]/5 p-4 text-sm text-[#166534]">
                    <CheckCircle2 size={16} /> Your details have been saved.
                  </p>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-rosewood">Full name</label>
                    <input id="fullName" type="text" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="field" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-rosewood">Phone number</label>
                    <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 00000 00000" className="field" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-rosewood">Email address</label>
                  <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" />
                </div>
                <div>
                  <label htmlFor="address" className="mb-2 block text-sm font-semibold text-rosewood">Delivery address</label>
                  <textarea id="address" rows={3} autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House / flat no., street, locality, city, state, pincode" className="field" />
                </div>

                <button type="submit" disabled={saving} className="btn btn-primary w-full py-4 md:w-auto md:px-12">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            )}

            {tab === "orders" && <MyOrders />}
          </div>
        </div>
      </section>
    </>
  );
}
