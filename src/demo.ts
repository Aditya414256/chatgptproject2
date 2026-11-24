import { change, initial, type DB } from "./model";
const key = "fm-workshop-v2";
export function read(): DB {
  return JSON.parse(localStorage.getItem(key) || "null") ?? initial();
}
export async function write<T>(fn: (d: DB) => T) {
  return navigator.locks.request(key, () => {
    const d = read();
    for (const o of d.orders)
      if (o.status === "pending" && o.expires <= Date.now())
        change(d, null, o.id, "expired");
    const result = fn(d);
    localStorage.setItem(key, JSON.stringify(d));
    window.dispatchEvent(new Event("datachange"));
    return result;
  });
}
