# Auth diagnostics added

The admin reservations API now returns distinct error codes for:
- Missing Authorization bearer token
- Missing Firebase Admin project ID, client email, or private key
- Firebase token expired, revoked, invalid, or project/audience mismatch
- Supabase URL or service-role key missing
- Supabase profile lookup/create failure
- Supabase user_roles lookup failure

Server logs use the `[AUTH_DIAGNOSTIC]` prefix. Never log or return the ID token,
private key, service-role key, or other credential values.

After deploying, open `/admin/reservations` and copy the exact error code shown.
Vercel runtime logs can also be filtered by `[AUTH_DIAGNOSTIC]`.

## Node.js runtime requirement

`firebase-admin` 14.x pulls in `jwks-rsa` 4.x, which depends on `jose` 6.x. `jose` 6 is ESM-only and
cannot be loaded with `require()` on Node versions older than 22.12 (or 20.19). Vercel must run
Node 22.12 or newer: set Project Settings → General → Node.js Version to 22.x. `package.json` declares
`"engines": { "node": "22.x" }` to match `.nvmrc`.

If the admin reservations tab shows `FIREBASE_ADMIN_INIT_FAILED` with a "failed to load on Node" message,
the runtime Node version is too old.

## jose override (required)

`firebase-admin` → `jwks-rsa@4` → `jose@6` (ESM-only). Vercel loads server code with `require()`, which
cannot load ESM-only `jose` (`ERR_REQUIRE_ESM`). `package.json` pins `jose` to `5.10.0` through
`overrides`, so `jwks-rsa` gets a CommonJS-compatible copy. Keep this override and the lockfile together.
