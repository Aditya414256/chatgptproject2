import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { initial } from "../src/model.ts";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret)
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the new project.",
  );
const db = createClient(url, secret, { auth: { persistSession: false } });
const shops = initial().shops;
for (const [index, shop] of [null, ...shops].entries()) {
  const email = (shop ? "store" + index : "customer") + "@findmedicine.test";
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: shop ? "store_owner" : "customer",
      name: shop?.name ?? "Demo customer",
      phone: "Demo contact",
    },
  });
  if (error && !["email_exists", "user_already_exists"].includes(error.code))
    throw error;
  if (data.user) console.log(email, password);
  if (!shop) continue;
  let owner = data.user?.id;
  for (let page = 1; !owner; page++) {
    const users = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (users.error) throw users.error;
    owner = users.data.users.find((user) => user.email === email)?.id;
    if (!owner && users.data.users.length < 100)
      throw Error("Demo owner unavailable");
  }
  const { id, ...details } = shop;
  const saved = await db
    .from("fm_shops")
    .upsert(
      { ...details, owner },
      { onConflict: "owner", ignoreDuplicates: true },
    );
  if (saved.error) throw saved.error;
}
