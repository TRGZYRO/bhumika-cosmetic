import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Loader from "./Loader";

/**
 * Shared shell for every page: brand intro, skip link, navigation, page content and footer.
 * Pages render only their own content through <Outlet />. Each route change replays a
 * soft page-in transition so navigation feels continuous rather than abrupt.
 */
export default function Layout() {
  const { pathname } = useLocation();

  // Start each new page at the top (React Router does not do this by default).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <Loader />
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main" className="relative flex-grow">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
