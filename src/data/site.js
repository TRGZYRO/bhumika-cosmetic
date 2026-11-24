/**
 * Site-wide business information for BHUMIKA COSMETIC.
 *
 * Placeholders to replace with real details. The live shop reads the name, phone,
 * address and delivery settings from the database (Admin > Settings), so these
 * values only show when the database is not connected.
 */
export const site = {
  name: "Bhumika Cosmetic",
  tagline: "Beauty essentials for every day, delivered to your door.",

  phone: "+91 00000 00000",
  email: "hello@example.com",
  address: "Your shop address, City, State",

  whatsapp: "https://wa.me/910000000000?text=Hello%20Bhumika%20Cosmetic",

  // Main navigation (desktop and mobile)
  nav: [
    { key: "home", label: "Home", href: "/" },
    { key: "shop", label: "Shop", href: "/shop" },
    { key: "cart", label: "Cart", href: "/cart" },
  ],
};
