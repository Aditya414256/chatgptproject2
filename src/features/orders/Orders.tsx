import { useEffect, useState } from "react";
import { client, transition } from "../../api";
import { type DB, type Person } from "../../model";
export function Orders({
  db,
  p,
  refresh,
  shopAgain,
}: {
  db: DB;
  p: Person;
  refresh: () => void;
  shopAgain: () => void;
}) {
  const owner = p.role === "store_owner",
    [msg, E] = useState("");
  const [viewer, setViewer] = useState("");
  useEffect(()=>()=>{if(viewer.startsWith("blob:"))URL.revokeObjectURL(viewer)},[viewer]);
  const orders = db.orders.filter((o) =>
    owner
      ? db.shops.some((s) => s.owner === p.id && s.id === o.shop)
      : o.customer === p.id,
  );
  return (
    <>
      {viewer && <section className="panel"><button onClick={()=>setViewer("")}>Close prescription</button><iframe title="Prescription viewer" sandbox="" src={viewer} style={{width:"100%",height:420,border:0}}/></section>}
      <header>
        <small>{owner ? "PHARMACY WORKSPACE" : "CUSTOMER COUNTER"}</small>
        <h1>{owner ? "Order desk" : "My orders"}</h1>
        <p>
          {owner
            ? "Keep this tab open to receive orders."
            : "Follow your order from request to handover."}
        </p>
      </header>
      {msg && <p role="alert">{msg}</p>}
      {!orders.length && (
        <section className="panel">
          <h2>No orders yet</h2>
          <p>
            {owner
              ? "Incoming orders will appear here."
              : "Choose medicines from the catalogue to place your first order."}
          </p>
        </section>
      )}
      {orders.map((o) => (
        <article className="panel order" key={o.id}>
          <div className="row">
            <div>
              <small>ORDER {o.id.slice(0, 6).toUpperCase()}</small>
              <h2>{db.shops.find((s) => s.id === o.shop)?.name}</h2>
            </div>
            <em>{o.status.replaceAll("_", " ")}</em>
          </div>
          <p>
            {o.method === "pickup" ? "Store pickup" : "Home delivery"} · ₹
            {o.total} · {new Date(o.created).toLocaleString()}
          </p>
          {owner && (
            <p>
              {o.person} · {o.phone} {o.address && " · " + o.address}
            </p>
          )}
          {o.lines.map((l) => (
            <div className="line" key={l.id}>
              {l.name} × {l.qty}
              <b>₹{l.price * l.qty}</b>
            </div>
          ))}
          {o.method === "pickup" && o.lines.some((l) => l.rx) && (
            <p>Verify prescription at handover.</p>
          )}
          {!owner && (
            <p>
              Handover code <strong>{o.code}</strong>
            </p>
          )}
          {o.rx && owner && (
            <button
              className="secondary"
              onClick={async () => {
                if (!client) {
                  const bytes = await import("../../files");
                  const f = await bytes.getFile(o.rx);
                  if (f)
                    setViewer(URL.createObjectURL(f));
                  else E("File unavailable on this browser.");
                  return;
                }
                const r = await client.storage
                  .from("prescriptions")
                  .createSignedUrl(o.rx, 60);
                if (r.data) setViewer(r.data.signedUrl);
                else E("File unavailable");
              }}
            >
              View prescription
            </button>
          )}
          {o.reason && <p>{o.reason}</p>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const el = e.nativeEvent as SubmitEvent;
              const to = (el.submitter as HTMLButtonElement).value;
              try {
                await transition(
                  p,
                  o.id,
                  to,
                  String(new FormData(e.currentTarget).get("detail") || ""),
                );
                refresh();
                E("");
              } catch (x) {
                E((x as Error).message);
              }
            }}
          >
            {owner && o.status === "pending" && (
              <>
                <label>
                  Reason if rejecting
                  <input name="detail" list="reasons" />
                  <datalist id="reasons">
                    <option>Invalid prescription</option>
                    <option>Out of stock</option>
                  </datalist>
                </label>
                <button value="accepted">Accept</button>{" "}
                <button className="secondary" value="rejected">
                  Reject
                </button>
              </>
            )}
            {owner && o.status === "accepted" && (
              <button
                value={o.method === "pickup" ? "ready" : "out_for_delivery"}
              >
                {o.method === "pickup" ? "Mark ready" : "Out for delivery"}
              </button>
            )}
            {owner && ["ready", "out_for_delivery"].includes(o.status) && (
              <>
                <label>
                  Customer handover code
                  <input name="detail" maxLength={4} inputMode="numeric" />
                </label>
                <button value="completed">Complete</button>{" "}
                <button className="secondary" value="not_collected">
                  Not collected
                </button>
              </>
            )}
            {!owner && o.status === "pending" && (
              <button className="secondary" value="cancelled">
                Cancel order
              </button>
            )}
          </form>
          {!owner &&
            ["expired", "cancelled", "rejected"].includes(o.status) && (
              <button
                onClick={() => {
                  sessionStorage.setItem(
                    "fm-basket-" + p.id,
                    JSON.stringify(
                      Object.fromEntries(o.lines.map((l) => [l.id, l.qty])),
                    ),
                  );
                  shopAgain();
                }}
              >
                Choose another pharmacy
              </button>
            )}
        </article>
      ))}
    </>
  );
}
