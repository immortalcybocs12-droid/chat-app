import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app;
let db;
let storage;
let auth;

if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
} else {
    // Server-side or build-time fallback (prevent crashes)
    // We can initialize a dummy app if absolutely needed, but usually just avoiding access is better.
    // However, if pages import 'db', it might be undefined.
    // Let's try to initialize app even on server if keys exist, OR just leave them undefined/null
    // and ensure potential server-side usages check for existence.
    // Given Next.js pages might use these in getStaticProps/getServerSideProps (which run in Node),
    // we should only skip if keys are MISSING.
    if (firebaseConfig.apiKey) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);
    }
}

export { db, storage, auth };
