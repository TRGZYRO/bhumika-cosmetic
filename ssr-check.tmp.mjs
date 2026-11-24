import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
const h = React.createElement;
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const load = async (p) => (await server.ssrLoadModule(p)).default;
const named = async (p, n) => (await server.ssrLoadModule(p))[n];
const AuthProvider = await named("/src/contexts/AuthContext.jsx", "AuthProvider");
const CartProvider = await named("/src/contexts/CartContext.jsx", "CartProvider");
const CatalogProvider = await named("/src/contexts/CatalogContext.jsx", "CatalogProvider");
const Layout = await load("/src/components/Layout.jsx");
const P = {
  "/": await load("/src/pages/Home.jsx"),
  "/shop": await load("/src/pages/Shop.jsx"),
  "/product/p1": await load("/src/pages/Product.jsx"),
  "/cart": await load("/src/pages/Cart.jsx"),
  "/checkout": await load("/src/pages/Checkout.jsx"),
  "/login": await load("/src/pages/auth/Login.jsx"),
  "/account": await load("/src/pages/account/Profile.jsx"),
  "/nope": await load("/src/pages/NotFound.jsx"),
  "/admin": await load("/src/pages/admin/Dashboard.jsx"),
  "/admin/products": await load("/src/pages/admin/Products.jsx"),
  "/admin/categories": await load("/src/pages/admin/Categories.jsx"),
  "/admin/orders": await load("/src/pages/admin/Orders.jsx"),
  "/admin/staff": await load("/src/pages/admin/Staff.jsx"),
  "/admin/settings": await load("/src/pages/admin/Settings.jsx"),
};
let failures = 0;
function render(path, Page) {
  const pageRoute = h(Route, { path: "*", element: h(Page) });
  const layoutRoute = h(Route, { element: h(Layout) }, pageRoute);
  const routes = h(Routes, null, layoutRoute);
  const router = h(MemoryRouter, { initialEntries: [path] }, routes);
  const cart = h(CartProvider, null, router);
  const catalog = h(CatalogProvider, null, cart);
  const tree = h(AuthProvider, null, catalog);
  return renderToString(tree);
}
for (const [path, Page] of Object.entries(P)) {
  try {
    const html = render(path, Page);
    console.log(`ok   ${path.padEnd(20)} ${html.length} chars`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${path}: ${String(e.message).split("\n")[0]}`);
  }
}
await server.close();
process.exit(failures ? 1 : 0);
