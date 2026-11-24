import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadCatalog } from "../lib/catalog";

const CatalogContext = createContext(null);

/**
 * Loads products, categories and shop settings once for the whole app.
 * `source` is "live" when the database answered, or "demo" when it did not.
 */
export function CatalogProvider({ children }) {
  const [state, setState] = useState({
    products: [],
    categories: [],
    shop: null,
    source: "live",
    loading: true,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const data = await loadCatalog();
    setState({ ...data, loading: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((data) => {
      if (!cancelled) setState({ ...data, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within a CatalogProvider");
  return ctx;
}
