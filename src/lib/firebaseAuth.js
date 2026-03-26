import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() ?? "",
};

let appInstance;
let authInstance;
let authSetupPromise;

export function isFirebaseAuthConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function getFirebaseAuth() {
  if (!isFirebaseAuthConfigured()) {
    throw new Error("Firebase Google sign-in is not configured yet.");
  }

  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    authInstance.useDeviceLanguage();
  }

  return authInstance;
}

async function ensureFirebaseAuthReady() {
  const auth = getFirebaseAuth();

  if (!authSetupPromise) {
    authSetupPromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
      authSetupPromise = null;
      throw error;
    });
  }

  await authSetupPromise;
  return auth;
}

export function subscribeToAuthChanges(callback) {
  if (!isFirebaseAuthConfigured()) {
    callback(null);
    return () => {};
  }

  let unsubscribe = () => {};
  let cancelled = false;

  ensureFirebaseAuthReady()
    .then((auth) => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, callback);
    })
    .catch(() => {
      if (!cancelled) {
        callback(null);
      }
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function signInWithGooglePopup() {
  const auth = await ensureFirebaseAuthReady();
  const provider = new GoogleAuthProvider();

  return signInWithPopup(auth, provider);
}

export async function signOutFromGoogle() {
  return signOut(getFirebaseAuth());
}
