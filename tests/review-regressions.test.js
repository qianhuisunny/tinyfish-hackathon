import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Store } from "../src/store.js";
import { App } from "../src/app.js";
async function setup(fish = {}) {
  const path = (await mkdtemp(tmpdir() + "/review-")) + "/state.json";
  const store = await new Store(path).init();
  await store.transact((s) => {
    s.workspace = {
      targetPeople: { roles: ["Founder"] },
      demoContactCompanyIds: ["c"],
      listConfirmedAt: "2026-10-01",
    };
    s.companies = [
      {
        id: "c",
        name: "Acme",
        domain: "acme.com",
        listStatus: "confirmed",
        lastSuccessfulCheckAt: "2026-10-01",
      },
    ];
    s.jobs = [{ id: "j", coverageGaps: [], agentRuns: {} }];
  });
  return { path, store, app: new App(store, fish) };
}
test("several people sharing a team-page URL survive repeated research", async () => {
  const { store, app } = await setup();
  const people = ["Alice", "Bob"].map((name) => ({
    name,
    contactUrl: "https://acme.com/team",
    sources: [{ url: "https://acme.com/team" }],
  }));
  await app.addPeople("c", people);
  await app.addPeople("c", people);
  assert.equal((await store.read()).people.length, 2);
});
test("removed root domain suppresses subdomain alias but not unrelated tenants", async () => {
  const { app, store } = await setup();
  await app.removeCompany("c");
  await app.addCompanies([{ name: "Acme app", domain: "app.acme.com" }]);
  assert.equal(
    (await store.read()).companies.filter((c) => c.listStatus !== "deleted")
      .length,
    0,
  );
  await app.addCompanies([
    { name: "Tenant A", domain: "one.vercel.app" },
    { name: "Tenant B", domain: "two.vercel.app" },
  ]);
  assert.equal(
    (await store.read()).companies.filter((c) => c.listStatus !== "deleted")
      .length,
    2,
  );
});
test("paraphrased or syndicated events do not revive a dismissed trigger", async () => {
  const { app, store } = await setup();
  const event = {
    type: "launch",
    summary: "New dashboard",
    occurredAt: "2026-10-10",
    sourceUrl: "https://acme.com/news",
    evidence: "new dashboard",
    priority: 2,
  };
  await app.addEvents("c", [event]);
  await store.transact((s) => (s.events[0].status = "dismissed"));
  await app.addEvents("c", [
    {
      ...event,
      summary: "Dashboard launched",
      sourceUrl: "https://news.example/story",
    },
  ]);
  const s = await store.read();
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].status, "dismissed");
  assert.equal(s.events[0].sources.length, 2);
});
test("partial event fetch keeps valid event and prior complete-check time", async () => {
  const { app, store } = await setup({
    search: async () => ({
      results: [
        { url: "https://9.9.9.9/news" },
        { url: "https://8.8.8.8/news" },
      ],
    }),
    fetchPages: async () => ({
      results: [
        { url: "https://9.9.9.9/news", text: "October 10: new dashboard" },
      ],
      errors: [{ url: "https://8.8.8.8/news", error: "blocked" }],
    }),
  });
  app.browser = async () => ({
    events: [
      {
        type: "launch",
        summary: "New dashboard",
        occurredAt: "2026-10-10",
        sourceUrl: "https://9.9.9.9/news",
        evidence: "October 10: new dashboard",
        priority: 2,
      },
    ],
    coverageGaps: [],
  });
  await app.monitor({}, { id: "j" });
  const s = await store.read();
  assert.equal(s.events.length, 1);
  assert.equal(s.companies[0].lastSuccessfulCheckAt, "2026-10-01");
  assert.ok(s.jobs[0].coverageGaps.length);
});
test("contacts never forward private search results to Fetch", async () => {
  const fetched = [];
  const { app, store } = await setup({
    search: async () => ({
      results: [
        { url: "http://127.0.0.1/admin" },
        { url: "https://9.9.9.9/team" },
      ],
    }),
    fetchPages: async (urls) => {
      fetched.push(...urls);
      return { results: [], errors: [] };
    },
  });
  app.browser = async () => ({ people: [], coverageGaps: [] });
  await app.contacts({}, { id: "j" });
  assert.deepEqual(fetched, ["https://9.9.9.9/team"]);
  assert.ok(
    (await store.read()).jobs[0].coverageGaps.some((x) =>
      x.includes("127.0.0.1"),
    ),
  );
});
test("schedule and queued job survive interruption as one atomic change", async () => {
  const { app, store, path } = await setup();
  app.running = true;
  await store.transact((s) => {
    s.jobs = [];
    s.schedules.weekly = { enabled: true, nextRunAt: "2020-01-01" };
    s.schedules.daily = { enabled: false, nextRunAt: null };
  });
  let writes = 0;
  const write = store.write.bind(store);
  store.write = async (s) => {
    if (++writes === 2) throw Error("simulated interruption");
    return write(s);
  };
  try {
    await app.tick(Date.parse("2026-10-11"));
  } catch {}
  const restored = await new Store(path).init();
  const resumed = new App(restored, {});
  resumed.running = true;
  await resumed.tick(Date.parse("2026-10-11"));
  assert.equal(
    (await restored.read()).jobs.filter((j) => j.type === "discover").length,
    1,
  );
});
test("dynamic contact pages escalate to a second browser verification with exact role text", async () => {
  const { app, store } = await setup({
    search: async () => ({results: []}),
    fetchPages: async () => ({results: [{text: "Navigation only"}], errors: []}),
  });
  const candidate = {name:"Alice Example", title:"Customer Success", sourceUrl:"https://9.9.9.9/team", evidence:"Page shows Alice", responsibility:"Customer Success"};
  const keys = [];
  app.browser = async (_job, key) => {
    keys.push(key);
    return {people: key.startsWith("contacts-verify-") ? [
      {...candidate, evidence:"Alice Example Customer Success", verified:true},
      {...candidate, name:"Unverified Person", verified:false},
    ] : [candidate], coverageGaps:[]};
  };
  await app.contacts({}, {id:"j"});
  const s = await store.read();
  assert.equal(s.people.length, 1);
  assert.equal(s.people[0].sources[0].verificationMethod, "Agent browser");
  assert.equal(keys.length, 2);
  assert.ok(s.jobs[0].coverageGaps.some(x => x.includes("Unverified Person")));
});
