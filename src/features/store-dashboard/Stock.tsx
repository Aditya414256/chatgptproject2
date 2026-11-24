import { useState } from "react";
import { blankShop, saveShop } from "../../api";
import { items, type Person, type Shop } from "../../model";
export function Stock({
  p,
  shop,
  refresh,
}: {
  p: Person;
  shop?: Shop;
  refresh: () => void;
}) {
  const [s, S] = useState<Shop>(() => structuredClone(shop ?? blankShop(p.id))),
    [msg, E] = useState("");
  return (
    <>
      <header>
        <small>PHARMACY WORKSPACE</small>
        <h1>Store & inventory</h1>
      </header>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveShop(p, s);
            refresh();
            E("Store saved.");
          } catch (x) {
            E((x as Error).message);
          }
        }}
      >
        <label>
          Pharmacy name
          <input
            required
            value={s.name}
            onChange={(e) => S({ ...s, name: e.target.value })}
          />
        </label>
        <label>
          Address
          <input
            required
            value={s.address}
            onChange={(e) => S({ ...s, address: e.target.value })}
          />
        </label>
        <label>
          Serviceable delivery pincodes (comma separated)
          <input
            value={s.pins.join(",")}
            onChange={(e) =>
              S({ ...s, pins: e.target.value.split(",").map((x) => x.trim()) })
            }
          />
        </label>
        <label>
          Store status
          <select
            value={s.open ? "open" : "closed"}
            onChange={(e) => S({ ...s, open: e.target.value === "open" })}
          >
            <option>open</option>
            <option>closed</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            navigator.geolocation.getCurrentPosition(
              (v) =>
                S({ ...s, lat: v.coords.latitude, lng: v.coords.longitude }),
              () => E("Location unavailable"),
            )
          }
        >
          Capture store location
        </button>
        <h2>Inventory</h2>
        {items.map((m) => (
          <div className="row" key={m.id}>
            <b>{m.name}</b>
            <div className="numbers">
              {(["price", "stock"] as const).map((k) => (
                <label key={k}>
                  {k === "price" ? "₹ / unit" : "Stock"}
                  <input
                    type="number"
                    min={k === "price" ? 1 : 0}
                    required
                    value={s[k][m.id] ?? 0}
                    onChange={(e) =>
                      S({
                        ...s,
                        [k]: { ...s[k], [m.id]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button>Save changes</button>
        <p role="status">{msg}</p>
      </form>
    </>
  );
}
