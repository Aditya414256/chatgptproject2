import { createClient } from "@supabase/supabase-js";
import { read, write } from "./demo";
import {
  items,
  place,
  change,
  type DB,
  type Person,
  type Role,
  type Order,
  type Shop,
} from "./model";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const client =
  import.meta.env.VITE_BACKEND_MODE === "supabase" && url && key
    ? createClient(url, key)
    : null;
export async function login(
  email: string,
  password: string,
  name: string,
  phone: string,
  role: Role,
  signup: boolean,
) {
  if (!client) throw Error("Use a demo role below.");
  const { data, error } = signup
    ? await client.auth.signUp({
        email,
        password,
        options: { data: { name, phone, role } },
      })
    : await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw Error("Confirm your email, then sign in.");
  return profile();
}
export async function profile(): Promise<Person | null> {
  if (!client) return JSON.parse(sessionStorage.getItem("fm-person") || "null");
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("fm_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}
export async function load(): Promise<DB> {
  if (!client) return read();
  const [s, o] = await Promise.all([
    client.from("fm_shops").select("*"),
    client
      .from("fm_orders")
      .select("doc")
      .order("created", { ascending: false }),
  ]);
  if (s.error || o.error) throw s.error || o.error;
  return { shops: s.data as Shop[], orders: o.data.map((x) => x.doc as Order) };
}
export async function order(
  p: Person,
  id: string,
  cart: Record<string, number>,
  method: string,
  address: string,
  pin: string,
  rx: string,
) {
  if (!client)
    return write((d) => place(d, p, id, cart, method, address, pin, rx));
  const { data, error } = await client.rpc("fm_place", {
    shop_id: id,
    basket: cart,
    mode: method,
    destination: address,
    postcode: pin,
    file_path: rx,
  });
  if (error) throw error;
  return data as Order;
}
export async function transition(
  p: Person,
  id: string,
  to: string,
  value: string,
) {
  if (!client) return write((d) => change(d, p, id, to, value));
  const { error } = await client.rpc("fm_change", {
    order_id: id,
    target: to,
    detail: value,
  });
  if (error) throw error;
}
export async function saveShop(p: Person, s: Shop) {
  if (s.owner !== p.id) throw Error("Choose your own store");
  if (!client)
    return write((d) => {
      const x = d.shops.find((x) => x.id === s.id);
      if (!x) throw Error("Unknown store");
      Object.assign(x, s);
    });
  const { error } = await client.from("fm_shops").upsert(s);
  if (error) throw error;
}
export async function upload(p: Person, file: File) {
  if (
    !["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
    file.size > 5242880
  )
    throw Error("Choose a JPG, PNG or PDF up to 5 MB");
  if (!client) return (await import("./files")).putFile(file);
  const path =
    p.id +
    "/" +
    crypto.randomUUID() +
    "." +
    { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[
      file.type
    ];
  const { error } = await client.storage
    .from("prescriptions")
    .upload(path, file);
  if (error) throw error;
  return path;
}
export async function nearby(lat: number, lng: number) {
  if (!client) return null;
  const { data, error } = await client.rpc("fm_nearby", {
    ulat: lat,
    ulng: lng,
  });
  if (error) throw error;
  return data as { id: string; km: number }[];
}
export const blankShop = (owner: string): Shop => ({
  id: crypto.randomUUID(),
  owner,
  name: "My pharmacy",
  address: "",
  lat: 21.35,
  lng: 74.88,
  pins: [],
  open: false,
  stock: Object.fromEntries(items.map((x) => [x.id, 0])),
  price: Object.fromEntries(items.map((x) => [x.id, 1])),
});
