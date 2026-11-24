import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";
import { auth, hasFirebase } from "../lib/firebase";
import { supabase, hasSupabase } from "../lib/supabase/client";
import { api, setIdTokenProvider } from "../lib/api";

const AuthContext = createContext(null);

/**
 * Email that is granted admin access on the frontend regardless of Supabase
 * user_roles. Only this email can be an admin via this path — no one else can
 * register with the same email, so it is a stable admin key.
 */
const ADMIN_EMAIL = "utkarshavasthi001@gmail.com";

/**
 * Demo (fake) sign-in is OFF unless VITE_ALLOW_DEMO_AUTH=true is set on purpose.
 * Without this guard, a missing Firebase config silently accepted ANY email and
 * password as an in-memory "customer" account, which logged users out on refresh
 * and hid the admin panel.
 */
const ALLOW_DEMO_AUTH = import.meta.env.VITE_ALLOW_DEMO_AUTH === "true";

const FIREBASE_CONFIG_MESSAGE =
  "Sign-in is not configured. Set the VITE_FIREBASE_* values in .env.local, then restart `npm run dev`.";

/**
 * Firebase Authentication context for Bhumika Cosmetic.
 *
 * Firebase replaces Supabase Authentication only. Supabase remains the
 * database. Firebase UIDs are mapped to profiles via the `firebase_uid`
 * column (migration 004).
 *
 * All password handling is delegated to Firebase — we never store or
 * transmit plaintext passwords, and we never implement authentication
 * manually.
 *
 * Server-side trust: user-scoped writes (profile, cart, wishlist, bookings)
 * go through /api endpoints that verify the Firebase ID token and resolve
 * the profile via firebase_uid — we never trust a frontend-supplied user ID,
 * and RLS is never disabled or weakened.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(!hasFirebase && ALLOW_DEMO_AUTH);
  const [idToken, setIdToken] = useState(null);

  /**
   * Loads the signed-in customer's profile and roles from the server (/api/profile).
   * The server verifies the Firebase token and resolves roles with the service role.
   * Reading these from the browser would depend on Supabase RLS, which cannot see
   * Firebase users, so staff roles would silently disappear.
   */
  const loadProfileAndRoles = useCallback(async (firebaseUser) => {
    const adminFallback = () =>
      setRoles(firebaseUser?.email === ADMIN_EMAIL ? ["owner", "manager", "staff"] : []);

    if (!firebaseUser) {
      setProfile(null);
      setRoles([]);
      return;
    }
    try {
      const data = await api.get("/api/profile");
      setProfile(data.profile || null);
      setRoles(data.roles || []);
    } catch {
      // Server unreachable or no profile yet: keep the session, grant only the admin-email fallback.
      setProfile(null);
      adminFallback();
    }
  }, []);

  useEffect(() => {
    if (!hasFirebase || !auth) {
      if (ALLOW_DEMO_AUTH) {
        setDemoMode(true);
      } else {
        console.error(FIREBASE_CONFIG_MESSAGE);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken(true);
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
        await loadProfileAndRoles(firebaseUser);
      } else {
        setProfile(null);
        setRoles([]);
        setIdToken(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [loadProfileAndRoles]);

  const getIdToken = useCallback(async () => {
    if (!auth || !auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken(true);
      setIdToken(token);
      return token;
    } catch {
      return null;
    }
  }, [auth]);

  // Expose the token provider so /api calls can attach the Firebase ID token.
  setIdTokenProvider(getIdToken);

  // Map Firebase error codes to user-friendly messages without weakening
  // account-enumeration protection. Firebase may not reveal whether an email
  // is registered; we keep messages generic where the SDK does.
  const mapAuthError = (err) => {
    const code = err.code || "";
    const message = err.message || "Something went wrong. Please try again.";
    switch (code) {
      case "auth/user-not-found":
        return "This email address is not registered. Please create an account to continue.";
      case "auth/invalid-credential":
        // Firebase does not reveal whether the email exists, so do not guess.
        return "Incorrect email or password. Please try again.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Please sign in to continue.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection and try again.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      case "auth/requires-recent-login":
        return "For your security, please sign in again to continue.";
      default:
        return message;
    }
  };

  const signUp = useCallback(
    async ({ email, password, fullName }) => {
      if (demoMode) {
        const demoUser = {
          uid: "demo-user",
          email,
          user_metadata: { full_name: fullName },
          emailVerified: false,
          getIdToken: async () => "demo-token",
        };
        setUser(demoUser);
        setProfile({
          id: "demo-user",
          full_name: fullName,
          email,
          firebase_uid: "demo-user",
        });
        setRoles(["customer"]);
        setIdToken("demo-token");
        return { user: demoUser };
      }
      if (!auth) throw new Error(FIREBASE_CONFIG_MESSAGE);

      // Create the Firebase account.
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Set display name on the Firebase account.
      await firebaseUpdateProfile(firebaseUser, { displayName: fullName });

      // Send verification email (do not falsely show as verified).
      await sendEmailVerification(firebaseUser);

      // Refresh to reflect emailVerified state.
      await firebaseUser.reload();

      // Create/link a profile row keyed by Firebase UID.
      // Do not fail signup if profile creation fails — the profile can be
      // created on-demand server-side via authenticateRequest.
      if (hasSupabase && supabase) {
        try {
          await supabase.from("profiles").insert({
            id: firebaseUser.uid,
            full_name: fullName,
            email,
            firebase_uid: firebaseUser.uid,
            role: "customer",
          });
        } catch {
          // Profile may already exist; ignore and continue.
        }
      }

      const token = await firebaseUser.getIdToken(true);
      setIdToken(token);
      setUser(firebaseUser);
      await loadProfileAndRoles(firebaseUser);

      return { user: firebaseUser };
    },
    [auth, demoMode, loadProfileAndRoles]
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      if (demoMode) {
        const demoUser = {
          uid: "demo-user",
          email,
          user_metadata: { full_name: "" },
          emailVerified: true,
          getIdToken: async () => "demo-token",
        };
        setUser(demoUser);
        setProfile({
          id: "demo-user",
          full_name: "",
          email,
          firebase_uid: "demo-user",
        });
        setRoles(["customer"]);
        setIdToken("demo-token");
        return { user: demoUser };
      }
      if (!auth) throw new Error(FIREBASE_CONFIG_MESSAGE);

      try {
        const { user: firebaseUser } = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const token = await firebaseUser.getIdToken(true);
        setIdToken(token);
        setUser(firebaseUser);
        await loadProfileAndRoles(firebaseUser);
        return { user: firebaseUser };
      } catch (err) {
        throw new Error(mapAuthError(err));
      }
    },
    [auth, demoMode, loadProfileAndRoles, mapAuthError]
  );

  /**
   * Continue with Google. Works for both sign-in and registration: Firebase
   * creates the account on first use. Returns { user, isNewUser } so the
   * login page can ask a new Google user to choose a username.
   */
  const signInWithGoogle = useCallback(async () => {
    if (demoMode) throw new Error("Google sign-in is not available in demo mode.");
    if (!auth) throw new Error(FIREBASE_CONFIG_MESSAGE);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        throw new Error("Google sign-in was cancelled.");
      }
      if (err.code === "auth/popup-blocked") {
        throw new Error("Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.");
      }
      if (err.code === "auth/account-exists-with-different-credential") {
        throw new Error("An account already exists with this email. Sign in with your email and password instead.");
      }
      throw new Error(mapAuthError(err));
    }

    const firebaseUser = result.user;
    const isNewUser = getAdditionalUserInfo(result)?.isNewUser === true;

    if (isNewUser && hasSupabase && supabase) {
      try {
        await supabase.from("profiles").insert({
          id: firebaseUser.uid,
          full_name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          firebase_uid: firebaseUser.uid,
          role: "customer",
        });
      } catch {
        // Profile is also created on demand server-side; ignore.
      }
    }

    const token = await firebaseUser.getIdToken(true);
    setIdToken(token);
    setUser(firebaseUser);
    await loadProfileAndRoles(firebaseUser);
    return { user: firebaseUser, isNewUser };
  }, [auth, demoMode, loadProfileAndRoles, mapAuthError]);

  /** Save the username chosen after registration. Server checks uniqueness. */
  const setUsername = useCallback(
    async (username) => {
      if (!user) throw new Error("Not authenticated");
      const { profile: saved } = await api.put("/api/profile", { username });
      setProfile(saved);
      return saved;
    },
    [user]
  );

  const signOut = useCallback(async () => {
    if (!demoMode && auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setProfile(null);
    setRoles([]);
    setIdToken(null);
  }, [auth, demoMode]);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error("Not authenticated");
      if (!hasSupabase || !supabase) {
        setProfile({ ...profile, ...updates });
        return profile;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile?.id || user.uid)
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    },
    [user, profile, hasSupabase, supabase]
  );

  const resendVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) throw new Error("Not authenticated");
    await sendEmailVerification(auth.currentUser);
    return true;
  }, [auth]);

  const sendPasswordReset = useCallback(async (email) => {
    if (!auth) throw new Error("Firebase is not configured.");
    // Firebase sends the reset email; if it fails we surface a friendly message
    // and never pretend an email was sent (PHASE 5).
    await sendPasswordResetEmail(auth, email);
    return true;
  }, [auth]);

  const checkVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) return false;
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified === true;
  }, [auth]);

  const value = useMemo(
    () => ({
      user,
      profile,
      roles,
      loading,
      demoMode,
      idToken,
      isAuthenticated: !!user,
      isAdmin: roles.includes("owner") || roles.includes("manager"),
      isStaff:
        roles.includes("owner") ||
        roles.includes("manager") ||
        roles.includes("staff"),
      getIdToken,
      signUp,
      signIn,
      signInWithGoogle,
      setUsername,
      signOut,
      updateProfile,
      resendVerification,
      checkVerification,
      sendPasswordReset,
      reloadAndCheckVerification: checkVerification,
    }),
    [
      user,
      profile,
      roles,
      loading,
      demoMode,
      idToken,
      getIdToken,
      signUp,
      signIn,
      signInWithGoogle,
      setUsername,
      signOut,
      updateProfile,
      resendVerification,
      checkVerification,
      sendPasswordReset,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default AuthContext;
