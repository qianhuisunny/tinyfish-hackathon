import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createAppServer } from "../src/server.js";
test("HTTP state omits secrets and cross-origin mutations are rejected", async (t) => {
  const { server } = await createAppServer({
    dataPath: (await mkdtemp(tmpdir() + "/http-test-")) + "/state.json",
    recover: false,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = "http://127.0.0.1:" + server.address().port;
  const state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.schemaVersion, 1);
  assert.equal(JSON.stringify(state).includes("API_KEY"), false);
  const res = await fetch(base + "/api/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ type: "discover" }),
  });
  assert.equal(res.status, 403);
  const bad = await fetch(base + "/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "wrong" }),
  });
  assert.equal(bad.status, 400);
});
