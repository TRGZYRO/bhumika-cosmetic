import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import Logo from "../../components/Logo";

/** Official Google "G" mark, shown on the Google sign-in/sign-up button. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const USER_NOT_FOUND =
  "This email address is not registered. Please create an account to continue.";

/**
 * Authentication screen — Bhumika Cosmetic.
 *
 * Single page handling login, sign up, forgot password, and email
 * verification-pending states. Split layout: brand panel on desktop, form on the right.
 *
 * Login behaviour (PHASE 4):
 *   Case A — no account:         "Account not found" / create account action
 *   Case B — wrong password:     "Incorrect password" / forgot password action
 *   Case C — correct credentials: sign in, restore session, redirect home
 *
 * Registration behaviour (PHASE 4):
 *   Case A — email registered:   "Email already registered" / login instead
 *   Case B — new email:          create Firebase account, send verification,
 *                                 verification-pending screen, resend allowed
 *   Case C — error:              friendly message, never stack traces
 */
export default function LoginPage() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    setUsername,
    sendPasswordReset,
    resendVerification,
    checkVerification,
    demoMode,
  } = useAuth();
  const navigate = useNavigate();

  // Screens: "login" | "signup" | "forgot" | "verify" | "username"
  // "username" is shown once after a brand-new Google registration.
  const [screen, setScreen] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", fullName: "", username: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userNotFoundEmail, setUserNotFoundEmail] = useState("");

  const verifyInterval = useRef(null);

  const clearMessages = () => { setError(""); setSuccess(""); };

  const isVerifyScreen = screen === "verify";
  const isUsernameScreen = screen === "username";

  // Auto-detect email verification when the user returns from Gmail (Page
  // Visibility API) plus a polling fallback while the verify screen is open.
  useEffect(() => {
    if (!isVerifyScreen) {
      if (verifyInterval.current) {
        clearInterval(verifyInterval.current);
        verifyInterval.current = null;
      }
      return;
    }

    // Skip polling in demo mode.
    if (demoMode) return;

    let cancelled = false;

    async function recheck() {
      if (cancelled) return;
      try {
        const verified = await checkVerification();
        if (verified) {
          if (verifyInterval.current) {
            clearInterval(verifyInterval.current);
            verifyInterval.current = null;
          }
          setSuccess("Email verified! Redirecting…");
          setTimeout(() => navigate("/"), 800);
        }
      } catch {
        // Session may have expired; stop polling.
        if (verifyInterval.current) {
          clearInterval(verifyInterval.current);
          verifyInterval.current = null;
        }
      }
    }

    // Immediate check on mount (handles already-verified users).
    recheck();

    // Recheck when the tab becomes visible again (user returned from Gmail).
    function onVisibilityChange() {
      if (!cancelled && document.visibilityState === "visible") {
        recheck();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Polling fallback while the screen is open.
    verifyInterval.current = setInterval(recheck, 3000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (verifyInterval.current) {
        clearInterval(verifyInterval.current);
        verifyInterval.current = null;
      }
    };
  }, [isVerifyScreen, checkVerification, demoMode, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      if (screen === "login") {
        await signIn({ email: form.email, password: form.password });
        navigate("/");
      } else {
        await signUp({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
        });
        // New account created — verification email sent. Go to verify screen.
        setVerifyEmail(form.email);
        setScreen("verify");
        setSuccess("Verification email sent. Please check your inbox.");
      }
    } catch (err) {
      const msg = err.message || "Something went wrong. Please try again.";
      if (msg === USER_NOT_FOUND) {
        setUserNotFoundEmail(form.email);
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** Continue with Google: new accounts are asked for a username next. */
  const handleGoogle = async () => {
    clearMessages();
    setSubmitting(true);
    try {
      const { isNewUser } = await signInWithGoogle();
      if (isNewUser) {
        setForm((prev) => ({ ...prev, username: "" }));
        setScreen("username");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Save the username chosen after Google registration. */
  const handleUsername = async (e) => {
    e.preventDefault();
    clearMessages();
    const candidate = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(candidate)) {
      setError("Use 3-20 characters: letters, numbers, or underscores.");
      return;
    }
    setSubmitting(true);
    try {
      await setUsername(candidate);
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not save your username. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      await sendPasswordReset(resetEmail);
      setSuccess("If an account exists for this email, a password reset link has been sent.");
      setResetEmail("");
    } catch (err) {
      setError(err.message || "Unable to send reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (e) => {
    e && e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      await resendVerification();
      setSuccess("Verification email sent again. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Unable to resend verification email.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, id, type, value, onChange, placeholder, extra = "") => (
    <div key={id} className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-rosewood">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={
            id === "email"
              ? "email"
              : id === "password"
                ? screen === "login"
                  ? "current-password"
                  : "new-password"
                : "name"
          }
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`field pr-10 ${extra}`}
        />
      </div>
    </div>
  );

  const button = (children, disabled) => (
    <button
      type="submit"
      disabled={disabled}
      className={`btn w-full py-4 disabled:cursor-wait disabled:opacity-70 btn-primary`}
    >
      {children}
    </button>
  );

  const goLogin = () => {
    clearMessages();
    setScreen("login");
  };
  const goSignup = () => {
    clearMessages();
    setScreen("signup");
  };
  const goSignupWithEmail = (email) => {
    clearMessages();
    setForm((prev) => ({ ...prev, email }));
    setScreen("signup");
  };
  const goForgot = () => {
    clearMessages();
    setScreen("forgot");
  };
  const goVerify = () => {
    clearMessages();
    setScreen("verify");
  };

  return (
    <section className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel (desktop) */}
      <aside className="section-dark relative hidden flex-col justify-between overflow-hidden p-14 lg:flex">
        <Logo variant="footer" />
        <div className="max-w-md">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-petal">Your beauty account</p>
          <h2 className="text-6xl font-semibold leading-[0.98] text-white">
            Everything you love, <span className="italic text-petal">in one place.</span>
          </h2>
          <ul className="mt-10 space-y-4 text-base text-mauve">
            <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Track your orders from start to delivery</li>
            <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Faster checkout with your saved address</li>
            <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Personal details kept private and secure</li>
          </ul>
        </div>
        <p className="text-xs text-mauve/70">&copy; Bhumika Cosmetic</p>
      </aside>

      <div className="section-light flex items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md w-full">
        {/* Brand header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold bg-rosewood font-display text-2xl font-semibold text-gold lg:hidden">
            B
          </div>
          <div className="ornament mb-6 text-gold inline-block lg:hidden">
            <span className="diamond" />
          </div>
          <h1 className="text-5xl font-semibold leading-tight text-rosewood tracking-tight">
            {isVerifyScreen
              ? "Verify your email"
              : isUsernameScreen
              ? "Choose a username"
              : screen === "signup"
              ? "Create an account"
              : "Welcome back"}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-cocoa/75">
            {isVerifyScreen
              ? "We sent a verification email to confirm your address. Open it and click the link, then return here."
              : screen === "username"
              ? "Pick a name for your account. Use 3-20 letters, numbers, or underscores."
              : screen === "signup"
              ? "Join Bhumika Cosmetic to track orders, save your address and check out faster."
              : "Sign in to your Bhumika Cosmetic account to view your orders and details."}
          </p>
        </div>

        <form onSubmit={isUsernameScreen ? handleUsername : handleSubmit} className="space-y-4" noValidate>
          {!error ? null : (
            <>
              {error === USER_NOT_FOUND ? (
                <div className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">!</span>
                    <div>
                      <p className="font-semibold text-[#b42318]">User Not Found</p>
                      <p className="text-[#b42318]">{error}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goSignupWithEmail(userNotFoundEmail || form.email)}
                    className="w-auto py-2 px-4 rounded-xl border border-[#b42318]/50 text-[#b42318] font-medium hover:bg-[#b42318]/10 transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              ) : (
                <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318] flex items-start gap-3">
                  <span className="mt-0.5">!</span>
                  {error}
                </p>
              )}
            </>
          )}
          {success && !isVerifyScreen ? (
            <p className="rounded-xl border border-rose/30 bg-rose/5 p-4 text-sm text-rose flex items-start gap-3">
              <span className="mt-0.5">✓</span>
              {success}
            </p>
          ) : null}

          {/* Email (shown on most screens) */}
          {!isVerifyScreen && !isUsernameScreen && (
            <>
              {field(
                "Email address",
                "email",
                "email",
                form.email,
                (e) => setForm({ ...form, email: e.target.value }),
                "you@example.com"
              )}
              {screen === "signup" && (
                <>
                  {field(
                    "Full name",
                    "fullName",
                    "text",
                    form.fullName,
                    (e) => setForm({ ...form, fullName: e.target.value }),
                    "Your full name"
                  )}
                  <div className="relative">
                    {field(
                      "Password",
                      "password",
                      showPassword ? "text" : "password",
                      form.password,
                      (e) => setForm({ ...form, password: e.target.value }),
                      "••••••••"
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center p-1 text-cocoa/50 hover:text-cocoa"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={1.4} /> : <Eye size={18} strokeWidth={1.4} />}
                    </button>
                  </div>
                </>
              )}
              {screen === "login" && (
                <div className="relative">
                  {field(
                    "Password",
                    "password",
                    showPassword ? "text" : "password",
                    form.password,
                    (e) => setForm({ ...form, password: e.target.value }),
                    "••••••••"
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center p-1 text-cocoa/50 hover:text-cocoa"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={1.4} /> : <Eye size={18} strokeWidth={1.4} />}
                  </button>
                </div>
              )}
              {screen === "forgot" && (
                field(
                  "Email address",
                  "resetEmail",
                  "email",
                  resetEmail,
                  (e) => setResetEmail(e.target.value),
                  "you@example.com"
                )
              )}
            </>
          )}

          {isUsernameScreen &&
            field(
              "Username",
              "username",
              "text",
              form.username,
              (e) => setForm({ ...form, username: e.target.value }),
              "e.g. raunaq_fan"
            )}

          <div className="relative">
            {screen === "forgot" ? (
              button("Send reset email", submitting)
            ) : isVerifyScreen ? (
              <>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={submitting}
                  className="w-full py-3 btn btn-ghost-light border text-sm"
                >
                  {submitting ? <Loader2 size={16} className="mr-2" /> : ""} Resend verification email
                </button>
                <p className="mt-4 text-xs text-mauve/60 text-center">
                  Didn't receive it? Check your spam folder, or{" "}
                  <button type="button" onClick={goLogin} className="text-rose font-semibold underline underline-offset-4 hover:text-white">
                    sign in
                  </button>
                  if you already verified.
                </p>
              </>
            ) : (
              button(
                screen === "username"
                  ? submitting ? "Saving…" : "Save username"
                  : submitting ? "Please wait…" : screen === "login" ? "Sign in" : "Create account",
                submitting
              )
            )}
          </div>

          {!isVerifyScreen && !isUsernameScreen && screen !== "forgot" && (
            <>
              <div className="flex items-center gap-4 pt-2">
                <span className="h-px flex-1 bg-cocoa/15" />
                <span className="text-xs uppercase tracking-widest text-cocoa/50">or</span>
                <span className="h-px flex-1 bg-cocoa/15" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="btn w-full py-4 border border-cocoa/20 bg-white text-cocoa hover:bg-cocoa/5 disabled:cursor-wait disabled:opacity-70 flex items-center justify-center gap-3"
              >
                <GoogleIcon />
                {screen === "signup" ? "Sign up with Google" : "Sign in with Google"}
              </button>
            </>
          )}

          {isVerifyScreen && (
            <p className="mt-6 text-xs text-mauve/60 text-center">
              Already verified?{" "}
              <button type="button" onClick={goLogin} className="text-rose font-semibold underline underline-offset-4 hover:text-white">
                Sign in
              </button>
            </p>
          )}
        </form>

        {/* Toggle between login / signup */}
        {!isVerifyScreen && !isUsernameScreen && screen !== "forgot" && (
          <p className="mt-8 text-center text-sm text-mauve">
            {screen === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={screen === "login" ? goSignup : goLogin}
              className="text-rose font-semibold hover:text-white transition-colors"
            >
              {screen === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}

        {!isVerifyScreen && !isUsernameScreen && screen !== "forgot" && (
          <p className="mt-4 text-center text-sm text-mauve">
            <button
              type="button"
              onClick={goForgot}
              className="text-petal hover:text-white underline underline-offset-4"
            >
              Forgot password?
            </button>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-mauve/60">
          By creating an account you agree to our terms. We never share your details.
        </p>

        <p className="mt-8 text-center text-sm text-mauve">
          <Link to="/" className="text-rosewood hover:text-rose transition-colors">
            ← Back to shop
          </Link>
        </p>
      </div>
      </div>
    </section>
  );
}
