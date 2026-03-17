const DB_NAME = 'file-preview-cache'
const STORE = 'recent-files'
const DB_VERSION = 1
const MAX_FILES = 10

interface CachedFile {
  id: string        // name + lastModified 作为唯一 key
  name: string
  type: string
  size: number
  lastModified: number
  buffer: ArrayBuffer
  cachedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('cachedAt', 'cachedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function fileToId(file: File) {
  return `${file.name}_${file.lastModified}_${file.size}`
}

export async function saveFileToCache(file: File): Promise<void> {
  const db = await openDB()
  const buffer = await file.arrayBuffer()
  const entry: CachedFile = {
    id: fileToId(file),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    buffer,
    cachedAt: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  // 超出上限时删除最旧的
  await trimCache(db)
}

async function trimCache(db: IDBDatabase): Promise<void> {
  const all = await getAllCached(db)
  if (all.length <= MAX_FILES) return
  all.sort((a, b) => a.cachedAt - b.cachedAt)
  const toDelete = all.slice(0, all.length - MAX_FILES)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    toDelete.forEach(f => tx.objectStore(STORE).delete(f.id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function getAllCached(db: IDBDatabase): Promise<CachedFile[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadCachedFiles(): Promise<File[]> {
  try {
    const db = await openDB()
    const all = await getAllCached(db)
    // 按缓存时间倒序（最新的在前）
    all.sort((a, b) => b.cachedAt - a.cachedAt)
    return all.map(entry =>
      new File([entry.buffer], entry.name, {
        type: entry.type,
        lastModified: entry.lastModified,
      })
    )
  } catch {
    return []
  }
}

export async function removeCachedFile(file: File): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(fileToId(file))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
