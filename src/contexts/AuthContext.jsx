import {
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
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
import { api, setIdTokenProvider } from "../lib/api";

const AuthContext = createContext(null);

/**
 * Email granted admin access on the frontend. The server grants the same access
 * only when Firebase has verified that the email belongs to the signed-in user.
 */
const ADMIN_EMAIL = "utkarshavasthi001@gmail.com";

/**
 * Demo (fake) sign-in is OFF unless VITE_ALLOW_DEMO_AUTH=true is set on purpose.
 * Without this guard, a missing Firebase config silently accepted ANY email and
 * password as an in-memory "customer" account.
 */
const ALLOW_DEMO_AUTH = import.meta.env.VITE_ALLOW_DEMO_AUTH === "true";

const FIREBASE_CONFIG_MESSAGE =
  "Sign-in is not configured. Set the VITE_FIREBASE_* values in .env.local, then restart `npm run dev`.";

/**
 * Firebase Authentication context for Bhumika Cosmetic.
 *
 * Firebase replaces Supabase Authentication only. Supabase remains the database.
 * Firebase UIDs are mapped to profiles via the `firebase_uid` column (migration 004).
 *
 * All password handling is delegated to Firebase. User-scoped writes go through
 * /api endpoints that verify the Firebase ID token. The browser never writes to
 * Supabase directly, because Firebase users have no Supabase session for RLS.
 *
 * Exposed state:
 *   loading     - true until Firebase reports whether someone is signed in
 *   rolesReady  - true once the profile and roles for the signed-in user have loaded
 *   profile/roles - loaded from /api/profile after sign-in (in the background)
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rolesReady, setRolesReady] = useState(false);
  const [demoMode, setDemoMode] = useState(!hasFirebase && ALLOW_DEMO_AUTH);

  /**
   * Loads the signed-in customer's profile and roles from the server (/api/profile).
   * The server verifies the Firebase token and resolves roles with the service role.
   */
  const loadProfileAndRoles = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null);
      setRoles([]);
      setRolesReady(true);
      return;
    }

    setRolesReady(false);
    try {
      const data = await api.get("/api/profile");
      setProfile(data.profile || null);
      setRoles(data.roles || []);
    } catch {
      // Server unreachable or no profile yet: keep the session. Only the verified
      // admin email gets the fallback role.
      setProfile(null);
      const isVerifiedAdmin = firebaseUser.email === ADMIN_EMAIL && firebaseUser.emailVerified;
      setRoles(isVerifiedAdmin ? ["owner", "manager", "staff"] : []);
    } finally {
      setRolesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!hasFirebase || !auth) {
      if (ALLOW_DEMO_AUTH) {
        setDemoMode(true);
      } else {
        console.error(FIREBASE_CONFIG_MESSAGE);
      }
      setRolesReady(true);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      // The page can render now. Roles follow in the background.
      setLoading(false);
      loadProfileAndRoles(firebaseUser ?? null);
    });

    return () => unsub();
  }, [loadProfileAndRoles]);

  /** Firebase's cached token. It renews itself when close to expiry. */
  const getIdToken = useCallback(async () => {
    if (!auth || !auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  // Register the token provider before any child effect makes an API call.
  useLayoutEffect(() => {
    setIdTokenProvider(getIdToken);
  }, [getIdToken]);

  // Map Firebase error codes to user-friendly messages without weakening
  // account-enumeration protection.
  const mapAuthError = (err) => {
    const code = err.code || "";
    const message = err.message || "Something went wrong. Please try again.";
    switch (code) {
      case "auth/user-not-found":
        return "This email address is not registered. Please create an account to continue.";
      case "auth/invalid-credential":
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

  const demoUser = (email, fullName, emailVerified) => ({
    uid: "demo-user",
    email,
    displayName: fullName,
    user_metadata: { full_name: fullName },
    emailVerified,
    getIdToken: async () => "demo-token",
  });

  const signUp = useCallback(
    async ({ email, password, fullName }) => {
      if (demoMode) {
        const u = demoUser(email, fullName, false);
        setUser(u);
        setProfile({ id: "demo-user", full_name: fullName, email, firebase_uid: "demo-user" });
        setRoles(["customer"]);
        setRolesReady(true);
        return { user: u };
      }
      if (!auth) throw new Error(FIREBASE_CONFIG_MESSAGE);

      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      await firebaseUpdateProfile(firebaseUser, { displayName: fullName });
      await sendEmailVerification(firebaseUser);
      await firebaseUser.reload();

      // The server creates the profile row keyed by the verified Firebase UID.
      setUser(firebaseUser);
      await loadProfileAndRoles(firebaseUser);
      return { user: firebaseUser };
    },
    [demoMode, loadProfileAndRoles]
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      if (demoMode) {
        const u = demoUser(email, "", true);
        setUser(u);
        setProfile({ id: "demo-user", full_name: "", email, firebase_uid: "demo-user" });
        setRoles(["customer"]);
        setRolesReady(true);
        return { user: u };
      }
      if (!auth) throw new Error(FIREBASE_CONFIG_MESSAGE);

      try {
        const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
        setUser(firebaseUser);
        await loadProfileAndRoles(firebaseUser);
        return { user: firebaseUser };
      } catch (err) {
        throw new Error(mapAuthError(err));
      }
    },
    [demoMode, loadProfileAndRoles]
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

    setUser(firebaseUser);
    await loadProfileAndRoles(firebaseUser);
    return { user: firebaseUser, isNewUser };
  }, [demoMode, loadProfileAndRoles]);

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
    setRolesReady(true);
  }, [demoMode]);

  /** Update the signed-in customer's details through the API (server-verified). */
  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error("Not authenticated");
      if (demoMode) {
        setProfile((p) => ({ ...p, ...updates }));
        return profile;
      }
      const { profile: saved } = await api.put("/api/profile", updates);
      setProfile(saved);
      return saved;
    },
    [user, profile, demoMode]
  );

  const resendVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) throw new Error("Not authenticated");
    await sendEmailVerification(auth.currentUser);
    return true;
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!auth) throw new Error("Firebase is not configured.");
    await sendPasswordResetEmail(auth, email);
    return true;
  }, []);

  const checkVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) return false;
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified === true;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      roles,
      loading,
      rolesReady,
      demoMode,
      isAuthenticated: !!user,
      isAdmin: roles.includes("owner") || roles.includes("manager"),
      isStaff: roles.includes("owner") || roles.includes("manager") || roles.includes("staff"),
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
      rolesReady,
      demoMode,
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default AuthContext;
