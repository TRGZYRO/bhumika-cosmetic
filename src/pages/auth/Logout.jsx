import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function LogoutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    signOut().then(() => navigate("/login"));
  }, [signOut, navigate]);

  return (
    <section className="section-light min-h-screen flex items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <div className="ornament mb-6 text-rose">
          <span className="diamond" />
        </div>
        <h1 className="text-5xl font-semibold leading-tight text-rosewood">Signing out…</h1>
        <p className="mt-4 text-lg text-cocoa/75">
          You will be redirected to the home page in a moment.
        </p>
      </div>
    </section>
  );
}
