import { useState } from "react";
import { ArrowRight, Cross, Store, ShoppingBag, MapPin } from "lucide-react";
import { BRAND } from "../../config/brand";
import { client, login } from "../../api";
import type { Person, Role } from "../../model";
export function Login({ enter }: { enter: (p: Person) => void }) {
  const [signup, set] = useState(false),
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  function demo(owner: boolean) {
    const p: Person = {
      id: owner ? "owner0" : "customer",
      name: owner ? "Riverbend team" : "Demo customer",
      phone: "Demo contact",
      role: owner ? "store_owner" : "customer",
    };
    sessionStorage.setItem("fm-person", JSON.stringify(p));
    enter(p);
  }
  return (
    <div className="welcome">
      <section className="poster">
        <div className="word">
          <Cross />
          {BRAND}
        </div>
        <div className="posterTitle">
          <small>NEIGHBOURHOOD PHARMACY</small>
          <h1>
            Your local
            <br />
            medicine
            <br />
            <i>counter.</i>
          </h1>
        </div>
        <div className="ticket">
          <b>Riverbend Pharmacy</b>
          <span>
            <MapPin size={16} /> Shirpur, Maharashtra
          </span>
          <hr />
          <span>
            Collection slip <strong>№ 042</strong>
          </span>
          <div className="barcode" />
        </div>
      </section>
      <section className="access">
        <small>ACCOUNT ACCESS</small>
        <h2>{signup ? "Create your account" : "Welcome back"}</h2>
        <p>
          {client
            ? "Sign in to your medicine counter."
            : "Explore the college demo as a customer or a pharmacy owner."}
        </p>
        {client ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              wait(true);
              try {
                const p = await login(
                  String(f.get("email")),
                  String(f.get("password")),
                  String(f.get("name")),
                  String(f.get("phone")),
                  f.get("role") as Role,
                  signup,
                );
                if (p) enter(p);
              } catch (ex) {
                err((ex as Error).message);
              } finally {
                wait(false);
              }
            }}
          >
            {signup && (
              <>
                <label>
                  Name
                  <input required name="name" />
                </label>
                <label>
                  Phone
                  <input required name="phone" type="tel" />
                </label>
                <label>
                  Account type
                  <select name="role">
                    <option value="customer">Customer</option>
                    <option value="store_owner">Store owner</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Email
              <input required name="email" type="email" />
            </label>
            <label>
              Password
              <input required name="password" minLength={6} type="password" />
            </label>
            <button disabled={busy}>
              {signup ? "Create account" : "Sign in"} <ArrowRight />
            </button>
            <button
              type="button"
              className="plain"
              onClick={() => set(!signup)}
            >
              {signup ? "Already registered? Sign in" : "Create an account"}
            </button>
          </form>
        ) : (
          <>
            <button className="role" onClick={() => demo(false)}>
              <ShoppingBag />
              Customer counter <ArrowRight />
            </button>
            <button className="role secondary" onClick={() => demo(true)}>
              <Store />
              Pharmacy workspace <ArrowRight />
            </button>
            <p className="hint">
              Open a second tab to try the other role. Demo orders are shared
              within this browser.
            </p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
