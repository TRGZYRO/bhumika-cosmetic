# Bhumika Cosmetic: online cosmetics shop

A storefront and admin panel for Bhumika Cosmetic. Customers browse, search and filter products, add them to a cart and place cash-on-delivery orders. The owner and staff manage products, categories, orders, staff and shop settings from `/admin`.

**Stack:** React 19, Vite, Tailwind CSS v4, React Router, Framer Motion. Supabase (Postgres) stores the data. Firebase Authentication handles sign-in. Everything is deployed as a Vite site with serverless `/api` functions on Vercel.

## What's included

- **Shop:** homepage with categories and featured products, a shop page with search, category, brand, price and in-stock filters and sorting (filters are kept in the URL), product pages with related items, cart, and checkout.
- **Orders:** cash on delivery only. The server re-checks prices, delivery charges and stock on every order, so the browser can't set prices. Stock is reserved as the order is placed.
- **Accounts:** sign up and sign in with email or Google, a details page with a saved delivery address, and an order history with a progress timeline.
- **Admin (`/admin`):** dashboard (revenue, pending orders, low stock), products (photos, MRP, stock, visibility, homepage featuring), categories, orders (status updates and customer details), staff roles (owner only), and shop settings (name, contact, delivery charge, free-delivery threshold, tax).

## 1. Run it locally

Requires Node.js 22.13 or newer.

```bash
npm ci
cp .env.example .env.local     # fill in values (see section 3)
npm run dev                    # http://localhost:5175
```

With no environment variables set, the site still runs in **demo mode**: it shows a sample catalogue, the cart works, and checkout shows a confirmation without saving anything. The Shop, Cart, and Checkout pages can be previewed without any accounts.

## 2. Set up the database

Create a Supabase project. In the SQL editor, run every file in `supabase/migrations/` **in numeric order**, from `001` to `009`. The cosmetics migration (`009`) adds the product fields, the address field, and the shop categories. It also renames the café settings column.

Then create the first owner:

1. Sign up on the site with the owner's email.
2. In Supabase, add a row to `user_roles` with `role = 'owner'` for that user's `profiles.id`.

Only owners can grant roles afterwards, from **Admin → Staff**.

## 3. Environment variables

| Variable | Used by | Required |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser and `/api/products` | Yes, for a live shop |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/orders`, `/api/admin-data`, `/api/media` | Yes, for orders and admin. **Secret.** |
| `VITE_FIREBASE_API_KEY` and the other `VITE_FIREBASE_*` values | Browser sign-in. The server reuses the API key to verify tokens. | Yes, for accounts and admin |
| `SUPABASE_URL` | Server. Falls back to `VITE_SUPABASE_URL`. | No |
| `VITE_API_BASE_URL` | Browser, if `/api` is on another origin | No |

`VITE_` values are compiled into the site, so anyone can read them. Only put public values there. Never give a server secret a `VITE_` prefix. After changing a `VITE_` value, redeploy.

## 4. Deploy on Vercel

1. Push the repository to GitHub and import it in Vercel. `vercel.json` sets the build command, output folder, and the rewrite that makes direct links work.
2. Add the environment variables from section 3 under **Project Settings → Environment Variables**. Mark `SUPABASE_SERVICE_ROLE_KEY` as sensitive.
3. Deploy. Every push to the connected branch deploys automatically.

All `/api` routes run through one catch-all function (`api/[...route].js`). This keeps the project within the Vercel Hobby plan's function limit.

## 5. Making changes

- **Products, categories, prices, stock, and photos:** use **Admin → Products** and **Admin → Categories**. Photos are stored in the Supabase Storage bucket `menu-images`.
- **Shop name, contact, delivery charge, free-delivery threshold, tax:** **Admin → Shop settings**.
- **Demo catalogue** (shown only when the database is unavailable): `src/data/shop.js`.
- **Theme colours:** the `@theme` block at the top of `src/index.css`.
- **Header and footer links:** `src/data/site.js`.

## 6. Checks

```bash
npm run build     # production build
npm run lint      # oxlint: fix errors; warnings are style hints
```

Before going live, test one full order on a phone: search, filter, add to cart, checkout, then confirm the order appears in **Admin → Orders** and its stock count went down.

## Notes

- Cash on delivery is the only payment method. Online payment would need a gateway added to `api/orders` and the checkout page.
- Order status changes are made by staff in the admin. Customers see the progress on their account page.
- `AUTH_DIAGNOSTICS.md` covers sign-in troubleshooting.
