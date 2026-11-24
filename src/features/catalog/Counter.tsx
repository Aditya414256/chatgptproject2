import { useState } from "react";
import { Search, ShoppingBag, LocateFixed } from "lucide-react";
import { items, distance, type Person, type DB } from "../../model";
import { order, upload, nearby } from "../../api";
export function Counter({
  p,
  db,
  done,
}: {
  p: Person;
  db: DB;
  done: () => void;
}) {
  const storage = "fm-basket-" + p.id;
  const [cart, C] = useState<Record<string, number>>(() =>
      JSON.parse(sessionStorage.getItem(storage) || "{}"),
    ),
    [query, Q] = useState(""),
    [method, M] = useState("pickup"),
    [step, S] = useState(false),
    [pin, P] = useState(""),
    [addr, A] = useState(""),
    [shop, H] = useState(""),
    [geo, G] = useState<number[] | null>(null),
    [dist, D] = useState<Record<string, number> | null>(null),
    [file, F] = useState(""),
    [msg, E] = useState(""),
    [busy, B] = useState(false);
  function save(c: typeof cart) {
    sessionStorage.setItem(storage, JSON.stringify(c));
    C(c);
  }
  function adjust(id: string, d: number) {
    const c = { ...cart };
    c[id] = (c[id] || 0) + d;
    if (c[id] <= 0) delete c[id];
    save(c);
  }
  const keys = Object.keys(cart),
    count = Object.values(cart).reduce((a, b) => a + b, 0),
    rx = items.some((i) => i.rx && cart[i.id]),
    s = db.shops.find((s) => s.id === shop),
    missing = (s: DB["shops"][0]) =>
      keys.filter((k) => (s.stock[k] || 0) < cart[k]);
  const candidates = db.shops
    .map((s) => ({
      s,
      km: geo ? (dist?.[s.id] ?? distance(geo[0], geo[1], s)) : 0,
    }))
    .filter(({ s, km }) =>
      method === "pickup" && geo ? km <= 5 : s.pins.includes(pin),
    )
    .sort(
      (a, b) =>
        Number(!!missing(a.s).length) - Number(!!missing(b.s).length) ||
        a.km - b.km,
    );
  function locate() {
    if (!navigator.geolocation) {
      E("Enter a pincode to search.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: a, longitude: b } = pos.coords;
          const rows = await nearby(a, b);
          D(rows ? Object.fromEntries(rows.map((r) => [r.id, r.km])) : null);
          G([a, b]);
          H("");
          E("");
        } catch (x) {
          E((x as Error).message);
        }
      },
      () => E("Location unavailable. Enter your pincode below."),
    );
  }
  return (
    <>
      <header>
        <small>CUSTOMER COUNTER</small>
        <h1>{step ? "Choose a pharmacy" : "Medicine catalogue"}</h1>
        <p>
          {step
            ? "Select how and where to receive your order."
            : "Search medicines and add the quantities you need."}
        </p>
      </header>
      <div className="columns">
        <section className="panel">
          {!step ? (
            <>
              <div className="search">
                <Search />
                <input
                  aria-label="Search medicines"
                  placeholder="Search by medicine name"
                  value={query}
                  onChange={(e) => Q(e.target.value)}
                />
              </div>
              {items
                .filter((i) =>
                  i.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((i) => (
                  <div className="row" key={i.id}>
                    <div>
                      <b>{i.name}</b>
                      <span>
                        {i.strength} · {i.form}{" "}
                        {i.rx && <em>Prescription required</em>}
                      </span>
                    </div>
                    <div className="step">
                      {cart[i.id] > 0 && (
                        <>
                          <button
                            aria-label={"Remove one " + i.name}
                            onClick={() => adjust(i.id, -1)}
                          >
                            −
                          </button>
                          {cart[i.id]}
                        </>
                      )}
                      <button
                        aria-label={"Add " + i.name}
                        onClick={() => adjust(i.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              {!items.some((i) =>
                i.name.toLowerCase().includes(query.toLowerCase()),
              ) && <p>No matching medicines.</p>}
            </>
          ) : (
            <>
              <button className="plain" onClick={() => S(false)}>
                ← Edit medicines
              </button>
              <label>
                Fulfilment
                <select
                  aria-label="Fulfilment"
                  value={method}
                  onChange={(e) => {
                    M(e.target.value);
                    H("");
                    F("");
                  }}
                >
                  <option value="pickup">Pick up from store</option>
                  <option value="delivery">Home delivery</option>
                </select>
              </label>
              {method === "pickup" ? (
                <button className="secondary" onClick={locate}>
                  <LocateFixed /> Find within 5 km
                </button>
              ) : (
                <label>
                  Delivery address
                  <input value={addr} onChange={(e) => A(e.target.value)} />
                </label>
              )}
              <label>
                Pincode
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="425405"
                  value={pin}
                  onChange={(e) => {
                    P(e.target.value);
                    G(null);
                    H("");
                  }}
                />
              </label>
              {candidates.map(({ s, km }) => (
                <div className="row" key={s.id}>
                  <div>
                    <b>{s.name}</b>
                    <span>
                      {s.address} · {s.open ? "Open" : "Closed"}{" "}
                      {geo &&
                        method === "pickup" &&
                        " · " + km.toFixed(1) + " km"}
                    </span>
                    <span>
                      {missing(s).length
                        ? "Missing: " +
                          missing(s)
                            .map((k) => items.find((x) => x.id === k)?.name)
                            .join(", ")
                        : "All items available"}{" "}
                      · ₹
                      {keys
                        .filter((k) => !missing(s).includes(k))
                        .reduce((t, k) => t + s.price[k] * cart[k], 0)}
                    </span>
                  </div>
                  <button
                    disabled={!s.open || missing(s).length === keys.length}
                    onClick={() => {
                      if (missing(s).length)
                        save(
                          Object.fromEntries(
                            Object.entries(cart).filter(
                              ([k]) => !missing(s).includes(k),
                            ),
                          ),
                        );
                      H(s.id);
                    }}
                  >
                    {shop === s.id
                      ? "Selected"
                      : missing(s).length
                        ? "Remove missing & select"
                        : "Select"}
                  </button>
                </div>
              ))}
              {!candidates.length && (
                <p>Enter a serviceable pincode or try a nearby location.</p>
              )}
              {rx &&
                (method === "pickup" ? (
                  <p className="notice">
                    Bring your prescription. The store will verify it when you
                    collect.
                  </p>
                ) : (
                  <label>
                    Prescription · JPG, PNG or PDF, up to 5 MB
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={async (e) => {
                        F("");
                        const f = e.target.files?.[0];
                        if (f)
                          try {
                            F(await upload(p, f));
                          } catch (x) {
                            E((x as Error).message);
                          }
                      }}
                    />
                  </label>
                ))}
            </>
          )}
        </section>
        <aside className="panel basket">
          <ShoppingBag />
          <h2>Your basket</h2>
          {keys.map((k) => (
            <div className="line" key={k}>
              {items.find((x) => x.id === k)?.name}
              <b>× {cart[k]}</b>
            </div>
          ))}
          {!count && <p>Your selected medicines appear here.</p>}
          {s && step && (
            <>
              <hr />
              <b>{s.name}</b>
              <p>
                ₹{keys.reduce((a, k) => a + s.price[k] * cart[k], 0)} ·{" "}
                {method === "pickup" ? "Pay at store" : "Cash on delivery"}
              </p>
            </>
          )}
          <button
            disabled={
              busy ||
              !count ||
              (step &&
                (!s ||
                  (method === "delivery" && (!addr.trim() || (rx && !file)))))
            }
            onClick={async () => {
              if (!step) {
                S(true);
                return;
              }
              B(true);
              try {
                await order(p, shop, cart, method, addr, pin, file);
                done();
              } catch (x) {
                E((x as Error).message);
              } finally {
                B(false);
              }
            }}
          >
            {busy
              ? "Placing order…"
              : step
                ? "Place order"
                : "Choose fulfilment"}
          </button>
          {msg && <p role="alert">{msg}</p>}
        </aside>
      </div>
    </>
  );
}
