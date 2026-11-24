export type Role = "customer" | "store_owner";
export type Person = { id: string; name: string; phone: string; role: Role };
export type Item = {
  id: string;
  name: string;
  form: string;
  strength: string;
  rx: boolean;
};
export type Shop = {
  id: string;
  owner: string;
  name: string;
  address: string;
  pins: string[];
  lat: number;
  lng: number;
  open: boolean;
  stock: Record<string, number>;
  price: Record<string, number>;
};
export type Line = {
  id: string;
  name: string;
  qty: number;
  price: number;
  rx: boolean;
};
export type Order = {
  id: string;
  customer: string;
  person: string;
  phone: string;
  shop: string;
  method: string;
  address: string;
  pin: string;
  lines: Line[];
  total: number;
  status: string;
  code: string;
  reason: string;
  rx: string;
  created: number;
  expires: number;
};
export type DB = { shops: Shop[]; orders: Order[] };
export const items: Item[] = [
  ["Paracetamol", "Tablet", "500 mg"],
  ["Cetirizine", "Tablet", "10 mg"],
  ["Oral rehydration salts", "Sachet", "21.8 g"],
  ["Amoxicillin", "Capsule", "500 mg", "rx"],
  ["Vitamin C", "Tablet", "500 mg"],
  ["Calamine", "Lotion", "100 ml"],
  ["Metformin", "Tablet", "500 mg", "rx"],
  ["Amlodipine", "Tablet", "5 mg", "rx"],
  ["Saline nasal spray", "Spray", "10 ml"],
  ["Omeprazole", "Capsule", "20 mg", "rx"],
  ["Clotrimazole", "Cream", "1%"],
  ["Vitamin D3", "Tablet", "1000 IU"],
  ["Zinc", "Tablet", "20 mg"],
  ["Azithromycin", "Tablet", "250 mg", "rx"],
  ["Povidone iodine", "Solution", "5%"],
  ["Carboxymethylcellulose", "Eye drops", "0.5%"],
].map(([name, form, strength, rx], i) => ({
  id: "m" + (i + 1),
  name,
  form,
  strength,
  rx: !!rx,
}));
export function initial(): DB {
  return {
    orders: [],
    shops: [
      "Riverbend Pharmacy",
      "Market Road Chemists",
      "Neem Medical Store",
      "Station Pharmacy",
    ].map((name, i) => ({
      id: "s" + i,
      owner: "owner" + i,
      name,
      address: [
        "Karvand Road, Shirpur",
        "Main Bazaar, Shirpur",
        "Near Bus Stand, Shirpur",
        "Station Road, Shirpur",
      ][i],
      pins: i % 2 ? ["425405", "425421"] : ["425405", "425406"],
      lat: 21.35 + i * 0.006,
      lng: 74.88 - i * 0.003,
      open: true,
      stock: Object.fromEntries(
        items.map((m, j) => [m.id, i && j % 5 === i ? 0 : 12 + j]),
      ),
      price: Object.fromEntries(
        items.map((m, j) => [m.id, 5 + ((j * 7 + i * 3) % 65)]),
      ),
    })),
  };
}
export function distance(lat: number, lng: number, s: Shop) {
  const rad = Math.PI / 180;
  return (
    12742 *
    Math.asin(
      Math.sqrt(
        Math.sin(((s.lat - lat) * rad) / 2) ** 2 +
          Math.cos(lat * rad) *
            Math.cos(s.lat * rad) *
            Math.sin(((s.lng - lng) * rad) / 2) ** 2,
      ),
    )
  );
}
export function place(
  db: DB,
  p: Person,
  shop: string,
  cart: Record<string, number>,
  method: string,
  address: string,
  pin: string,
  rx: string,
  ttl = 600000,
): Order {
  const s = db.shops.find((x) => x.id === shop);
  if (p.role !== "customer" || !s?.open) throw Error("Store unavailable");
  if (!["pickup", "delivery"].includes(method))
    throw Error("Choose a fulfilment method");
  const lines = Object.entries(cart).map(([id, qty]) => {
    const m = items.find((x) => x.id === id);
    if (!m || !Number.isInteger(qty) || qty < 1 || (s.stock[id] ?? 0) < qty)
      throw Error("Stock changed. Review your basket.");
    return { id, name: m.name, rx: m.rx, qty, price: s.price[id] };
  });
  if (!lines.length) throw Error("Your basket is empty");
  if (
    method === "delivery" &&
    (!s.pins.includes(pin) ||
      !address.trim() ||
      (lines.some((l) => l.rx) && !rx))
  )
    throw Error("Check delivery details and prescription");
  const now = Date.now(),
    o = {
      id: crypto.randomUUID(),
      customer: p.id,
      person: p.name,
      phone: p.phone,
      shop,
      method,
      address,
      pin,
      lines,
      total: lines.reduce((a, l) => a + l.qty * l.price, 0),
      status: "pending",
      code: String(
        1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000),
      ),
      reason: "",
      rx: method === "delivery" ? rx : "",
      created: now,
      expires: now + ttl,
    };
  for (const l of lines) s.stock[l.id] -= l.qty;
  db.orders.unshift(o);
  return o;
}
export function change(
  db: DB,
  p: Person | null,
  id: string,
  to: string,
  value = "",
) {
  const o = db.orders.find((x) => x.id === id);
  if (!o) throw Error("Order unavailable");
  const s = db.shops.find((x) => x.id === o.shop)!;
  const owner = p?.role === "store_owner" && s.owner === p.id,
    customer = p?.role === "customer" && o.customer === p.id;
  const ok =
    (o.status === "pending" &&
      ((owner && ["accepted", "rejected"].includes(to)) ||
        (customer && to === "cancelled") ||
        (!p && Date.now() >= o.expires && to === "expired"))) ||
    (o.status === "accepted" &&
      owner &&
      [
        o.method === "pickup" ? "ready" : "out_for_delivery",
        "cancelled",
      ].includes(to)) ||
    (["ready", "out_for_delivery"].includes(o.status) &&
      owner &&
      ["completed", "not_collected"].includes(to));
  if (
    !ok ||
    (to === "rejected" && !value.trim()) ||
    (to === "completed" && value !== o.code)
  )
    throw Error("Check order status, rejection reason or handover code");
  if (["cancelled", "expired", "rejected"].includes(to))
    for (const l of o.lines) s.stock[l.id] += l.qty;
  o.status = to;
  if (to === "rejected") o.reason = value;
}
