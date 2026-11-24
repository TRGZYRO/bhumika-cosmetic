/**
 * Firebase configuration + Auth client.
 *
 * Bhumika Cosmetic uses Firebase Authentication instead of Supabase Auth.
 * Supabase remains the database; Firebase UIDs are mapped to profiles via
 * the `firebase_uid` column (migration 004).
 *
 * This module is browser-only: it holds the public Firebase config and the
 * Auth instance. Service-account credentials (Firebase Admin) live only on
 * the server in /api and are never bundled for the browser.
 *
 * Initialize once and re-use the Auth instance everywhere.
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebase = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    !String(firebaseConfig.apiKey).includes("your-")
);

const app = hasFirebase ? initializeApp(firebaseConfig) : null;
export const auth = hasFirebase ? getAuth(app) : null;
export { hasFirebase };
export default app;
