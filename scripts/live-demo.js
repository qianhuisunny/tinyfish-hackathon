// Exercises the same HTTP API as the UI. All research goes to live TinyFish.
// Run with a fresh DATA_PATH server when you need a clean demo.
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.APP_URL || "http://127.0.0.1:4317";
async function api(path, body) {
  const r = await fetch(
    base + "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const v = await r.json();
  if (!r.ok) throw Error(v.error);
  return v;
}
async function wait(job) {
  let last = "";
  for (let n = 0; n < 480; n++) {
    const s = await api("state"),
      j = s.jobs.find((x) => x.id === job.id);
    if (j.message !== last) {
      console.log(j.type, j.status, j.message);
      last = j.message;
    }
    if (j.status === "failed") throw Error(j.message);
    if (["completed", "partial"].includes(j.status)) return s;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw Error("Research still running; resume in UI");
}
async function waitForTarget() {
  for (let i = 0; i < 480; i++) {
    const s = await api("state");
    if (s.companies.some((c) => c.domain === "posthog.com")) return s;
    const job = s.jobs.filter((j) => j.type === "discover").at(-1);
    if (job && !["queued", "running"].includes(job.status)) return s;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw Error("Target research still pending");
}
let s = await api("state");
if (!s.workspace) {
  await wait(
    await api("jobs", {
      type: "analyze",
      input: {
        url: "https://product-gym-demo.qianhuisun.chatgpt.site/#the-gym",
        pastedDescription:
          "Product Gym is a concept being validated: codebase-informed hands-on practice environments where customers learn to use software by doing, with behavioral telemetry to reveal which workflows they master or struggle with.",
      },
    }),
  );
  s = await api("state");
  const context = {
    ...s.onboardingDraft,
    productName: "Product Gym",
    icpCriteria: {
      companyTypes: ["Developer tools"],
      fundingStages: ["Any"],
      shippingPreference: "Preferred",
      customText:
        "B2B open-source product analytics software platforms, for example PostHog and comparable companies. Exclude agencies and consulting businesses.",
    },
    targetPeople: {
      roles: ["Founder / CEO", "Product Marketing", "Customer Success"],
      responsibilityDescription:
        "People responsible for helping customers understand, adopt and use a complex software product.",
    },
    outreachGoal: {
      purpose: "Customer interviews",
      callToAction:
        "Would you be open to a 15-minute conversation about how customers learn newly released features?",
    },
    messageStyle: {
      tone: "Short and direct",
      language: "English",
      notes:
        "Be clear that this is an idea being validated, not a finished product.",
    },
  };
  await api("confirm-brief", context);
  s = await waitForTarget();
}
if (!s.companies.length) s = await waitForTarget();
if (!s.companies.length)
  throw Error("No verified companies; inspect discovery coverage gaps");
if (!s.workspace.listConfirmedAt) {
  const c = await api("confirm-companies", {});
  s = await wait(c.job);
} else if (
  s.jobs.some(
    (j) => j.type === "contacts" && ["queued", "running"].includes(j.status),
  )
) {
  s = await wait(
    s.jobs.find(
      (j) => j.type === "contacts" && ["queued", "running"].includes(j.status),
    ),
  );
}
if (!s.people.length)
  throw Error("No verified contacts; inspect research gaps");
const target =
  s.companies.find((c) => c.domain === "posthog.com") ||
  s.companies.find((c) => s.people.some((p) => p.companyId === c.id));
const person = s.people.find((p) => p.companyId === target.id);
if (!person) throw Error("Selected target has no verified contact");
const draft = await api("draft", { personId: person.id });
console.log(
  "Verified target:",
  target.name,
  "Contact:",
  person.name,
  "Draft:",
  draft.id,
);
// Monitoring is a separate recurring stage; exercise it for the same confirmed list.
s = await wait(await api("jobs", { type: "monitor" }));
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/live-run.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      product: s.workspace.productUrl,
      target: {
        name: target.name,
        domain: target.domain,
        sources: target.sources,
      },
      contact: {
        name: person.name,
        title: person.title,
        sources: person.sources,
      },
      draft: draft.draft,
      primitives: s.providerCalls,
      coverage: s.jobs.map((j) => ({
        type: j.type,
        status: j.status,
        message: j.message,
        queriesCompleted: j.queriesCompleted,
        coverageGaps: j.coverageGaps,
        agentRuns: j.agentRuns,
      })),
      events: s.events.filter((e) => e.companyId === target.id),
    },
    null,
    2,
  ),
);
console.log(
  "Live proof saved to docs/evidence/live-run.json; no messages sent.",
);
