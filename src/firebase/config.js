import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER_AUTH_DOMAIN",
  projectId: "PLACEHOLDER_PROJECT_ID",
  storageBucket: "PLACEHOLDER_STORAGE_BUCKET",
  messagingSenderId: "PLACEHOLDER_MESSAGING_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Simple auth wrapper for the MVP
export const loginAnonymously = async () => {
  try {
    // In a real app we'd await signInAnonymously(auth);
    // For MVP with placeholder config, we'll just mock it.
    console.log("Mock: Signing in anonymously");
    return { uid: "mock-user-123" };
  } catch (error) {
    console.error("Error signing in anonymously", error);
    throw error;
  }
};

export { auth, db };
