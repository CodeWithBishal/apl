// =====================================================================
// CricPulse AI — Firebase/Firestore Service
// Project: apl-pragyaan
// =====================================================================
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
  DocumentData,
} from "firebase/firestore";

// ---- Firebase config (safe to commit — restricted by Firestore rules) ----
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY            || "AIzaSyB6JULpVFkTpz4q1iQ2jiew73GQ4CMQIk4",
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN        || "apl-pragyaan.firebaseapp.com",
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID         || "apl-pragyaan",
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET     || "apl-pragyaan.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID|| "913424258041",
  appId:             process.env.REACT_APP_FIREBASE_APP_ID             || "1:913424258041:web:fef321bdf2ec3f2a04e328",
  measurementId:     process.env.REACT_APP_FIREBASE_MEASUREMENT_ID     || "G-8R7Y32C0MN",
};

let app: FirebaseApp | null = null;
let db:  Firestore | null   = null;
export let IS_FIREBASE_CONFIGURED = false;

try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db  = getFirestore(app);
  IS_FIREBASE_CONFIGURED = true;
  console.log("[Firebase] ✅ Firestore connected — apl-pragyaan");
} catch (e) {
  console.warn("[Firebase] ⚠️ Init failed — using in-memory fallback", e);
}

export { db };

// =====================================================================
// Collection paths
// =====================================================================
export const CHAT_COLLECTION  = (matchId: string) => `matches/${matchId}/chat`;
export const STATE_COLLECTION = (matchId: string) => `matches/${matchId}/state/live`;

// =====================================================================
// Send a chat message to Firestore
// =====================================================================
export async function sendChatMessage(
  matchId: string,
  msg: {
    userId:         string;
    username:       string;
    avatar:         string;
    text:           string;
    sentiment?:     string;
    sentimentScore?: number;
  }
): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, CHAT_COLLECTION(matchId)), {
      ...msg,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error("[Firebase] sendChatMessage error:", e);
  }
}

// =====================================================================
// Subscribe to real-time chat (last 80 messages)
// =====================================================================
export function subscribeToChatMessages(
  matchId: string,
  onMessages: (msgs: DocumentData[]) => void
): () => void {
  if (!db) return () => {};
  const q = query(
    collection(db, CHAT_COLLECTION(matchId)),
    orderBy("timestamp", "asc"),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() ?? Date.now(),
    }));
    onMessages(msgs);
  }, (err) => {
    console.warn("[Firebase] Chat subscription error:", err.message);
  });
}

// =====================================================================
// Subscribe to live match state (updated by Cloud Function)
// =====================================================================
export function subscribeToLiveState(
  matchId: string,
  onState: (state: DocumentData | null) => void
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, STATE_COLLECTION(matchId)),
    (snap) => { onState(snap.exists() ? snap.data() ?? null : null); },
    (err) => { console.warn("[Firebase] State subscription error:", err.message); }
  );
}
