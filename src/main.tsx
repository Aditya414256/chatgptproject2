import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Cross, Bell, LogOut } from "lucide-react";
import { BRAND } from "./config/brand";
import { Login } from "./features/auth/Login";
import { Counter } from "./features/catalog/Counter";
import { Stock } from "./features/store-dashboard/Stock";
import { Orders } from "./features/orders/Orders";
import { client, load, profile } from "./api";
import { type Person, type DB } from "./model";
import { write } from "./demo";
import "./style.css";
function App() {
  const [p, P] = useState<Person | null>(null),
    [db, D] = useState<DB>({ orders: [], shops: [] }),
    [msg, E] = useState(""),
    [badge, B] = useState(0),
    [ready, R] = useState(false);
  const last = useRef<Set<string> | null>(null),
    sound = useRef<AudioContext | null>(null);
  const nav = useNavigate(),
    path = useLocation().pathname;
  useEffect(() => {
    profile()
      .then(P)
      .catch((e) => E(e.message))
      .finally(() => R(true));
  }, []);
  async function refresh() {
    try {
      D(await load());
    } catch (e) {
      E((e as Error).message);
    }
  }
  useEffect(() => {
    if (!p) return;
    last.current = null;
    B(0);
    let active = true;
    const sync = async () => {
      try {
        const d = await load();
        if (!active) return;
        D(d);
        if (p.role === "store_owner") {
          const ids = d.orders
            .filter((o) =>
              d.shops.some((s) => s.owner === p.id && s.id === o.shop),
            )
            .map((o) => o.id);
          const n = ids.filter(
            (id) => last.current && !last.current.has(id),
          ).length;
          if (n) {
            E("New pharmacy order received.");
            B((b) => b + n);
            if (sound.current) {
              const a = sound.current,
                t = a.createOscillator(),
                g = a.createGain();
              g.gain.value = 0.05;
              t.connect(g);
              g.connect(a.destination);
              t.start();
              t.stop(a.currentTime + 0.18);
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              )
                new Notification(BRAND, { body: "New pharmacy order" });
            }
          }
          last.current = new Set(ids);
        }
      } catch (e) {
        if (active) E((e as Error).message);
      }
    };
    void sync();
    window.addEventListener("storage", sync);
    window.addEventListener("datachange", sync);
    const timer = setInterval(() => {
      if (!client)
        void load().then((d) => {
          if (
            d.orders.some(
              (o) => o.status === "pending" && o.expires <= Date.now(),
            )
          )
            void write(() => {});
        });
      void sync();
    }, 5000);
    const ch = client
      ?.channel("counter-" + p.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fm_orders" },
        sync,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void sync();
      });
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("datachange", sync);
      if (ch) void client?.removeChannel(ch);
    };
  }, [p?.id]);
  const owner = p?.role === "store_owner";
  return (
    <>
      {!ready ? (
        <p>Opening counter…</p>
      ) : !p ? (
        <Login
          enter={(u) => {
            P(u);
            nav(u.role === "customer" ? "/catalog" : "/orders");
          }}
        />
      ) : (
        <>
          <nav>
            <div className="word">
              <Cross />
              {BRAND}
            </div>
            <div className="links">
              {owner ? (
                <>
                  <Link to="/orders" onClick={() => B(0)}>
                    Orders {badge || ""}
                  </Link>
                  <Link to="/inventory">Inventory</Link>
                </>
              ) : (
                <>
                  <Link to="/catalog">Catalogue</Link>
                  <Link to="/orders">My orders</Link>
                </>
              )}
            </div>
            <button
              className="secondary"
              aria-label="Sign out"
              onClick={async () => {
                await client?.auth.signOut();
                sessionStorage.removeItem("fm-person");
                P(null);
                E("");
                nav("/login");
              }}
            >
              <LogOut />
            </button>
          </nav>
          <main>
            {owner && (
              <button
                className="alertbtn secondary"
                onClick={async () => {
                  try {
                    sound.current ??= new AudioContext();
                    await sound.current.resume();
                    if ("Notification" in window)
                      await Notification.requestPermission();
                    E("In-app alerts enabled.");
                  } catch {
                    E("In-app alerts are available while this tab is open.");
                  }
                }}
              >
                <Bell size={16} />
                Enable alerts
              </button>
            )}
            {owner && path === "/inventory" ? (
              <Stock
                key={db.shops.find((s) => s.owner === p.id)?.id || "new"}
                p={p}
                shop={db.shops.find((s) => s.owner === p.id)}
                refresh={refresh}
              />
            ) : owner || path === "/orders" ? (
              <Orders
                db={db}
                p={p}
                refresh={refresh}
                shopAgain={() => nav("/catalog")}
              />
            ) : (
              <Counter
                p={p}
                db={db}
                done={() => {
                  void refresh();
                  nav("/orders");
                }}
              />
            )}
          </main>
        </>
      )}
      {msg && (
        <div className="toast" role="status">
          {msg} <button onClick={() => E("")}>Dismiss</button>
        </div>
      )}
      <footer>
        {BRAND} <span>College project. Not for real medical use.</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
