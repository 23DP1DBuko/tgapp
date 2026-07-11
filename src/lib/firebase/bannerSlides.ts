import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import type { BannerSlide, BannerSlideInput } from '../../types/bannerSlide'

type BannerSlideDocument = BannerSlideInput & {
  createdAt?: string
  updatedAt?: string
}

function toBannerSlide(
  docSnapshot: QueryDocumentSnapshot<BannerSlideDocument>,
): BannerSlide {
  const data = docSnapshot.data()

  return {
    id: docSnapshot.id,
    imageUrl: data.imageUrl ?? '',
    badgeText: data.badgeText ?? '',
    headline: data.headline ?? '',
    subheading: data.subheading ?? '',
    caption: data.caption ?? '',
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

const BANNER_SLIDES_COLLECTION = 'bannerSlides'

export async function listBannerSlides(
  limitCount = 20,
): Promise<BannerSlide[]> {
  const db = getFirestoreDb()
  if (!db) return []

  const slidesQuery = query(
    collection(db, BANNER_SLIDES_COLLECTION),
    orderBy('sortOrder', 'asc'),
    fsLimit(limitCount),
  )

  const snapshot = await getDocs(slidesQuery)

  return snapshot.docs.map((doc) =>
    toBannerSlide(doc as QueryDocumentSnapshot<BannerSlideDocument>),
  )
}

export async function createBannerSlide(
  input: BannerSlideInput,
): Promise<string> {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore not available')

  const docRef = doc(collection(db, BANNER_SLIDES_COLLECTION))

  await setDoc(docRef, {
    ...input,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  return docRef.id
}

export async function updateBannerSlide(
  slideId: string,
  input: Partial<BannerSlideInput>,
): Promise<void> {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore not available')

  const docRef = doc(db, BANNER_SLIDES_COLLECTION, slideId)

  await updateDoc(docRef, {
    ...input,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteBannerSlide(
  slideId: string,
): Promise<void> {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore not available')

  const docRef = doc(db, BANNER_SLIDES_COLLECTION, slideId)

  await deleteDoc(docRef)
}

export async function reorderBannerSlides(
  orderedIds: string[],
): Promise<void> {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore not available')

  const updates = orderedIds.map((id, index) => {
    const docRef = doc(db, BANNER_SLIDES_COLLECTION, id)
    return updateDoc(docRef, {
      sortOrder: index,
      updatedAt: new Date().toISOString(),
    })
  })

  await Promise.all(updates)
}
