import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, User, Package, LogOut, CheckCircle2, Plus, Edit2, Trash2, Home, Building, Navigation2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import MyOrders from "../../components/MyOrders";
import Reveal from "../../components/Reveal";

/**
 * Customer account: a profile summary, editable details (including a saved delivery
 * address used at checkout), and the customer's order history.
 */
export default function ProfilePage() {
  const { user, profile, signOut, isAuthenticated } = useAuth();
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

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [modalForm, setModalForm] = useState({
    label: "Home",
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    latitude: null,
    longitude: null,
    is_default: false,
  });

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

  // Load saved addresses
  useEffect(() => {
    async function loadAddresses() {
      try {
        const data = await api.get("/api/addresses");
        setSavedAddresses(data.addresses || []);
      } catch (err) {
        console.error("Failed to load addresses:", err);
      } finally {
        setLoadingAddresses(false);
      }
    }
    if (isAuthenticated) loadAddresses();
  }, [isAuthenticated]);

  // Open add/edit address modal
  const openAddressModal = (address = null) => {
    setEditingAddress(address);
    if (address) {
      setModalForm({
        label: address.label || "Home",
        full_name: address.full_name || "",
        phone: address.phone || "",
        address_line1: address.address_line1 || "",
        address_line2: address.address_line2 || "",
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || "",
        landmark: address.landmark || "",
        latitude: address.latitude,
        longitude: address.longitude,
        is_default: address.is_default || false,
      });
    } else {
      setModalForm({
        label: "Home",
        full_name: form.full_name || "",
        phone: form.phone || "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        latitude: null,
        longitude: null,
        is_default: savedAddresses.length === 0,
      });
    }
    setShowAddressModal(true);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
  };

  const updateModal = (field, value) => {
    setModalForm((f) => ({ ...f, [field]: value }));
  };

  const validateModal = () => {
    const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;
    if (!modalForm.label.trim()) return "Please enter a label (e.g., Home, Work).";
    if (!modalForm.full_name.trim()) return "Please enter the full name.";
    if (!PHONE_PATTERN.test(modalForm.phone.trim())) return "Enter a valid phone number.";
    if (!modalForm.address_line1.trim()) return "Please enter the address line 1.";
    if (!modalForm.city.trim()) return "Please enter the city.";
    if (!modalForm.state.trim()) return "Please enter the state.";
    if (!modalForm.pincode.trim() || !/^[0-9]{6}$/.test(modalForm.pincode.trim())) return "Pincode should be 6 digits.";
    return null;
  };

  const handleSaveAddress = async () => {
    const validationError = validateModal();
    if (validationError) {
      alert(validationError);
      return;
    }
    setSavingAddress(true);
    try {
      if (editingAddress) {
        await api.put("/api/addresses", { id: editingAddress.id, ...modalForm });
      } else {
        await api.post("/api/addresses", modalForm);
      }
      closeAddressModal();
      const data = await api.get("/api/addresses");
      setSavedAddresses(data.addresses || []);
    } catch (err) {
      alert(err.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!confirm("Delete this address?")) return;
    try {
      await api.delete(`/api/addresses?id=${id}`);
      const data = await api.get("/api/addresses");
      setSavedAddresses(data.addresses || []);
    } catch (err) {
      alert(err.message || "Failed to delete address");
    }
  };

  const handleSetDefault = async (id) => {
    const addr = savedAddresses.find(a => a.id === id);
    if (!addr) return;
    try {
      await api.put("/api/addresses", { id, ...addr, is_default: true });
      const data = await api.get("/api/addresses");
      setSavedAddresses(data.addresses || []);
    } catch (err) {
      alert(err.message || "Failed to set default");
    }
  };

  // Label icons
  const labelIcons = { Home, Work: Building, Other: Navigation2 };
  const getLabelIcon = (label) => labelIcons[label] || MapPin;

  const tabs = [
    { key: "details", label: "My details", icon: User },
    { key: "addresses", label: "My addresses", icon: MapPin },
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

            {tab === "addresses" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold text-rosewood">My addresses</h2>
                    <p className="mt-2 text-sm text-cocoa/65">Manage your saved delivery addresses for faster checkout.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddressModal()}
                    className="btn btn-primary px-6 py-2.5 flex items-center gap-2 text-sm"
                  >
                    <Plus size={16} /> Add address
                  </button>
                </div>

                {loadingAddresses ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-rosewood border-t-transparent" />
                  </div>
                ) : savedAddresses.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {savedAddresses.map((addr) => {
                      const Icon = getLabelIcon(addr.label);
                      return (
                        <div
                          key={addr.id}
                          className={`relative p-5 rounded-2xl border-2 transition-all ${
                            addr.is_default
                              ? "border-rosewood bg-blush shadow-[0_0_0_2px_rgba(156,44,61,0.2)]"
                              : "border-petal hover:border-rose hover:bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl ${
                              addr.is_default ? "bg-rosewood text-white" : "bg-petal text-cocoa"
                            }`}>
                              <Icon size={20} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-cocoa truncate">{addr.label}</p>
                                {addr.is_default && (
                                  <span className="flex-none px-2 py-0.5 text-xs font-medium bg-gold/20 text-gold rounded-full">Default</span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-cocoa/70">{addr.full_name}</p>
                              <p className="text-sm text-cocoa/60 break-all">
                                {addr.address_line1}
                                {addr.address_line2 && `, ${addr.address_line2}`}
                                {`, ${addr.city}, ${addr.state} - ${addr.pincode}`}
                              </p>
                              {addr.landmark && (
                                <p className="mt-1 text-xs text-cocoa/50">Near: {addr.landmark}</p>
                              )}
                              <p className="mt-1 text-sm text-cocoa/60">📞 {addr.phone}</p>
                              {addr.latitude && addr.longitude && (
                                <p className="mt-1 text-xs text-cocoa/50">📍 {addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              {!addr.is_default && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}
                                  className="p-2 rounded-lg hover:bg-cocoa/10 text-cocoa/50 transition-colors"
                                  title="Set as default"
                                >
                                  <CheckCircle2 size={16} strokeWidth={2} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openAddressModal(addr); }}
                                className="p-2 rounded-lg hover:bg-cocoa/10 text-cocoa/50 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} strokeWidth={2} />
                              </button>
                              {savedAddresses.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                                  className="p-2 rounded-lg hover:bg-red/10 text-red/60 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          </div>
                          {addr.is_default && (
                            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-rosewood flex items-center justify-center">
                              <CheckCircle2 size={10} strokeWidth={2.5} className="text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card p-12 text-center text-cocoa/60">
                    <MapPin className="mx-auto mb-3 h-14 w-14 text-petal" strokeWidth={1.2} />
                    <p className="text-lg font-medium">No saved addresses yet</p>
                    <p className="mt-1 text-sm">Add an address to speed up future checkouts</p>
                    <button
                      type="button"
                      onClick={() => openAddressModal()}
                      className="btn btn-primary mt-4 px-6 py-2"
                    >
                      <Plus size={16} className="mr-1" /> Add your first address
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Add/Edit Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeAddressModal}>
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-petal p-5 rounded-t-3xl flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-rosewood">
                {editingAddress ? "Edit Address" : "Add New Address"}
              </h3>
              <button onClick={closeAddressModal} className="p-2 rounded-xl hover:bg-petal text-cocoa/50 transition-colors">
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-rosewood">Label</label>
                  <select
                    value={modalForm.label}
                    onChange={(e) => updateModal("label", e.target.value)}
                    className="field"
                  >
                    <option value="Home">🏠 Home</option>
                    <option value="Work">🏢 Work</option>
                    <option value="Other">📍 Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-rosewood">Set as default</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={modalForm.is_default}
                      onChange={(e) => updateModal("is_default", e.target.checked)}
                      className="h-5 w-5 rounded border-rosewood text-rosewood focus:ring-rosewood"
                    />
                    <label htmlFor="isDefault" className="text-sm text-cocoa cursor-pointer">Use as default delivery address</label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="modalFullName" className="mb-2 block text-sm font-semibold text-rosewood">Full name</label>
                  <input id="modalFullName" value={modalForm.full_name} onChange={(e) => updateModal("full_name", e.target.value)} className="field" autoComplete="name" />
                </div>
                <div>
                  <label htmlFor="modalPhone" className="mb-2 block text-sm font-semibold text-rosewood">Phone</label>
                  <input id="modalPhone" type="tel" value={modalForm.phone} onChange={(e) => updateModal("phone", e.target.value)} className="field" autoComplete="tel" placeholder="+91 00000 00000" />
                </div>
              </div>

              <div>
                <label htmlFor="modalAddress1" className="mb-2 block text-sm font-semibold text-rosewood">Address line 1</label>
                <input id="modalAddress1" value={modalForm.address_line1} onChange={(e) => updateModal("address_line1", e.target.value)} className="field" placeholder="House / flat no., building, street" />
              </div>
              <div>
                <label htmlFor="modalAddress2" className="mb-2 block text-sm font-semibold text-rosewood">Address line 2 (optional)</label>
                <input id="modalAddress2" value={modalForm.address_line2} onChange={(e) => updateModal("address_line2", e.target.value)} className="field" placeholder="Landmark, locality, apartment" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="modalCity" className="mb-2 block text-sm font-semibold text-rosewood">City</label>
                  <input id="modalCity" value={modalForm.city} onChange={(e) => updateModal("city", e.target.value)} className="field" />
                </div>
                <div>
                  <label htmlFor="modalState" className="mb-2 block text-sm font-semibold text-rosewood">State</label>
                  <input id="modalState" value={modalForm.state} onChange={(e) => updateModal("state", e.target.value)} className="field" />
                </div>
                <div>
                  <label htmlFor="modalPincode" className="mb-2 block text-sm font-semibold text-rosewood">Pincode</label>
                  <input id="modalPincode" value={modalForm.pincode} onChange={(e) => updateModal("pincode", e.target.value)} className="field" inputMode="numeric" placeholder="110001" />
                </div>
              </div>

              <div>
                <label htmlFor="modalLandmark" className="mb-2 block text-sm font-semibold text-rosewood">Landmark (optional)</label>
                <input id="modalLandmark" value={modalForm.landmark} onChange={(e) => updateModal("landmark", e.target.value)} className="field" placeholder="Nearby landmark" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-petal">
                <button
                  type="button"
                  onClick={closeAddressModal}
                  className="btn btn-ghost-dark flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  disabled={savingAddress}
                  className="btn btn-primary flex-1"
                >
                  {savingAddress ? "Saving…" : editingAddress ? "Update Address" : "Save Address"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
