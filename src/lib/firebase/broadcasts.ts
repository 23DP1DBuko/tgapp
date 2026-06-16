import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';

import { getFirestoreDb } from './firestore';
import type { Broadcast } from '../../types/broadcast';

type BroadcastDocument = {
  createdAt?: Timestamp;
  createdBy?: number;
  sentCount?: number;
  failedCount?: number;
  reason?: string;
  text?: string;
};

function toBroadcast(
  doc: QueryDocumentSnapshot<BroadcastDocument>
): Broadcast {
  const data = doc.data();
  const createdAt =
    data.createdAt && typeof data.createdAt.toDate === 'function'
      ? data.createdAt.toDate().toISOString()
      : null;

  return {
    id: doc.id,
    createdAt,
    createdBy:
      typeof data.createdBy === 'number' ? data.createdBy : null,
    sentCount: typeof data.sentCount === 'number' ? data.sentCount : 0,
    failedCount:
      typeof data.failedCount === 'number' ? data.failedCount : 0,
    reason: typeof data.reason === 'string' ? data.reason : '',
    text: typeof data.text === 'string' ? data.text : '',
  };
}

export async function listBroadcasts(
  limitCount = 20
): Promise<Broadcast[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const broadcastsQuery = query(
    collection(db, 'broadcasts'),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount)
  );

  const snapshot = await getDocs(
    broadcastsQuery
  );

  return (snapshot as QuerySnapshot<BroadcastDocument>).docs.map(
    (doc) => toBroadcast(doc as QueryDocumentSnapshot<BroadcastDocument>)
  );
}