// In-memory fake Firestore used by unit tests.
//
// It implements just enough of the firebase-admin Firestore surface that the
// unit-tested functions need:
//   - collection().doc() / collection().where(...).limit(n).get()
//   - subcollections: docRef.collection('sub') stored as '<coll>/<docId>/<sub>'
//   - db.getAll(...refs)
//   - db.runTransaction(...) with optimistic-concurrency retries, plus
//     transaction get/set/update and FieldValue sentinel resolution
//     (increment / arrayUnion / serverTimestamp / deleteField)
//
// Transactions simulate Firestore's write-conflict behavior: if a document
// that the transaction read changes before commit, the transaction throws a
// TransactionConflictError and runTransaction retries the callback, so tests
// can verify idempotency under concurrent calls.
//
// Known fidelity gaps (fine for the current tests, which always read every
// document they write):
//   - write-write conflicts are only detected for docs read via tx.get();
//   - update() throws on a missing doc (like real Firestore).

type StoredDoc = {
  data: Record<string, unknown> | undefined
  version: number
}

export type FakeDocRef = {
  id: string
  __collection: string
  get(): Promise<FakeDocSnapshot>
  collection(subName: string): FakeCollectionRef
}

export type FakeDocSnapshot = {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
  ref: FakeDocRef
}

export type FakeQuerySnapshot = {
  docs: FakeDocSnapshot[]
  empty: boolean
}

export type FakeQuery = {
  get(): Promise<FakeQuerySnapshot>
  limit(n: number): FakeQuery
}

export type FakeCollectionRef = {
  doc(docId?: string): FakeDocRef
  where(field: string, op: string, value: unknown): FakeQuery
  get(): Promise<FakeQuerySnapshot>
}

export class TransactionConflictError extends Error {}

function matchesWhere(
  data: Record<string, unknown>,
  field: string,
  op: string,
  value: unknown,
): boolean {
  const actual = data[field]
  switch (op) {
    case '==':
      return actual === value
    case '>=':
      return typeof actual === 'string' && typeof value === 'string' && actual >= value
    case '<=':
      return typeof actual === 'string' && typeof value === 'string' && actual <= value
    case 'in':
      return Array.isArray(value) && value.includes(actual)
    case 'array-contains':
      return Array.isArray(actual) && actual.includes(value)
    default:
      throw new Error(`Unsupported where operator: ${op}`)
  }
}

/**
 * Identify a firebase-admin FieldValue sentinel. Admin SDK v13 represents them
 * as internal *Transform classes (NumericIncrementTransform, ArrayUnionTransform,
 * ServerTimestampTransform, DeleteTransform); older SDKs used a _methodName.
 */
type FieldValueSentinelKind = 'increment' | 'arrayUnion' | 'serverTimestamp' | 'delete'

function sentinelKind(value: unknown): FieldValueSentinelKind | null {
  if (typeof value !== 'object' || value === null) return null
  const className = (value as { constructor?: { name?: string } }).constructor?.name ?? ''
  switch (className) {
    case 'NumericIncrementTransform':
      return 'increment'
    case 'ArrayUnionTransform':
      return 'arrayUnion'
    case 'ServerTimestampTransform':
      return 'serverTimestamp'
    case 'DeleteTransform':
      return 'delete'
  }
  const methodName = (value as { _methodName?: string })._methodName
  switch (methodName) {
    case 'increment':
    case 'arrayUnion':
    case 'serverTimestamp':
    case 'delete':
      return methodName
    case 'deleteField':
      return 'delete'
    default:
      return null
  }
}

/** Resolve a stored value, applying FieldValue sentinels against existing data. */
function resolveStoredValue(value: unknown, existing: unknown): unknown {
  const kind = sentinelKind(value)
  if (kind === null) return value
  switch (kind) {
    case 'increment': {
      const operand = (value as { operand?: unknown }).operand
      const current = typeof existing === 'number' ? existing : 0
      return current + (typeof operand === 'number' ? operand : 0)
    }
    case 'arrayUnion': {
      const elements = (value as { elements?: unknown[] }).elements ?? []
      const base = Array.isArray(existing) ? [...existing] : []
      for (const item of elements) {
        if (!base.includes(item)) base.push(item)
      }
      return base
    }
    case 'serverTimestamp':
      return new Date().toISOString()
    default:
      // delete sentinels are filtered out by the caller.
      return value
  }
}

export class FakeFirestore {
  private store = new Map<string, Map<string, StoredDoc>>()
  private autoIdCounter = 0

  /** Insert a document into the fake database. */
  seed(collection: string, docId: string, data: Record<string, unknown>) {
    const coll = this.store.get(collection) ?? new Map<string, StoredDoc>()
    coll.set(docId, { data: { ...data }, version: 0 })
    this.store.set(collection, coll)
  }

  /** Read a stored doc (used by the fake transaction to check versions). */
  readDoc(collection: string, docId: string): StoredDoc | undefined {
    return this.store.get(collection)?.get(docId)
  }

  /** Return every document in a collection (used by assertions). */
  readAll(collection: string): Array<{ id: string; data: Record<string, unknown> }> {
    const coll = this.store.get(collection) ?? new Map<string, StoredDoc>()
    return Array.from(coll.entries())
      .filter(([, doc]) => doc.data !== undefined)
      .map(([id, doc]) => ({ id, data: { ...(doc.data as Record<string, unknown>) } }))
  }

  private makeSnapshot(collection: string, docId: string): FakeDocSnapshot {
    const doc = this.readDoc(collection, docId)
    const exists = doc !== undefined && doc.data !== undefined
    return {
      id: docId,
      exists,
      data: () => (exists ? { ...(doc!.data as Record<string, unknown>) } : undefined),
      ref: {
        id: docId,
        __collection: collection,
        get: () => Promise.resolve(db.makeSnapshot(collection, docId)),
        collection: (subName: string): FakeCollectionRef =>
          db.collection(db.subcollectionName(collection, docId, subName)),
      },
    }
  }

  private subcollectionName(parentCollection: string, docId: string, subName: string): string {
    return `${parentCollection}/${docId}/${subName}`
  }

  collection(collectionName: string): FakeCollectionRef {
    const db = this
    return {
      doc(docId?: string): FakeDocRef {
        const id = docId ?? `auto_${++db.autoIdCounter}`
        return {
          id,
          __collection: collectionName,
          get: () => Promise.resolve(db.makeSnapshot(collectionName, id)),
          collection: (subName: string): FakeCollectionRef =>
            db.collection(db.subcollectionName(collectionName, id, subName)),
        }
      },
      where(field: string, op: string, value: unknown): FakeQuery {
        const getDocs = async (): Promise<FakeQuerySnapshot> => {
          const coll = db.store.get(collectionName)
          if (!coll) return { docs: [], empty: true }
          const docs: FakeDocSnapshot[] = []
          for (const [id, doc] of coll) {
            if (doc.data === undefined) continue
            if (matchesWhere(doc.data, field, op, value)) {
              docs.push(db.makeSnapshot(collectionName, id))
            }
          }
          return { docs, empty: docs.length === 0 }
        }
        return {
          get: getDocs,
          limit: (n: number): FakeQuery => ({
            get: async () => {
              const snapshot = await getDocs()
              const docs = snapshot.docs.slice(0, n)
              return { docs, empty: docs.length === 0 }
            },
          }),
        }
      },
      get: async (): Promise<FakeQuerySnapshot> => {
        const coll = db.store.get(collectionName)
        if (!coll) return { docs: [], empty: true }
        const docs: FakeDocSnapshot[] = []
        for (const [id, doc] of coll) {
          if (doc.data === undefined) continue
          docs.push(db.makeSnapshot(collectionName, id))
        }
        return { docs, empty: docs.length === 0 }
      },
    }
  }

  async getAll(...refs: FakeDocRef[]): Promise<FakeDocSnapshot[]> {
    const snapshots = await Promise.all(refs.map((ref) => ref.get()))
    return snapshots
  }

  /**
   * Minimal write-batch for tests (no read-conflict tracking — matches how the
   * production code uses db.batch() for bulk updates).
   */
  batch(): {
    update: (ref: FakeDocRef, data: Record<string, unknown>) => void
    commit: () => Promise<void>
  } {
    const writes: Array<{ ref: FakeDocRef; data: Record<string, unknown> }> = []
    return {
      update: (ref, data) => {
        writes.push({ ref, data })
      },
      commit: async () => {
        for (const { ref, data } of writes) {
          const coll = this.store.get(ref.__collection) ?? new Map<string, StoredDoc>()
          const existing = coll.get(ref.id)
          if (existing?.data === undefined) {
            throw new Error(`Cannot update a nonexistent document: ${ref.__collection}/${ref.id}`)
          }
          const resolved: Record<string, unknown> = {}
          for (const [field, value] of Object.entries(data)) {
            if (sentinelKind(value) === 'delete') continue
            resolved[field] = resolveStoredValue(value, existing.data?.[field])
          }
          coll.set(ref.id, {
            data: { ...existing.data, ...resolved },
            version: existing.version + 1,
          })
          this.store.set(ref.__collection, coll)
        }
      },
    }
  }

  async runTransaction<T>(
    callback: (tx: FakeTransaction) => Promise<T>,
    maxAttempts = 4,
  ): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tx = new FakeTransaction(this)
      try {
        const result = await callback(tx)
        tx.commit()
        return result
      } catch (error) {
        if (!(error instanceof TransactionConflictError)) throw error
        lastError = error
      }
    }
    throw lastError
  }
}

type PendingWrite = {
  ref: FakeDocRef
  data: Record<string, unknown>
  merge: boolean
  isUpdate: boolean
}

export class FakeTransaction {
  private reads = new Map<string, number>()
  private writes: PendingWrite[] = []
  private committed = false

  constructor(private db: FakeFirestore) {}

  private key(ref: FakeDocRef): string {
    return `${ref.__collection}\u0000${ref.id}`
  }

  async get(ref: FakeDocRef): Promise<FakeDocSnapshot> {
    const doc = this.db.readDoc(ref.__collection, ref.id)
    this.reads.set(this.key(ref), doc?.version ?? 0)
    return ref.get()
  }

  set(ref: FakeDocRef, data: Record<string, unknown>, options?: { merge?: boolean }) {
    if (this.committed) throw new Error('Transaction already committed.')
    this.writes.push({ ref, data, merge: options?.merge === true, isUpdate: false })
  }

  /** Mirrors transaction.update: merge the given fields into the existing doc. */
  update(ref: FakeDocRef, data: Record<string, unknown>) {
    if (this.committed) throw new Error('Transaction already committed.')
    this.writes.push({ ref, data, merge: true, isUpdate: true })
  }

  commit() {
    if (this.committed) throw new Error('Transaction already committed.')
    this.committed = true

    // Abort if any document read by this transaction changed since the read.
    for (const [key, version] of this.reads) {
      const [collection, id] = key.split('\u0000')
      const doc = this.db.readDoc(collection, id)
      if ((doc?.version ?? 0) !== version) {
        throw new TransactionConflictError('Write conflict detected')
      }
    }

    // Apply the buffered writes with a version bump.
    for (const { ref, data, merge, isUpdate } of this.writes) {
      const coll = this.db.store.get(ref.__collection) ?? new Map<string, StoredDoc>()
      const existing = coll.get(ref.id)
      // Mirrors real Firestore: update() on a missing document fails.
      if (isUpdate && existing?.data === undefined) {
        throw new Error(`Cannot update a nonexistent document: ${ref.__collection}/${ref.id}`)
      }
      const existingData = existing?.data

      // Resolve FieldValue sentinels per top-level key.
      const resolved: Record<string, unknown> = {}
      for (const [field, value] of Object.entries(data)) {
        if (sentinelKind(value) === 'delete') continue
        resolved[field] = resolveStoredValue(value, existingData?.[field])
      }

      const nextData =
        merge && existingData !== undefined ? { ...existingData, ...resolved } : { ...resolved }

      coll.set(ref.id, {
        data: nextData,
        version: (existing?.version ?? 0) + 1,
      })
      this.db.store.set(ref.__collection, coll)
    }
  }
}
