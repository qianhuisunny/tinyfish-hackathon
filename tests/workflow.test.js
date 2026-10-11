import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Store } from "../src/store.js";
import { App, rankCompanies } from "../src/app.js";
import { brief } from "../src/validation.js";
const context = {
  productUrl: "https://9.9.9.9",
  productName: "Gym",
  productDescription: "Product practice",
  icpCriteria: {
    companyTypes: ["SaaS"],
    fundingStages: ["Any", "Series A"],
    shippingPreference: "Preferred",
    customText: "",
  },
  targetPeople: { roles: ["Founder"], responsibilityDescription: "" },
  outreachGoal: { purpose: "Interviews", callToAction: "15 minutes?" },
  messageStyle: { tone: "Direct", language: "English" },
};
async function setup() {
  const store = await new Store(
    (await mkdtemp(tmpdir() + "/workflow-")) + "/state.json",
  ).init();
  return { store, app: new App(store, {}, {}) };
}
test("normalizes any stage, accepts free-text criteria and rejects absent purpose", () => {
  assert.deepEqual(brief(context).icpCriteria.fundingStages, ["Any"]);
  const c = structuredClone(context);
  c.icpCriteria.companyTypes = [];
  c.icpCriteria.customText = "Analytics vendors";
  c.targetPeople.roles = [];
  c.targetPeople.responsibilityDescription = "Customer learning";
  assert.ok(brief(c));
  delete c.outreachGoal;
  assert.throws(() => brief(c));
});
test("discovery retains >3, canonicalizes domains, suppresses removal and freezes contacts once", async () => {
  const { app, store } = await setup();
  await assert.rejects(app.confirmCompanies());
  await app.confirmBrief(context);
  const candidates = Array.from({ length: 5 }, (_, i) => ({
    name: "Company " + i,
    domain: `https://www.c${i}.com`,
    fitReason: "fits",
    sources: [
      {
        url: `https://c${i}.com`,
        excerpt: "SaaS",
        checkedAt: new Date().toISOString(),
      },
    ],
  }));
  await app.addCompanies(candidates);
  await app.addCompanies(candidates);
  assert.equal((await store.read()).companies.length, 5);
  await app.removeCompany((await store.read()).companies[0].id);
  await app.addCompanies(candidates);
  assert.equal(
    (await store.read()).companies.filter((c) => c.listStatus !== "deleted")
      .length,
    4,
  );
  const ids = await app.confirmCompanies();
  assert.equal(ids.length, 3);
  await store.transact((s) => s.companies.reverse());
  assert.deepEqual(await app.confirmCompanies(), ids);
});
test("event rank ignores unknown, future, expired, duplicate and contacted events; snooze expires", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const state = {
    companies: [
      { id: "a", fitRank: 0 },
      { id: "b", fitRank: 1 },
    ],
    events: [
      {
        id: "e",
        companyId: "b",
        matchesCriteria: true,
        occurredAt: "2026-10-10",
        priority: 3,
        status: "new",
        dedupeKey: "x",
      },
    ],
  };
  assert.equal(rankCompanies(state, now)[0].id, "b");
  for (const date of [null, "2025-01-01", "2027-01-01"]) {
    state.events[0].occurredAt = date;
    assert.equal(rankCompanies(state, now)[0].id, "a");
  }
  state.events[0].occurredAt = "2026-10-10";
  state.events[0].status = "contacted";
  assert.equal(rankCompanies(state, now)[0].id, "a");
  state.events[0].status = "snoozed";
  state.events[0].snoozedUntil = "2026-10-12";
  assert.equal(rankCompanies(state, now)[0].id, "a");
  state.events[0].snoozedUntil = "2026-10-10";
  assert.equal(rankCompanies(state, now)[0].id, "b");
  state.events.push({ ...state.events[0] });
  assert.equal(rankCompanies(state, now).length, 2);
});
test("editing a sent draft preserves immutable sentText and saved reply", async () => {
  const { app, store } = await setup();
  await store.transact((s) => {
    s.companies = [{ id: "c" }];
    s.people = [{ id: "p", companyId: "c" }];
    s.outreach = [
      {
        id: "o",
        companyId: "c",
        personId: "p",
        draft: "first",
        status: "draft",
      },
    ];
  });
  await app.updateOutreach("o", { action: "sent" });
  await app.updateOutreach("o", { draft: "changed" });
  await app.updateOutreach("o", { action: "sent" });
  await app.updateOutreach("o", { replySummary: "Interested" });
  const o = (await store.read()).outreach[0];
  assert.equal(o.sentText, "first");
  assert.equal(o.draft, "changed");
  assert.equal(o.status, "replied");
});
test("contact records deduplicate but retain multiple people in company", async () => {
  const { app, store } = await setup();
  await store.transact((s) => {
    s.workspace = { demoContactCompanyIds: ["c"] };
    s.companies = [{ id: "c", listStatus: "confirmed" }];
  });
  await app.addPeople("c", [
    { name: "A", title: "Founder", sources: [{ url: "https://example.com" }] },
    { name: "B", title: "CS", sources: [{ url: "https://example.com" }] },
    { name: "A", title: "Founder", sources: [{ url: "https://example.com" }] },
  ]);
  assert.equal((await store.read()).people.length, 2);
  await app.removeCompany("c");
  await app.addPeople("c", [{ name: "C", sources: [] }]);
  assert.equal((await store.read()).people.length, 2);
});
