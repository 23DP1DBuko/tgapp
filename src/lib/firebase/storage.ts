import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage'

import { getFirebaseApp } from './config'

export function getFirebaseStorage(): FirebaseStorage | null {
  const app = getFirebaseApp()

  if (!app) {
    return null
  }

  return getStorage(app)
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  const storage = getFirebaseStorage()

  if (!storage) {
    throw new Error('Firebase Storage is not configured yet.')
  }

  const uploads = files.map(async (file) => {
    const safeName = file.name.replace(/\s+/g, '-').toLowerCase()
    const storageRef = ref(
      storage,
      `products/${Date.now()}-${crypto.randomUUID()}-${safeName}`,
    )

    await uploadBytes(storageRef, file)

    return getDownloadURL(storageRef)
  })

  return Promise.all(uploads)
}
