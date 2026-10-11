const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class TinyFish {
  constructor({
    key = process.env.TINYFISH_API_KEY,
    fetcher = fetch,
    sleep: pause = sleep,
    onCall = async () => {},
  } = {}) {
    this.key = key;
    this.fetcher = fetcher;
    this.pause = pause;
    this.onCall = onCall;
  }
  async request(primitive, url, body) {
    if (!this.key) throw Error("Configure server-side TINYFISH_API_KEY");
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await this.fetcher(url, {
        method: body ? "POST" : "GET",
        headers: { "X-API-Key": this.key, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000),
      });
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < 2) await this.pause(1000 * 2 ** attempt);
    }
    if (!response.ok)
      throw Error(`TinyFish ${primitive}: HTTP ${response.status}`);
    const data = await response.json();
    await this.onCall({
      primitive,
      checkedAt: new Date().toISOString(),
      status: data.status || (primitive === "Agent" && body ? "submitted" : "completed"),
      runId: data.run_id || null,
    });
    return data;
  }
  search(input) {
    const q = new URLSearchParams(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    return this.request("Search", "https://api.search.tinyfish.ai?" + q);
  }
  async fetchPages(urls, opts = {}) {
    if (urls.length > 10) throw Error("Fetch batch limit is 10");
    const r = await this.request("Fetch", "https://api.fetch.tinyfish.ai", {
      urls,
      format: "markdown",
      ...opts,
    });
    return { results: r.results || [], errors: r.errors || [] };
  }
  startAgent(input) {
    return this.request(
      "Agent",
      "https://agent.tinyfish.ai/v1/automation/run-async",
      input,
    );
  }
  getAgent(id) {
    return this.request(
      "Agent",
      "https://agent.tinyfish.ai/v1/runs/" + encodeURIComponent(id),
    );
  }
  async waitAgent(id, onProgress = async () => {}) {
    for (let n = 0; n < 120; n++) {
      const r = await this.getAgent(id);
      const status = r.status || r.run?.status;
      if (status === "COMPLETED")
        return r.result ?? r.resultJson ?? r.run?.result;
      if (["FAILED", "CANCELLED"].includes(status))
        throw Error("Agent " + status);
      await onProgress(r);
      await this.pause(5000);
    }
    throw Error("Agent still running; saved run ID can be resumed");
  }
  async agent(input, onStart = async () => {}) {
    const r = await this.startAgent(input);
    const id = r.run_id || r.id;
    if (!id) throw Error("Agent did not return a run ID");
    await onStart(id);
    return this.waitAgent(id);
  }
}
