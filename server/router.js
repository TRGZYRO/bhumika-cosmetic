/**
 * Single dispatch table for every /api route.
 *
 * Vercel's Hobby plan caps a deployment at 12 serverless functions, so all
 * routes are served by ONE catch-all function (api/[...route].js).
 *
 * Each entry loads its handler lazily (dynamic import), so a module that fails
 * to load only breaks the route that needs it, not every route in the app.
 * The dev server (server/dev.js) uses the same table.
 */
export const ROUTES = {
  "admin-data": () => import("./routes/admin-data.js"),
  products: () => import("./routes/products.js"),
  orders: () => import("./routes/orders.js"),
  "my-orders": () => import("./routes/my-orders.js"),
  profile: () => import("./routes/profile.js"),
  media: () => import("./routes/media.js"),
};
