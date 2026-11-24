import { api } from "./api";

/**
 * Admin data access. Every call goes through /api/admin-data, which checks the
 * caller is an admin and uses the service role. Browser Supabase queries are not
 * used here, because login is Firebase and Supabase RLS cannot see the user.
 */
const r = (resource, extra = "") => `/api/admin-data?resource=${resource}${extra}`;

export const adminDb = {
  getDashboard: () => api.get(r("dashboard")),

  listProducts: async () => (await api.get(r("products"))).data || [],
  createProduct: (fields) => api.post(r("products"), fields),
  updateProduct: (id, fields) => api.patch(r("products", `&id=${id}`), fields),
  deleteProduct: (id) => api.del(r("products", `&id=${id}`)),

  listCategories: async () => (await api.get(r("categories"))).data || [],
  createCategory: (fields) => api.post(r("categories"), fields),
  updateCategory: (id, fields) => api.patch(r("categories", `&id=${id}`), fields),
  deleteCategory: (id) => api.del(r("categories", `&id=${id}`)),

  listOrders: async () => (await api.get(r("orders"))).data || [],
  updateOrder: (id, fields) => api.patch(r("orders", `&id=${id}`), fields),
  /** Deletes one order. The server only allows this for orders that are cancelled. */
  deleteOrder: (id) => api.del(r("orders", `&id=${id}`)),
  /** Deletes every cancelled order in one go. */
  deleteCancelledOrders: () => api.del(r("orders", "&scope=cancelled")),

  getStaff: async () => {
    const { profiles, roles } = await api.get(r("staff"));
    return { profiles: profiles || [], roles: roles || [] };
  },
  assignRole: (email, role) => api.post(r("staff"), { email, role }),

  getSettings: () => api.get(r("settings")),
  saveSettings: (settings) => api.put(r("settings"), settings),
};

/** Reads a File as base64 (without the data: prefix). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export const media = {
  list: async () => (await api.get("/api/media")).images || [],
  /** Uploads an image to Supabase Storage and returns its public URL. */
  upload: async (file) => {
    if (!file) return null;
    const data = await fileToBase64(file);
    const res = await api.post("/api/media", { filename: file.name, contentType: file.type, data });
    return res.url;
  },
  remove: (name) => api.del(`/api/media?name=${encodeURIComponent(name)}`),
};
