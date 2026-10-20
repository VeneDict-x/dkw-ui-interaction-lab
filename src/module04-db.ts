let database: Promise<IDBDatabase> | null = null;
export function openModule04DB() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const q = indexedDB.open('dkw-event-guide-v1', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('events');
    q.onerror = () => reject(q.error || Error('Module 04 storage unavailable'));
    q.onblocked = () => reject(Error('Module 04 upgrade blocked'));
    q.onsuccess = () => {
      const db = q.result;
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
  }).catch((e) => {
    database = null;
    throw e;
  }));
}
export type ResetExtra = { key: string; value: unknown };
