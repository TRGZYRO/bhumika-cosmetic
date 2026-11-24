import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/Login";
import LogoutPage from "./pages/auth/Logout";
import ProfilePage from "./pages/account/Profile";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminCategories from "./pages/admin/Categories";
import AdminOrders from "./pages/admin/Orders";
import AdminStaff from "./pages/admin/Staff";
import AdminSettings from "./pages/admin/Settings";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { CatalogProvider } from "./contexts/CatalogContext";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";

/** Old /menu links (from the café site) now point to the shop. */
function LegacyMenuRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/product/${id}` : "/shop"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<Product />} />
                <Route path="/menu" element={<Navigate to="/shop" replace />} />
                <Route path="/menu/:id" element={<LegacyMenuRedirect />} />
                <Route path="/cart" element={<Cart />} />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/logout" element={<LogoutPage />} />
              </Route>
              {/* Admin routes: protected and admin-only */}
              <Route
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/products" element={<AdminProducts />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/staff" element={<AdminStaff />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/menu" element={<Navigate to="/admin/products" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
