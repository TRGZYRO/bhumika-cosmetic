# Fixes applied

## Address save error (`invalid input syntax for type uuid`)
Cause: migration 010 created `addresses.user_id` as `uuid`, but every other user
column had been converted to `text` for Firebase UIDs (migration 005).

- **Run `supabase/migrations/012_fix_addresses_firebase_uid.sql`** in the Supabase SQL editor.
  It is safe to re-run.
- `/api/addresses` now validates IDs (returns 400 for malformed IDs instead of a
  database error), checks the address fields, and returns clean error messages.

## Slow checkout and page loads
- Firebase tokens were force-refreshed (a network call to Google) on every API
  request and on every auth change. Cached tokens are now used; Firebase renews them itself.
- Verified Firebase tokens are cached on the server for 5 minutes, which skips a
  Google round trip on warm requests.
- The route guard waited for the profile and roles before showing any protected
  page. It now waits only for sign-in state. Roles load in the background, and
  `AdminRoute` waits for them so admins are not redirected on refresh.
- The brand intro is shorter (about 1.6s instead of 2.5s, once per session).

## Security
- The hardcoded admin email now grants admin only when Firebase reports the email
  as verified. Previously anyone could register that email with a password and become admin.
- Server errors no longer expose raw database messages to the browser.

## Checkout bugs
- The map search box was bound to a ref, so typed text did not appear. It is now controlled.
- The map did not reinitialize on the second open, and could appear blank. It is now
  destroyed on close and rebuilt on open, and it opens at the saved address's pin.
- The delivery map coordinates were never sent with the order. They are now sent.
- The "Address line 2" field stores the landmark, so its label now says "Landmark".

## Cleanup
- Removed the stray `ssr-check.tmp.mjs` scratch file.
- The browser no longer writes directly to Supabase for profile rows (Firebase users
  have no Supabase session, so those writes were silently rejected). The server creates profiles.

## Account page not opening
- `src/pages/account/Profile.jsx` used `isAuthenticated` without reading it from
  `useAuth()`. The address-loading effect threw a ReferenceError, which unmounted the
  whole page (blank screen). It is now destructured.
- The address editor's close button used the `X` icon without importing it. It crashed as
  soon as "Add address" or "Edit" was opened. The icon is now imported.
- Checked every page by linting for undefined names, building, and rendering all 14
  routes in a test environment. These two bugs were the only crashes found.

## Checkout
- Signed-in shoppers with saved addresses no longer see the lower "Or enter a new
  address" form. Use the "Add new address" button at the top of the Delivery Address card.
  The delivery note field stays.
- The order is submitted from the address the shopper selected, so the form and the
  saved address cannot disagree. Guests and signed-in shoppers with no saved address still
  use the full form.
- A newly added address is selected automatically.
- Saved-address cards were nested buttons (invalid HTML), and their Edit/Delete icons
  were hidden (`opacity-0` with no `group` parent), so they could not be reached. Both
  are fixed here and on the account page's address list.
- While an order is being placed, a full-screen overlay with an animated loader and
  step messages is shown until the order is confirmed.

## Faster order placement
- `POST /api/orders` runs the signed-in check, the product lookup and the shop settings
  lookup at the same time, instead of one after another.
- Stock is reserved for all cart lines in parallel, not one line at a time. This matters
  more as the cart grows.
- If the order's items fail to save, the order is deleted and reserved stock is returned,
  so no half-saved order is left behind.
- The post-order address save no longer delays the shopper's confirmation.

## Admin: cancelling an order failed with "$.patch is not a function"
- `src/lib/adminDb.js` called `api.patch`, but the API client had no `patch` method.
  Order status changes, product edits and category edits all failed. `patch` is now added.

## Admin: delete cancelled orders
- Each cancelled order has a Delete button in the Orders tab.
- When any order is cancelled, a "Delete all cancelled" bar appears above the list.
- The server only deletes orders whose status is cancelled. Their line items are removed first.

## Order stuck on "Placing your order"
- The Firebase token wait (5 s), the Google token check on the server (8 s) and the order
  request (30 s) all have time limits now. A slow step no longer leaves the spinner running
  forever. If the 30 s limit is hit, the shopper is told to check My orders before retrying,
  because the order may already have been saved.

## Contact details and hero
- Phone is now +91 74170 68105 and WhatsApp links to wa.me/917417068105.
- Email is bhumikacosmeticc@gmail.com.
- Address is "Shop, Street, No. 2, Kaveri Royal Apartment, Swarna Jayanti Nagar, Aligarh, Uttar Pradesh 202001".
- The footer reads these from `src/data/site.js`, not the database, so they show the same
  everywhere. Admin > Settings no longer changes the footer's phone, email or address.
- The home hero heading and image are smaller on phones, and the grid columns can shrink,
  so the first banner fits on narrow Android screens.

## Admin: editing a product did not save
- Products saved with an empty field (for example no description, brand or how-to-use text)
  store that field as null. The edit form copied those nulls over its defaults, and the
  save handler called `.trim()` on them. The error was thrown before the save started, so
  nothing was sent and no message was shown. The form now keeps the empty default for
  null fields, and the text fields are null-safe.
- The same problem affected Admin > Settings when a field such as the tagline or phone was
  empty in the database. Settings now uses the same safe defaults.
