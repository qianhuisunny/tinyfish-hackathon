import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";
import { TinyFish } from "./providers/tinyfish.js";
import { App, rankCompanies } from "./app.js";
import { text } from "./validation.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function createAppServer({
  dataPath = process.env.DATA_PATH || resolve(root, "data/state.json"),
  recover = true,
} = {}) {
  const store = await new Store(dataPath).init();
  const fish = new TinyFish({
    onCall: (c) =>
      store.transact((s) => {
        s.providerCalls.push(c);
        if (s.providerCalls.length > 2000)
          s.providerCalls = s.providerCalls.slice(-2000);
      }),
  });
  const app = new App(store, fish);
  const server = createServer(async (req, res) => {
    const host = req.headers.host || "";
    const origin = req.headers.origin;
    const send = (code, data) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
        return send(403, {
          error: "This single-user app accepts loopback requests only",
        });
      if (origin && origin !== "http://" + host)
        return send(403, { error: "Cross-origin requests rejected" });
      const path = new URL(req.url, "http://" + host).pathname;
      if (req.method === "GET" && path === "/api/state") {
        const s = await store.read();
        return send(200, {
          ...s,
          companies: rankCompanies(s),
          configuration: {
            tinyfishReady: !!process.env.TINYFISH_API_KEY,
            mode: "live",
            drafting: "Evidence-grounded templates",
            timeZone: "America/Los_Angeles",
          },
        });
      }
      if (req.method === "GET" && !path.startsWith("/api/")) {
        const names = {
          "/": "index.html",
          "/app.js": "app.js",
          "/styles.css": "styles.css",
        };
        if (!names[path]) return send(404, { error: "Not found" });
        const data = await readFile(resolve(root, "public", names[path]));
        res.writeHead(200, {
          "Content-Type": path.endsWith(".js")
            ? "text/javascript"
            : path.endsWith(".css")
              ? "text/css"
              : "text/html",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
        });
        return res.end(data);
      }
      if (req.method !== "POST") return send(404, { error: "Not found" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(415, { error: "JSON required" });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 100000) throw Error("Request too large");
      }
      const body = JSON.parse(raw || "{}");
      if (path === "/api/jobs")
        return send(202, await app.enqueue(body.type, body.input || {}));
      if (path === "/api/confirm-brief") {
        await app.confirmBrief(body);
        return send(202, await app.enqueue("discover"));
      }
      if (path === "/api/save-brief") {
        await store.transact((s) => {
          if (s.workspace) throw Error("Brief already confirmed");
          s.onboardingDraft = body;
        });
        return send(200, { ok: true });
      }
      if (path === "/api/confirm-companies") {
        const ids = await app.confirmCompanies();
        return send(202, {
          companyIds: ids,
          job: await app.enqueue("contacts"),
        });
      }
      if (path === "/api/remove-company") {
        await app.removeCompany(text(body.id, 100));
        return send(200, { ok: true });
      }
      if (path === "/api/draft")
        return send(200, await app.draft(text(body.personId, 100)));
      if (path === "/api/outreach") {
        await app.updateOutreach(text(body.id, 100), body);
        return send(200, { ok: true });
      }
      if (path === "/api/note") {
        await store.transact((s) => {
          const entity = [...s.people, ...s.companies].find(
            (x) => x.id === body.id,
          );
          if (!entity) throw Error("Record not found");
          entity.notes = text(body.notes);
        });
        return send(200, { ok: true });
      }
      if (path === "/api/product-context") {
        await store.transact((s) => {
          if (!s.workspace) throw Error("Confirm your brief first");
          s.workspace.productDescription = text(body.productDescription);
          s.workspace.messageStyle = {
            tone: text(body.tone, 100),
            language: text(body.language, 40),
            notes: text(body.notes || ""),
          };
          s.workspace.productNotes = text(body.productNotes || "");
        });
        return send(200, { ok: true });
      }
      if (path === "/api/schedule") {
        await store.transact((s) => {
          for (const key of ["weekly", "daily"])
            if (typeof body[key] === "boolean")
              s.schedules[key].enabled = body[key];
        });
        return send(200, { ok: true });
      }
      if (path === "/api/event") {
        await store.transact((s) => {
          const e = s.events.find((x) => x.id === body.id);
          if (!e || !["dismissed", "snoozed", "new"].includes(body.status))
            throw Error("Invalid event");
          e.status = body.status;
          if (body.status === "snoozed")
            e.snoozedUntil = new Date(Date.now() + 7 * 864e5).toISOString();
        });
        return send(200, { ok: true });
      }
      return send(404, { error: "Unknown action" });
    } catch (e) {
      send(400, { error: e.message });
    }
  });
  let timer;
  if (recover) {
    await app.recover();
    timer = setInterval(
      () => app.tick().catch((e) => console.error("Scheduler:", e.message)),
      30000,
    );
    timer.unref();
  }
  server.on("close", () => clearInterval(timer));
  return { server, app, store };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server } = await createAppServer();
  const port = Number(process.env.PORT || 4317);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Founder Outreach: http://localhost:${port} — live TinyFish mode`,
    ),
  );
}
