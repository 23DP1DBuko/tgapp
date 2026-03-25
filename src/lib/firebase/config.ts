import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'

type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function readFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

export function hasFirebaseEnv(): boolean {
  const config = readFirebaseConfig()

  return Object.values(config).every(Boolean)
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseEnv()) {
    return null
  }

  return getApps().length > 0 ? getApp() : initializeApp(readFirebaseConfig())
}
