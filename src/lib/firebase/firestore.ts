import { getFirestore, type Firestore } from 'firebase/firestore'

import { getFirebaseApp } from './config'

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp()

  if (!app) {
    return null
  }

  return getFirestore(app)
}
