import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
export const initialState = () => ({
  schemaVersion: 1,
  workspace: null,
  onboardingDraft: null,
  companies: [],
  people: [],
  events: [],
  outreach: [],
  searchRuns: [],
  jobs: [],
  providerCalls: [],
  suppressedDomains: [],
  schedules: {
    weekly: { enabled: true, nextRunAt: null },
    daily: { enabled: true, nextRunAt: null },
  },
  lastSuccessfulCheckAt: null,
});
export class Store {
  constructor(path) {
    this.path = path;
    this.queue = Promise.resolve();
  }
  async init() {
    await mkdir(dirname(this.path), { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.path, "utf8"));
      if (this.state.schemaVersion !== 1)
        throw Error("Unsupported state version");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      this.state = initialState();
      await this.write(this.state);
    }
    return this;
  }
  async write(state) {
    const p = this.path + ".tmp";
    await writeFile(p, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(p, this.path);
  }
  async read() {
    await this.queue;
    return structuredClone(this.state);
  }
  transact(fn) {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      await fn(next);
      await this.write(next);
      this.state = next;
      return structuredClone(next);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
