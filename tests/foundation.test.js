import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Store } from "../src/store.js";
import { publicUrl, domain } from "../src/validation.js";
import { TinyFish } from "../src/providers/tinyfish.js";

test("failed and concurrent transactions preserve committed notes", async () => {
  const dir = await mkdtemp(tmpdir() + "/growth-test-");
  const s = new Store(dir + "/state.json");
  await s.init();
  await s.transact((x) => {
    x.notes = ["first"];
  });
  await assert.rejects(
    s.transact((x) => {
      x.notes.push("bad");
      throw Error("rollback");
    }),
  );
  await Promise.all([
    s.transact((x) => x.notes.push("second")),
    s.transact((x) => x.notes.push("third")),
  ]);
  assert.deepEqual((await s.read()).notes, ["first", "second", "third"]);
  assert.deepEqual(
    JSON.parse(await readFile(dir + "/state.json", "utf8")).notes,
    ["first", "second", "third"],
  );
});
test("rejects private, credentialed and non-http target URLs", async () => {
  for (const u of [
    "http://127.0.0.1",
    "http://[::1]",
    "http://169.254.169.254/latest",
    "http://10.2.1.1",
    "http://localhost",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "http://2130706433",
  ])
    await assert.rejects(publicUrl(u));
  assert.equal(domain("https://www.Example.com/a"), "example.com");
});
test("Fetch retains partial HTTP 200 errors", async () => {
  const t = new TinyFish({
    key: "test",
    fetcher: async () =>
      new Response(
        JSON.stringify({
          results: [{ url: "https://example.com", text: "ok" }],
          errors: [{ url: "https://other.test", error: "denied" }],
        }),
      ),
  });
  const r = await t.fetchPages(["https://9.9.9.9"]);
  assert.equal(r.results.length, 1);
  assert.equal(r.errors.length, 1);
});
test("rate limits have bounded retries and failed Agent runs stay failures", async () => {
  let n = 0;
  const t = new TinyFish({
    key: "test",
    sleep: async () => {},
    fetcher: async () => {
      n++;
      return new Response("{}", { status: 429 });
    },
  });
  await assert.rejects(t.search({ query: "example" }));
  assert.equal(n, 3);
  const f = new TinyFish({
    key: "test",
    fetcher: async () =>
      new Response(JSON.stringify({ status: "FAILED", error: "blocked" })),
  });
  await assert.rejects(f.waitAgent("test-id"), /FAILED/);
});

test("provider boundary rejects private Fetch and Agent targets before network calls", async () => {
  const t = new TinyFish({
    key: "test",
    fetcher: async () => {
      throw Error("Network should not be reached");
    },
  });
  await assert.rejects(
    t.fetchPages(["http://127.0.0.1/admin"]),
    /Private network|public/,
  );
  await assert.rejects(
    t.startAgent({ url: "http://10.0.0.1", goal: "read" }),
    /Private network|public/,
  );
});
