/**
 * Site-wide business information for BHUMIKA COSMETIC.
 *
 * Contact details (phone, WhatsApp, email, address) are shown from this file, so
 * they always match what the business has published. The shop name, tagline and
 * delivery settings still come from the database (Admin > Settings).
 */
export const site = {
  name: "Bhumika Cosmetic",
  tagline: "Beauty essentials for every day, delivered to your door.",

  phone: "+91 74170 68105",
  email: "bhumikacosmeticc@gmail.com",
  address: "Shop, Street, No. 2, Kaveri Royal Apartment, Swarna Jayanti Nagar, Aligarh, Uttar Pradesh 202001",

  whatsapp: "https://wa.me/917417068105?text=Hello%20Bhumika%20Cosmetic",

  // Main navigation (desktop and mobile)
  nav: [
    { key: "home", label: "Home", href: "/" },
    { key: "shop", label: "Shop", href: "/shop" },
    { key: "cart", label: "Cart", href: "/cart" },
  ],
};
