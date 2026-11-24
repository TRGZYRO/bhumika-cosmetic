import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Wallet, Info, MapPin, Plus, Edit2, Trash2, Home, Building, Navigation2, MapPin as MapPinIcon, Search, X } from "lucide-react";
import Reveal from "../components/Reveal";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { calcTotals, formatPrice } from "../lib/catalog";
import PlacingOrderOverlay from "../components/PlacingOrderOverlay";

const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/**
 * Checkout: delivery details with saved addresses, map location picker, and order placement.
 * Orders go to /api/orders, which re-checks prices and stock on the server.
 */
export default function Checkout() {
  const { items, subtotal, itemCount, clearCart } = useCart();
  const { shop, source } = useCatalog();
  const { user, profile, isAuthenticated } = useAuth();
  const currency = shop?.currency || "INR";
  const totals = calcTotals(subtotal, shop);

  // Form state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    pincode: "",
    city: "",
    state: "",
    landmark: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [demoStamp] = useState(() => Date.now().toString(36).toUpperCase());

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);

  // Map state (Leaflet)
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // Default to India center
  const [mapMarker, setMapMarker] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Where the map should open: the saved address's pin, or null for the country view.
  const initialPosRef = useRef(null);

  // Signed-in shoppers with saved addresses pick one of them. The manual address form
  // is only used by guests, and by signed-in shoppers who have no saved address yet.
  const manualMode = !isAuthenticated || (!loadingAddresses && savedAddresses.length === 0);

  // Release the Leaflet map when leaving the page.
  useEffect(() => {
    return () => {
      if (mapInstance.current) mapInstance.current.remove();
      mapInstance.current = null;
      markerInstance.current = null;
    };
  }, []);

  // Pre-fill from the signed-in customer's details
  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || profile?.full_name || user?.displayName || "",
      phone: f.phone || profile?.phone || "",
      email: f.email || profile?.email || user?.email || "",
    }));
  }, [profile, user]);

  // Load saved addresses
  useEffect(() => {
    async function loadAddresses() {
      try {
        const data = await api.get("/api/addresses");
        setSavedAddresses(data.addresses || []);
        // Auto-select default address
        const defaultAddr = (data.addresses || []).find(a => a.is_default);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          fillFormFromAddress(defaultAddr);
        }
      } catch (err) {
        console.error("Failed to load addresses:", err);
      } finally {
        setLoadingAddresses(false);
      }
    }
    if (isAuthenticated) loadAddresses();
  }, [isAuthenticated]);

  // Fill form from selected address
  const fillFormFromAddress = (addr) => {
    setForm((f) => ({
      ...f,
      name: addr.full_name || f.name,
      phone: addr.phone || f.phone,
      address: [addr.address_line1, addr.address_line2].filter(Boolean).join(", "),
      pincode: addr.pincode || f.pincode,
      city: addr.city || f.city,
      state: addr.state || f.state,
      landmark: addr.landmark || f.landmark,
    }));
    if (addr.latitude && addr.longitude) {
      setMapCenter({ lat: addr.latitude, lng: addr.longitude });
      setMapMarker({ lat: addr.latitude, lng: addr.longitude });
      // Update map if loaded
      if (mapInstance.current && markerInstance.current) {
        const pos = [addr.latitude, addr.longitude];
        mapInstance.current.setView(pos, 14);
        markerInstance.current.setLatLng(pos);
      }
    }
  };

  // Handle address selection
  const handleAddressSelect = (address) => {
    setSelectedAddressId(address.id);
    fillFormFromAddress(address);
  };

  // Open add/edit address modal
  const openAddressModal = (address = null) => {
    setEditingAddress(address);
    const start =
      address?.latitude && address?.longitude
        ? { lat: Number(address.latitude), lng: Number(address.longitude) }
        : null;
    initialPosRef.current = start;
    setMapMarker(start);
    if (start) setMapCenter(start);
    if (address) {
      // Pre-fill modal form
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
        full_name: form.name || "",
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
    // Load map after modal opens
    setTimeout(() => loadLeafletMap(), 100);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchTerm("");
    if (mapInstance.current) mapInstance.current.remove();
    mapInstance.current = null;
    markerInstance.current = null;
    setMapLoaded(false);
  };

  // Modal form state
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

  // Load Leaflet map
  const loadLeafletMap = async () => {
    if (mapInstance.current) return;

    // Load Leaflet CSS if not already loaded
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // Load Leaflet JS if not already loaded
    if (!window.L) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
          script.crossOrigin = "";
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (err) {
        console.error("Failed to load Leaflet:", err);
        return;
      }
    }

    initMap();
    setMapLoaded(true);
  };

  // Initialize Leaflet map
  const initMap = () => {
    if (!mapRef.current || mapInstance.current) return;
    try {
      // Fix for Leaflet marker icon paths
      delete window.L.Icon.Default.prototype._getIconUrl;
      window.L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const start = initialPosRef.current || { lat: 20.5937, lng: 78.9629 };
      mapInstance.current = window.L.map(mapRef.current, {
        center: [start.lat, start.lng],
        zoom: initialPosRef.current ? 15 : 5,
        zoomControl: true,
      });

      // Add OpenStreetMap tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);

      // Create draggable marker
      markerInstance.current = window.L.marker([start.lat, start.lng], {
        draggable: true,
        title: "Delivery location",
      }).addTo(mapInstance.current);

      // Handle marker drag
      markerInstance.current.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setMapMarker({ lat: pos.lat, lng: pos.lng });
        setModalForm((f) => ({ ...f, latitude: pos.lat, longitude: pos.lng }));
        reverseGeocode({ lat: pos.lat, lng: pos.lng });
      });

      // Handle map click
      mapInstance.current.on("click", (e) => {
        const pos = e.latlng;
        setMapMarker({ lat: pos.lat, lng: pos.lng });
        if (markerInstance.current) markerInstance.current.setLatLng(pos);
        setModalForm((f) => ({ ...f, latitude: pos.lat, longitude: pos.lng }));
        reverseGeocode({ lat: pos.lat, lng: pos.lng });
      });

    } catch (err) {
      console.error("Map init error:", err);
    }
  };

  // Search places using Photon API (komoot)
  const searchPlaces = useCallback(async (query) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&osm_tag=!highway&bbox=68.1,6.5,97.4,37.1` // India bounding box
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setSearchResults(data.features);
          setShowSearchResults(true);
        } else {
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } catch (err) {
        console.error("Photon search error:", err);
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
  }, []);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    searchPlaces(value);
  };

  // Select a search result
  const selectSearchResult = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const pos = { lat, lng };

    setMapCenter(pos);
    setMapMarker(pos);
    if (mapInstance.current) mapInstance.current.setView([lat, lng], 14);
    if (markerInstance.current) markerInstance.current.setLatLng([lat, lng]);

    setModalForm((f) => ({ ...f, latitude: lat, longitude: lng }));
    fillAddressFromPhoton(feature);

    setSearchResults([]);
    setShowSearchResults(false);
    setSearchTerm(feature.properties.name || "");
  };

  // Fill form from Photon result
  const fillAddressFromPhoton = (feature) => {
    const props = feature.properties;

    const addressLine1 = [
      props.housenumber,
      props.street,
    ].filter(Boolean).join(" ");

    setModalForm((f) => ({
      ...f,
      address_line1: addressLine1 || props.name || f.address_line1,
      city: props.city || props.town || props.village || props.municipality || f.city,
      state: props.state || f.state,
      pincode: props.postcode || f.pincode,
    }));
  };

  // Reverse geocode using Photon API
  const reverseGeocode = async (pos) => {
    try {
      const response = await fetch(
        `https://photon.komoot.io/reverse?lat=${pos.lat}&lon=${pos.lng}&limit=1`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        fillAddressFromPhoton(data.features[0]);
      }
    } catch (err) {
      console.error("Reverse geocode error:", err);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(coords);
        setMapMarker(coords);
        if (mapInstance.current) mapInstance.current.setView([coords.lat, coords.lng], 14);
        if (markerInstance.current) markerInstance.current.setLatLng([coords.lat, coords.lng]);
        setModalForm((f) => ({ ...f, latitude: coords.lat, longitude: coords.lng }));
        reverseGeocode(coords);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Unable to retrieve your location. Please enable location access or search manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Update field
  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Update modal field
  const updateModal = (field, value) => {
    setModalForm((f) => ({ ...f, [field]: value }));
  };

  // Validate main form
  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!PHONE_PATTERN.test(form.phone.trim())) next.phone = "Enter a valid phone number.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.address.trim().length < 10) next.address = "Please enter your full delivery address.";
    if (form.pincode.trim() && !/^[0-9]{6}$/.test(form.pincode.trim())) next.pincode = "Pincode should be 6 digits.";
    if (!form.city.trim()) next.city = "Please enter your city.";
    if (!form.state.trim()) next.state = "Please enter your state.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Validate modal form
  const validateModal = () => {
    if (!modalForm.label.trim()) return "Please enter a label (e.g., Home, Work).";
    if (!modalForm.full_name.trim()) return "Please enter the full name.";
    if (!PHONE_PATTERN.test(modalForm.phone.trim())) return "Enter a valid phone number.";
    if (!modalForm.address_line1.trim()) return "Please enter the address line 1.";
    if (!modalForm.city.trim()) return "Please enter the city.";
    if (!modalForm.state.trim()) return "Please enter the state.";
    if (!modalForm.pincode.trim() || !/^[0-9]{6}$/.test(modalForm.pincode.trim())) return "Pincode should be 6 digits.";
    return null;
  };

  // Save address
  const handleSaveAddress = async () => {
    const validationError = validateModal();
    if (validationError) {
      alert(validationError);
      return;
    }
    setSavingAddress(true);
    try {
      const result = editingAddress
        ? await api.put("/api/addresses", { id: editingAddress.id, ...modalForm })
        : await api.post("/api/addresses", modalForm);
      closeAddressModal();
      // Reload addresses
      const data = await api.get("/api/addresses");
      setSavedAddresses(data.addresses || []);
      // Use the address that was just added (or edited, if it was the one selected).
      const saved = result?.address;
      if (saved && (!editingAddress || selectedAddressId === saved.id)) {
        setSelectedAddressId(saved.id);
        fillFormFromAddress(saved);
      }
    } catch (err) {
      alert(err.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  // Delete address
  const handleDeleteAddress = async (id) => {
    if (!confirm("Delete this address?")) return;
    try {
      await api.delete(`/api/addresses?id=${id}`);
      const data = await api.get("/api/addresses");
      setSavedAddresses(data.addresses || []);
      if (selectedAddressId === id) {
        setSelectedAddressId(null);
        // Select new default if available
        const newDefault = (data.addresses || []).find(a => a.is_default);
        if (newDefault) {
          setSelectedAddressId(newDefault.id);
          fillFormFromAddress(newDefault);
        }
      }
    } catch (err) {
      alert(err.message || "Failed to delete address");
    }
  };

  // Set default address
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

  // Customer details taken from a saved address the shopper picked.
  const customerFromAddress = (addr) => ({
    name: (addr.full_name || "").trim(),
    phone: (addr.phone || "").trim(),
    email: EMAIL_PATTERN.test(form.email.trim()) ? form.email.trim() : "",
    address: [addr.address_line1, addr.address_line2].filter(Boolean).join(", ").trim(),
    pincode: (addr.pincode || "").trim(),
    city: (addr.city || "").trim(),
    state: (addr.state || "").trim(),
    landmark: (addr.landmark || "").trim(),
    notes: form.notes.trim(),
    latitude: addr.latitude != null ? Number(addr.latitude) : null,
    longitude: addr.longitude != null ? Number(addr.longitude) : null,
  });

  // Handle order submission
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    let customer;
    if (manualMode) {
      if (!validate()) return;
      customer = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        pincode: form.pincode.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        landmark: form.landmark.trim(),
        notes: form.notes.trim(),
        latitude: mapMarker?.lat ?? null,
        longitude: mapMarker?.lng ?? null,
      };
    } else {
      if (loadingAddresses) {
        setError("Your saved addresses are still loading. Please try again in a moment.");
        return;
      }
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!addr) {
        setError("Please choose a delivery address.");
        return;
      }
      customer = customerFromAddress(addr);
    }

    setSubmitting(true);
    try {
      if (source === "demo") {
        const demoNumber = "DEMO-" + demoStamp;
        setConfirmation({ name: customer.name, orderNumber: demoNumber, total: totals.total, demo: true });
        clearCart();
        return;
      }

      const data = await api.post(
        "/api/orders",
        {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          customer,
          paymentMethod: "cod",
        },
        {
          timeoutMs: 30000,
          timeoutMessage:
            "The order is taking too long to confirm. Please check My orders before trying again, so you don't place it twice.",
        }
      );
      setConfirmation({ name: customer.name, orderNumber: data.order.order_number, total: data.order.total_amount });
      clearCart();

      // Save a new manual address for next time. Fire and forget: the shopper already
      // sees the confirmation, so there is no reason to keep them waiting on it.
      if (isAuthenticated && !selectedAddressId) {
        const addressToSave = {
          label: "Home",
          full_name: customer.name,
          phone: customer.phone,
          address_line1: customer.address.split(",")[0]?.trim() || customer.address,
          address_line2: customer.address.split(",").slice(1).join(",").trim() || "",
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
          landmark: customer.landmark,
          latitude: customer.latitude || null,
          longitude: customer.longitude || null,
          is_default: savedAddresses.length === 0,
        };
        api.post("/api/addresses", addressToSave).catch((err) => console.warn("Failed to auto-save address:", err));
      }
    } catch (err) {
      setError(err.message || "We couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (id, label, props = {}) => (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-rosewood">{label}</label>
      <input
        id={id}
        value={form[id]}
        onChange={(e) => update(id, e.target.value)}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        className="field"
        {...props}
      />
      {errors[id] && <p id={`${id}-error`} className="mt-1.5 text-sm text-[#b42318]">{errors[id]}</p>}
    </div>
  );

  if (confirmation) {
    return (
      <section className="section-light flex min-h-screen items-center justify-center px-6 py-28">
        <Reveal className="mx-auto max-w-lg text-center">
          <span className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#166534] shadow-sm">
            <CheckCircle2 size={36} strokeWidth={1.5} />
          </span>
          <h1 className="text-5xl font-semibold leading-tight text-rosewood">Thank you, {confirmation.name.split(" ")[0]}!</h1>
          <p className="mt-4 text-lg text-cocoa/75">
            Your order <span className="font-semibold text-rosewood">{confirmation.orderNumber}</span> has been placed.
            You will pay {formatPrice(confirmation.total, currency)} in cash when it arrives.
          </p>
          {confirmation.demo && (
            <p className="mt-6 rounded-2xl border border-gold/50 bg-white p-4 text-sm text-cocoa/75">
              <Info size={15} className="mr-1.5 inline text-gold" />
              Demo mode: no database is connected, so this order was not saved.
            </p>
          )}
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/shop" className="btn btn-primary px-8 py-4">Continue shopping</Link>
            {isAuthenticated && (
              <Link to="/account" className="btn btn-ghost-dark px-8 py-4">View my orders</Link>
            )}
          </div>
        </Reveal>
      </section>
    );
  }

  if (itemCount === 0) {
    return (
      <section className="section-light flex min-h-screen items-center justify-center px-6 py-24 text-center">
        <div>
          <h1 className="text-4xl font-semibold text-rosewood">Your cart is empty</h1>
          <Link to="/shop" className="btn btn-primary mt-8">Go to shop</Link>
        </div>
      </section>
    );
  }

  // Address label icons
  const labelIcons = { Home, Work: Building, Other: Navigation2 };
  const getLabelIcon = (label) => labelIcons[label] || MapPinIcon;

  return (
    <section className="section-light px-6 pb-28 pt-36 md:pt-44">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-10 text-5xl font-semibold leading-tight text-rosewood md:text-6xl">Checkout</h1>

        <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            {/* Saved Addresses Section */}
            {isAuthenticated && (
              <div className="card p-7 md:p-9">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-rosewood flex items-center gap-2">
                    <MapPin size={22} strokeWidth={1.6} /> Delivery Address
                  </h2>
                  <button
                    type="button"
                    onClick={() => openAddressModal()}
                    className="btn btn-ghost-dark text-sm px-4 py-2 flex items-center gap-2"
                  >
                    <Plus size={16} /> Add new address
                  </button>
                </div>

                {loadingAddresses ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-rosewood border-t-transparent" />
                  </div>
                ) : savedAddresses.length > 0 ? (
                  <div className="space-y-3">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      const Icon = getLabelIcon(addr.label);
                      return (
                        <div
                          key={addr.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => handleAddressSelect(addr)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleAddressSelect(addr);
                            }
                          }}
                          className={`relative w-full cursor-pointer p-4 rounded-2xl border-2 transition-all text-left ${
                            isSelected
                              ? "border-rosewood bg-blush shadow-[0_0_0_2px_rgba(156,44,61,0.2)]"
                              : "border-petal hover:border-rose hover:bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
                              isSelected ? "bg-rosewood text-white" : "bg-petal text-cocoa"
                            }`}>
                              <Icon size={18} strokeWidth={1.8} />
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
                            </div>
                            <div className="flex items-center gap-1">
                              {!isSelected && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}
                                  className="p-1.5 rounded-lg hover:bg-cocoa/10 text-cocoa/50 transition-colors"
                                  title="Set as default"
                                >
                                  <CheckCircle2 size={16} strokeWidth={2} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openAddressModal(addr); }}
                                className="p-1.5 rounded-lg hover:bg-cocoa/10 text-cocoa/50 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} strokeWidth={2} />
                              </button>
                              {savedAddresses.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                                  className="p-1.5 rounded-lg hover:bg-red/10 text-red/60 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-rosewood flex items-center justify-center">
                              <CheckCircle2 size={10} strokeWidth={2.5} className="text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-cocoa/60">
                    <MapPin className="mx-auto mb-3 h-12 w-12 text-petal" strokeWidth={1.2} />
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

            {/* Delivery details: guests and signed-in shoppers with no saved address; otherwise the note only */}
            {manualMode ? (
            <div className="card p-7 md:p-9">
              <h2 className="mb-6 text-2xl font-semibold text-rosewood">Delivery details</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {field("name", "Full name", { autoComplete: "name" })}
                {field("phone", "Phone number", { type: "tel", autoComplete: "tel", placeholder: "+91 00000 00000" })}
                {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
                {field("pincode", "Pincode", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "110001" })}
              </div>
              <div className="grid gap-5 md:grid-cols-2 mt-5">
                {field("city", "City", { autoComplete: "address-level2" })}
                {field("state", "State", { autoComplete: "address-level1" })}
              </div>
              <div className="mt-5">
                <label htmlFor="address" className="mb-2 block text-sm font-semibold text-rosewood">Address line 1</label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? "address-error" : undefined}
                  autoComplete="street-address"
                  className="field"
                  placeholder="House / flat no., building, street"
                />
                {errors.address && <p id="address-error" className="mt-1.5 text-sm text-[#b42318]">{errors.address}</p>}
              </div>
              <div className="mt-5">
                <label htmlFor="address2" className="mb-2 block text-sm font-semibold text-rosewood">Landmark (optional)</label>
                <input
                  id="address2"
                  value={form.landmark}
                  onChange={(e) => update("landmark", e.target.value)}
                  autoComplete="address-line2"
                  className="field"
                  placeholder="Landmark, locality, apartment name"
                />
              </div>
              <div className="mt-5">
                <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-rosewood">Note for the delivery (optional)</label>
                <input id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} className="field" placeholder="e.g. call before arriving" />
              </div>
            </div>
            ) : (
              <div className="card p-7 md:p-9">
                <h2 className="mb-6 text-2xl font-semibold text-rosewood">Delivery note</h2>
                <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-rosewood">Note for the delivery (optional)</label>
                <input id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} className="field" placeholder="e.g. call before arriving" />
              </div>
            )}

            <div className="card p-7 md:p-9">
              <h2 className="mb-6 text-2xl font-semibold text-rosewood">Payment</h2>
              <div className="flex items-start gap-4 rounded-2xl border-2 border-rose bg-blush p-5">
                <Wallet size={22} strokeWidth={1.6} className="mt-0.5 text-rosewood" />
                <div>
                  <p className="font-semibold text-cocoa">Cash on delivery</p>
                  <p className="text-sm text-cocoa/70">Pay in cash when your order is delivered.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="card h-fit p-7 lg:sticky lg:top-32">
            <h2 className="mb-5 text-2xl font-semibold text-rosewood">Your order</h2>
            <ul className="mb-6 max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.productId} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-cocoa">
                    {item.name}
                    {item.sizeLabel && <span className="text-cocoa/55"> · {item.sizeLabel}</span>}
                    <span className="text-cocoa/55"> × {item.quantity}</span>
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity, currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-3 border-t border-petal pt-5 text-sm">
              <div className="flex justify-between"><dt className="text-cocoa/70">Subtotal</dt><dd>{formatPrice(totals.subtotal, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-cocoa/70">Delivery</dt><dd>{totals.deliveryCharge === 0 ? "Free" : formatPrice(totals.deliveryCharge, currency)}</dd></div>
              {totals.taxAmount > 0 && <div className="flex justify-between"><dt className="text-cocoa/70">Tax</dt><dd>{formatPrice(totals.taxAmount, currency)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-petal pt-4">
                <dt className="text-lg font-semibold">To pay</dt>
                <dd className="text-2xl font-semibold text-rosewood">{formatPrice(totals.total, currency)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-5 rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || (isAuthenticated && loadingAddresses)} className="btn btn-primary mt-7 w-full py-4">
              {submitting ? "Placing order…" : <>Place order <ArrowRight size={18} /></>}
            </button>
            <Link to="/cart" className="mt-4 block text-center text-sm font-semibold text-rosewood hover:text-rose">
              Edit cart
            </Link>
          </aside>
        </form>
      </div>

      {submitting && <PlacingOrderOverlay />}

      {/* Add/Edit Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeAddressModal}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

              {/* Map Section */}
              <div className="border-t border-petal pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-rosewood flex items-center gap-2">
                    <MapPin size={18} strokeWidth={1.6} /> Mark location on map
                  </h4>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="btn btn-ghost-dark text-sm px-3 py-1.5 flex items-center gap-1.5"
                    title="Use my current location"
                  >
                    <Navigation2 size={14} /> Current location
                  </button>
                </div>
                <div className="mb-3 relative">
                  <label className="sr-only" htmlFor="mapSearch">Search place</label>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cocoa/40" />
                  <input
                    ref={searchInputRef}
                    id="mapSearch"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleSearchChange(e);
                    }}
                    onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    placeholder="Search for a place (e.g., Connaught Place, Delhi)..."
                    className="field pl-10"
                    autoComplete="off"
                  />
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-petal shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((feature, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectSearchResult(feature)}
                          className="w-full px-4 py-3 text-left hover:bg-petal transition-colors"
                        >
                          <p className="font-medium text-cocoa">{feature.properties.name}</p>
                          <p className="text-xs text-cocoa/50 truncate">
                            {[
                              feature.properties.housenumber,
                              feature.properties.street,
                              feature.properties.city,
                              feature.properties.state,
                              feature.properties.postcode,
                            ].filter(Boolean).join(", ")}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  ref={mapRef}
                  className="h-80 rounded-2xl border border-petal overflow-hidden"
                  style={{ minHeight: "320px" }}
                >
                  {!mapLoaded && (
                    <div className="flex h-full items-center justify-center bg-petal/30">
                      <div className="flex flex-col items-center gap-3 text-cocoa/60">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-rosewood border-t-transparent" />
                        <p className="text-sm">Loading map...</p>
                      </div>
                    </div>
                  )}
                </div>
                {(modalForm.latitude && modalForm.longitude) && (
                  <p className="mt-2 text-xs text-cocoa/50 text-center">
                    Selected: {modalForm.latitude.toFixed(6)}, {modalForm.longitude.toFixed(6)}
                  </p>
                )}
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
    </section>
  );
}