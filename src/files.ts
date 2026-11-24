async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("fm-demo-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function putFile(file: File) {
  const db = await database(),
    id = crypto.randomUUID();
  await new Promise<void>((ok, no) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = () => ok();
    tx.onerror = () => no(tx.error);
  });
  db.close();
  return id;
}
export async function getFile(id: string): Promise<File> {
  const db = await database();
  return new Promise((ok, no) => {
    const r = db.transaction("files").objectStore("files").get(id);
    r.onsuccess = () => {
      ok(r.result);
      db.close();
    };
    r.onerror = () => no(r.error);
  });
}
