const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state = null,
  activeGroup = 0,
  currentCompany = null,
  toastTimer,
  analysisJob = null,
  lastSignature = "",
  scrollPosition = 0;
async function api(path, body) {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
function toast(s) {
  $("toast").textContent = s;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.display = "none"), 4500);
}
function page(stage) {
  document.body.dataset.stage = stage;
  for (const [id, s] of [
    ["landing", "landing"],
    ["analyzing", "analyzing"],
    ["onboarding", "brief"],
    ["workspace", "workspace"],
  ])
    $(id).classList.toggle("hide", stage !== s);
  $("headerProduct").classList.toggle("hide", stage === "landing");
  $("headerProduct").textContent =
    "/ " +
    (state?.workspace?.productName ||
      state?.onboardingDraft?.productName ||
      "Your product");
}
function selected(field) {
  return [
    ...document.querySelectorAll(`[data-field="${field}"] .selected`),
  ].map((b) => b.textContent);
}
function bindChips() {
  document.querySelectorAll(".chip").forEach((b) => {
    b.setAttribute("aria-pressed", b.classList.contains("selected"));
    b.onclick = () => {
      const g = b.parentNode;
      if (g.dataset.mode === "single") {
        g.querySelectorAll(".chip").forEach((x) =>
          x.classList.remove("selected"),
        );
        b.classList.add("selected");
      } else {
        b.classList.toggle("selected");
        if (b.textContent === "Any" && b.classList.contains("selected"))
          g.querySelectorAll(".chip").forEach((x) => {
            if (x !== b) x.classList.remove("selected");
          });
        else if (b.classList.contains("selected"))
          g.querySelectorAll(".chip").forEach((x) => {
            if (x.textContent === "Any") x.classList.remove("selected");
          });
      }
      g.querySelectorAll(".chip").forEach((x) =>
        x.setAttribute("aria-pressed", x.classList.contains("selected")),
      );
      saveBriefSoon();
    };
  });
}
function setChips(field, values) {
  const g = document.querySelector(`[data-field="${field}"]`);
  for (const v of values || []) {
    if (![...g.children].some((b) => b.textContent === v)) {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = v;
      g.append(b);
    }
  }
  g.querySelectorAll(".chip").forEach((b) =>
    b.classList.toggle("selected", (values || []).includes(b.textContent)),
  );
  bindChips();
}
function captureContext() {
  return {
    productUrl: $("productUrl").value,
    productName: $("summaryProductName").textContent,
    productDescription: $("productDescription").value,
    icpCriteria: {
      companyTypes: selected("types"),
      fundingStages: selected("stages"),
      shippingPreference: selected("shipping")[0] || "Preferred",
      customText: $("icpText").value,
    },
    outreachGoal: {
      purpose: selected("purpose")[0],
      callToAction: $("cta").value,
    },
    messageStyle: {
      tone: $("tone").value,
      language: $("language").value,
      notes: $("messageNotes").value,
    },
    targetPeople: {
      roles: selected("roles"),
      responsibilityDescription: $("responsibility").value,
    },
  };
}
let saveTimer;
function saveBriefSoon() {
  if (document.body.dataset.stage !== "brief" || state?.workspace) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => api("save-brief", captureContext()).catch((e) => toast(e.message)),
    700,
  );
}
function fillBrief(b) {
  $("productUrl").value = b.productUrl;
  $("productDescription").value = b.productDescription;
  $("summaryProductName").textContent = b.productName;
  $("productReadSummary").textContent = b.productDescription;
  $("summaryBadge").textContent = "Suggestions · Review before confirming";
  setChips("types", b.icpCriteria.companyTypes);
  setChips("stages", b.icpCriteria.fundingStages);
  setChips("shipping", [b.icpCriteria.shippingPreference]);
  setChips("roles", b.targetPeople.roles);
  setChips("purpose", [b.outreachGoal.purpose]);
  $("icpText").value = b.icpCriteria.customText || "";
  $("responsibility").value = b.targetPeople.responsibilityDescription || "";
  $("cta").value = b.outreachGoal.callToAction;
  $("tone").value = b.messageStyle.tone;
  $("language").value = b.messageStyle.language;
  $("messageNotes").value = b.messageStyle.notes || "";
  page("brief");
  showGroup(0);
}
function useDemo() {
  $("entryUrl").value =
    "https://product-gym-demo.qianhuisun.chatgpt.site/#the-gym";
  $("manualDescription").value =
    "Product Gym is a concept being validated: codebase-informed hands-on practice environments where customers learn to use a software product by doing, with behavioral telemetry that helps teams understand which workflows people master or struggle with.";
  $("entryUrl").focus();
}
function showOnboarding() {
  if (state?.workspace) {
    renderList();
    toast(
      "This workspace already has confirmed criteria. Start with a new DATA_PATH for another product.",
    );
    return;
  }
  closeDrawer();
  page("landing");
}
async function analyzeProduct(pastedDescription) {
  try {
    new URL($("entryUrl").value);
    $("urlError").textContent = "";
    const j = await api("jobs", {
      type: "analyze",
      input: {
        url: $("entryUrl").value,
        pastedDescription:
          typeof pastedDescription === "string" ? pastedDescription : undefined,
      },
    });
    analysisJob = j.id;
    $("analyzingUrl").textContent = $("entryUrl").value;
    page("analyzing");
    await refresh();
  } catch (e) {
    $("urlError").textContent = e.message;
  }
}
function continueManual() {
  const d = $("manualDescription").value.trim();
  if (!d) {
    $("urlError").textContent = "Add a product description first.";
    return;
  }
  analyzeProduct(d);
}
function showGroup(n) {
  if (n < 0 || n > 2) return;
  activeGroup = n;
  document
    .querySelectorAll("#onboarding .group")
    .forEach((g, i) => g.classList.toggle("active-group", i === n));
  [0, 1, 2].forEach((i) => {
    const b = $("groupNav" + i);
    if (i === n) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
  $("previousGroup").classList.toggle("hide", n === 0);
  $("nextGroup").classList.toggle("hide", n === 2);
  $("discoverButton").classList.toggle("hide", n !== 2);
  $("nextGroup").textContent =
    n === 0 ? "Next: Outreach goal →" : "Next: People to reach →";
  $("stepNote").textContent =
    n +
    1 +
    " / 3 · " +
    ["Ideal customers", "Outreach goal", "People to reach"][n];
  $("finalReview").classList.toggle("hide", n !== 2);
  $("finalReview").textContent =
    "Company criteria: " +
    (selected("types").join(" / ") || $("icpText").value) +
    ". Additional restrictions: " +
    ($("icpText").value || "None") +
    ". Contact research starts after company-list confirmation.";
  saveBriefSoon();
}
async function discover() {
  clearTimeout(saveTimer);
  $("discoverButton").disabled = true;
  try {
    await api("confirm-brief", captureContext());
    await refresh();
    renderList();
  } catch (e) {
    $("formError").textContent = e.message;
  } finally {
    $("discoverButton").disabled = false;
  }
}
function relative(at) {
  if (!at) return "Not checked yet";
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(at)) / 60000));
  return mins < 1
    ? "Checked just now"
    : mins < 60
      ? `Checked ${mins} min ago`
      : mins < 1440
        ? `Checked ${Math.floor(mins / 60)}h ago`
        : `Checked ${Math.floor(mins / 1440)}d ago`;
}
function jobsHtml() {
  return state.jobs
    .slice(-4)
    .reverse()
    .map(
      (j) =>
        `<div class="job-card ${j.status === "failed" ? "error" : ""}"><strong>${esc(j.type)} · ${esc(j.status)}</strong> — ${esc(j.message)}${j.status === "running" ? '<span class="loader"> ◌</span>' : ""}<details><summary>Research coverage and execution evidence</summary><p>${j.queriesCompleted.length} search pages completed · ${Object.keys(j.agentRuns).length} browser runs</p>${j.queriesCompleted.map((q) => `<div>${esc(q.query)} · page ${q.page + 1} · ${q.count} results</div>`).join("")}${j.coverageGaps.map((g) => `<p>Coverage gap: ${esc(g)}</p>`).join("")}${Object.entries(
          j.agentRuns,
        )
          .map(([k, v]) => `<div>${esc(k)} · ${esc(v)}</div>`)
          .join("")}</details></div>`,
    )
    .join("");
}
function status(c) {
  const os = state.outreach.filter((o) => o.companyId === c.id);
  return os.some((o) => o.status === "replied")
    ? "Replied"
    : os.some((o) => o.sentAt)
      ? "Contacted"
      : os.length
        ? "Draft ready"
        : "Not contacted";
}
function renderList() {
  if (!state?.workspace) return;
  currentCompany = null;
  page("workspace");
  closeEventCriteria();
  const w = state.workspace,
    cs = state.companies;
  $("workspace").innerHTML =
    `<div class="page-heading"><div><div class="eyebrow">YOUR OUTREACH WORKSPACE</div><h1>Find your next conversation.</h1><div class="status"><span class="dot"></span>Live research · ${relative(state.lastSuccessfulCheckAt)} <button class="quiet small" onclick="openSchedule()">Schedule ↗</button></div></div><span class="pill">${esc(w.productName)}</span></div><div class="tabbar"><span class="active-tab">ICP</span></div><div class="toolbar"><div class="criteria"><button class="criteria-trigger" onclick="openIcpCriteria()">Match criteria ↗</button>${esc(w.icpCriteria.companyTypes.join(" / "))} · ${esc(w.icpCriteria.fundingStages.join(" / "))}</div><span class="muted">Relevant events first ↓</span></div><div class="live-tools"><button onclick="startJob('discover')">Discover more companies</button><button onclick="startJob('monitor')" ${!w.listConfirmedAt ? "disabled" : ""}>Check events now</button>${w.listConfirmedAt ? "<button onclick=\"startJob('contacts')\">Refresh contact research</button>" : ""}</div>${cs.some((c) => c.listStatus === "new") ? `<div class="banner"><div><strong>Confirm companies, then find people</strong><p>Remove companies that do not fit. Demo contact research is fixed to the first three companies at your initial confirmation.</p></div><button class="primary small" onclick="confirmList()">Confirm list and find contacts →</button></div>` : ""}${w.listConfirmedAt ? `<p class="muted">Contact research scope: ${w.demoContactCompanyIds.map((id) => esc(cs.find((c) => c.id === id)?.name || "Removed company")).join(", ")}. Events change priority, not this scope.</p>` : ""}<div id="jobs">${jobsHtml()}</div><div class="table-wrap" id="icpTable"><table><thead><tr><th>#</th><th>Company / product</th><th>Why it fits</th><th><div class="event-heading">Latest matching event <button class="event-info" onclick="openEventCriteria(event)" aria-label="View event criteria">i</button></div><span class="event-refresh">${relative(state.lastSuccessfulCheckAt)}</span></th><th>Event date</th><th>Priority reason</th><th>Contacts / research</th><th>Outreach status</th><th>Sources</th><th></th></tr></thead><tbody>${cs.map((c, i) => `<tr oncontextmenu="openMenu(event,'${c.id}')"><td>${i + 1}</td><td><strong>${esc(c.name)}</strong><div class="secondary">${esc(c.stage || "Stage unverified")}</div><div class="secondary">${esc(c.domain)}</div>${c.listStatus === "new" ? '<span class="pill">New</span>' : ""}</td><td class="fit">${esc(c.fitReason)}</td><td>${c.latestEvent ? `<button class="source" onclick="openEvent('${c.latestEvent.id}')">${esc(c.latestEvent.summary)} ↗</button>` : "—"}<span class="event-refresh">${relative(c.lastSuccessfulCheckAt)}</span></td><td>${esc(c.latestEvent?.occurredAt?.slice(0, 10) || "—")}</td><td class="reason">${esc(c.latestEvent?.relevanceReason || "Original ICP fit")}</td><td>${w.demoContactCompanyIds.includes(c.id) ? `<button class="source" onclick="openCompany('${c.id}')">${state.people.filter((p) => p.companyId === c.id).length} contacts ↗</button><div class="secondary">${c.contactsResearchedAt ? "Researched" : "Research pending"}</div>` : "Not researched"}</td><td><span class="pill">${status(c)}</span></td><td><button class="source" onclick="openEvidence('${c.id}')">View ↗</button></td><td><button class="quiet" aria-label="${esc(c.name)} actions" onclick="openMenu(event,'${c.id}')">⋯</button></td></tr>`).join("")}</tbody></table>${!cs.length ? '<div class="empty">No verified companies yet. Research progress and any coverage gaps appear above.</div>' : ""}</div><div class="table-foot"><span>${cs.length} companies · Right-click or use ⋯ to Drill Through</span><span>Removed companies stay excluded</span></div>`;
  $("icpTable").scrollTop = scrollPosition;
}
async function startJob(type) {
  try {
    await api("jobs", { type });
    await refresh();
    toast("Research queued; this page updates as results arrive.");
  } catch (e) {
    toast(e.message);
  }
}
async function confirmList() {
  try {
    await api("confirm-companies", {});
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}
function openMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  const m = $("menu");
  m.innerHTML = `<button onclick="openCompany('${id}')">↳ Drill Through → Contacts</button><button class="danger" onclick="removeCompany('${id}')">Remove from ICP list</button>`;
  m.style.left = Math.min(e.clientX, innerWidth - 245) + "px";
  m.style.top = Math.min(e.clientY, innerHeight - 115) + "px";
  m.style.display = "block";
}
async function removeCompany(id) {
  try {
    await api("remove-company", { id });
    $("menu").style.display = "none";
    await refresh();
    toast("Removed and excluded from future discovery.");
  } catch (e) {
    toast(e.message);
  }
}
function openCompany(id) {
  if (!currentCompany) scrollPosition = $("icpTable")?.scrollTop || 0;
  currentCompany = id;
  closeEventCriteria();
  $("menu").style.display = "none";
  page("workspace");
  const c = state.companies.find((x) => x.id === id);
  if (!c) return renderList();
  const ps = state.people.filter((p) => p.companyId === id);
  $("workspace").innerHTML =
    `<div class="breadcrumb"><button onclick="renderList()">← ICP</button><span>/ ${esc(c.name)} / Contacts</span></div><div class="company-summary"><div><div class="eyebrow">COMPANY CONTEXT</div><h1>${esc(c.name)}</h1><p>${esc(c.productSummary)}</p><button class="source" onclick="openEvidence('${id}')">Fit and sources ↗</button></div><span class="pill">ICP / Contacts</span></div><div class="tabbar"><span class="active-tab">ICP</span></div><div id="jobs">${jobsHtml()}</div><p>${ps.length} verified contacts · ${c.contactsResearchedAt ? "Public research completed; see coverage gaps" : "Research pending or outside the confirmed demo scope"}</p><div class="table-wrap"><table><thead><tr><th>Contact</th><th>Title</th><th>Why this person</th><th>Public channel</th><th>Status</th></tr></thead><tbody>${ps.map((p) => `<tr><td><button class="name-button" onclick="openPerson('${p.id}')">${esc(p.name)} ↗</button></td><td>${esc(p.title)}</td><td>${esc(p.responsibility)}</td><td>${link(p.contactUrl, "Public profile ↗")}</td><td>${esc(state.outreach.find((o) => o.personId === p.id)?.status || "Not contacted")}</td></tr>`).join("")}</tbody></table></div>${(c.contactCoverageGaps || []).map((g) => `<p class="muted">${esc(g)}</p>`).join("")}`;
}
function drawer(title, subtitle, body) {
  $("overlay").innerHTML =
    `<div class="scrim" onclick="closeDrawer()"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="drawer-head"><div><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p></div><button class="quiet" onclick="closeDrawer()" aria-label="Close panel">✕</button></div><div class="drawer-body">${body}</div></aside>`;
  $("overlay").querySelector("button").focus();
}
function closeDrawer() {
  $("overlay").innerHTML = "";
}
function closeEventCriteria() {
  $("eventInfo").innerHTML = "";
}
function link(url, label) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return "Unavailable";
    return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label || u.hostname)} ↗</a>`;
  } catch {
    return "Unavailable";
  }
}
function evidence(items) {
  return (items || [])
    .map(
      (s) =>
        `<div class="evidence">${link(s.url, s.url)}<p>${esc(s.excerpt)}</p><small>Verified ${esc(s.checkedAt || "during research")}</small></div>`,
    )
    .join("");
}
function openEvidence(id) {
  const c = state.companies.find((x) => x.id === id);
  drawer(
    c.name,
    "Company context and evidence",
    `<p>${esc(c.fitReason)}</p><p>${esc(c.painHypothesis)}</p>${evidence(c.sources)}<label class="field-label">Your company notes</label><textarea id="companyNote">${esc(c.notes)}</textarea><button onclick="saveNote('${id}','companyNote')">Save notes</button>`,
  );
}
async function saveNote(id, field) {
  try {
    await api("note", { id, notes: $(field).value });
    toast("Notes saved");
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}
async function openPerson(id) {
  const p = state.people.find((x) => x.id === id),
    c = state.companies.find((x) => x.id === p.companyId);
  const o = state.outreach.find((x) => x.personId === id);
  drawer(
    p.name,
    p.title + " · " + c.name,
    `<div class="drawer-section"><h3>Person and company context</h3><p>${esc(p.responsibility)}</p><p>${esc(c.painHypothesis)}</p>${evidence(p.sources)}<label class="field-label">Your notes</label><textarea id="personNote">${esc(p.notes)}</textarea><button onclick="saveNote('${id}','personNote')">Save notes</button></div><div class="drawer-section"><h3>Outreach draft</h3>${o ? `<p>${esc(o.composition)}</p><textarea id="messageDraft" rows="12">${esc(o.draft)}</textarea><div class="actions"><button onclick="saveDraft('${o.id}')">Save draft</button><button onclick="copyDraft()">Copy message</button><button class="primary" onclick="markSent('${o.id}','${id}')">Mark as contacted</button></div>` : `<button class="primary" onclick="makeDraft('${id}')">Compose a message</button>`}<p>Review and send yourself. This app never sends messages.</p></div><div class="drawer-section"><h3>Conversation history</h3>${o?.sentAt ? `<p>Marked contacted ${esc(new Date(o.sentAt).toLocaleString())}</p><details><summary>Saved sent message</summary><p style="white-space:pre-wrap">${esc(o.sentText)}</p></details>` : "<p>No interaction recorded.</p>"}${o ? `<label class="field-label">Record a reply</label><textarea id="replyText">${esc(o.replySummary)}</textarea><button onclick="saveReply('${o.id}','${id}')">Save reply</button>` : ""}</div>`,
  );
}
async function makeDraft(id) {
  try {
    await api("draft", { personId: id });
    await refresh();
    openPerson(id);
  } catch (e) {
    toast(e.message);
  }
}
async function saveDraft(id) {
  try {
    await api("outreach", { id, draft: $("messageDraft").value });
    await refresh();
    toast("Draft saved");
  } catch (e) {
    toast(e.message);
  }
}
async function copyDraft() {
  try {
    await navigator.clipboard.writeText($("messageDraft").value);
    toast("Copied");
  } catch {
    $("messageDraft").select();
    toast("Press ⌘C / Ctrl+C to copy.");
  }
}
async function markSent(id, pid) {
  try {
    await api("outreach", {
      id,
      draft: $("messageDraft").value,
      action: "sent",
    });
    await refresh();
    openPerson(pid);
    toast("Contacted status saved; nothing was sent by this app.");
  } catch (e) {
    toast(e.message);
  }
}
async function saveReply(id, pid) {
  try {
    await api("outreach", { id, replySummary: $("replyText").value });
    await refresh();
    openPerson(pid);
  } catch (e) {
    toast(e.message);
  }
}
function openIcpCriteria() {
  const c = state.workspace.icpCriteria;
  drawer(
    "ICP match criteria",
    "Confirmed · Read-only",
    `<dl class="criteria-detail"><dt>Company types</dt><dd>${esc(c.companyTypes.join(" / ") || "Free-text criteria")}</dd><dt>Stages</dt><dd>${esc(c.fundingStages.join(" / "))}</dd><dt>Fast release cadence</dt><dd>${esc(c.shippingPreference)}</dd><dt>Your original restrictions</dt><dd>${esc(c.customText || "None")}</dd></dl><p>Options within one field are OR. Different fields are AND. Preferred cadence affects fit ranking; required cadence affects membership.</p><p>Events change priority, never ICP membership.</p>`,
  );
}
function openEventCriteria(e) {
  e?.stopPropagation();
  drawer(
    "What updates are we watching?",
    "Event monitoring criteria",
    `<ul><li>Product launches and major features</li><li>Material changelog and workflow changes</li><li>New hires matching ${esc(state.workspace.targetPeople.roles.join(", "))}; open vacancies are not hires</li><li>Public funding announcements</li></ul><p>Responsibility criteria: ${esc(state.workspace.targetPeople.responsibilityDescription || "Selected roles")}</p><p>Lookback: 30 days · Daily while the app runs.</p><p>${relative(state.lastSuccessfulCheckAt)}. This is the successful check time, not when an event occurred.</p><p>Unknown dates and dismissed, contacted, or currently snoozed events do not raise priority.</p>`,
  );
}
function openEvent(id) {
  const e = state.events.find((x) => x.id === id);
  drawer(
    e.summary,
    "Occurred " + (e.occurredAt || "Unknown"),
    `<p>${esc(e.relevanceReason)}</p>${evidence(e.sources)}<div class="actions"><button onclick="eventStatus('${id}','dismissed')">Dismiss</button><button onclick="eventStatus('${id}','snoozed')">Snooze 7 days</button></div>`,
  );
}
async function eventStatus(id, status) {
  await api("event", { id, status });
  closeDrawer();
  await refresh();
}
function openSchedule() {
  drawer(
    "Discovery and monitoring",
    "Worker runs while this app is open on the server",
    `<label class="field-label">Weekly additions</label><select id="weekly"><option value="true" ${state.schedules.weekly.enabled ? "selected" : ""}>On</option><option value="false" ${!state.schedules.weekly.enabled ? "selected" : ""}>Paused</option></select><p>Next due: ${esc(new Date(state.schedules.weekly.nextRunAt).toLocaleString())}</p><label class="field-label">Daily event checks</label><select id="daily"><option value="true" ${state.schedules.daily.enabled ? "selected" : ""}>On</option><option value="false" ${!state.schedules.daily.enabled ? "selected" : ""}>Paused</option></select><p>Next due: ${esc(new Date(state.schedules.daily.nextRunAt).toLocaleString())}</p><p>Due times are persisted. After downtime, one overdue run is queued. This local app is not an always-on hosted service.</p><button class="primary" onclick="saveSchedule()">Save schedule</button>`,
  );
}
async function saveSchedule() {
  await api("schedule", {
    weekly: $("weekly").value === "true",
    daily: $("daily").value === "true",
  });
  closeDrawer();
  await refresh();
}
function openContext() {
  if (!state?.workspace) {
    toast("Confirm your product brief first.");
    return;
  }
  const w = state.workspace;
  drawer(
    "My product context",
    "Used for discovery and outreach",
    `<label class="field-label">Product description</label><textarea id="contextDescription" rows="6">${esc(w.productDescription)}</textarea><label class="field-label">Tone</label><input id="contextTone" value="${esc(w.messageStyle.tone)}"><label class="field-label">Language</label><input id="contextLanguage" value="${esc(w.messageStyle.language)}"><label class="field-label">Message preferences (for your review)</label><textarea id="contextStyleNotes">${esc(w.messageStyle.notes)}</textarea><label class="field-label">Your product notes</label><textarea id="contextNotes">${esc(w.productNotes)}</textarea><p>Generated drafts use an English evidence-grounded template. Use these preferences when editing a draft.</p><button class="primary" onclick="saveContext()">Save context</button>`,
  );
}
async function saveContext() {
  await api("product-context", {
    productDescription: $("contextDescription").value,
    tone: $("contextTone").value,
    language: $("contextLanguage").value,
    notes: $("contextStyleNotes").value,
    productNotes: $("contextNotes").value,
  });
  closeDrawer();
  await refresh();
  toast("Context saved");
}
async function refresh() {
  state = await api("state");
  const signature = JSON.stringify([
    state.companies,
    state.people,
    state.jobs.map((j) => [j.id, j.status, j.message, j.coverageGaps]),
    state.events,
    state.outreach,
    state.workspace,
  ]);
  if (analysisJob) {
    const j = state.jobs.find((j) => j.id === analysisJob);
    if (j && ["completed", "partial"].includes(j.status)) {
      analysisJob = null;
      fillBrief(state.onboardingDraft);
    } else if (j?.status === "failed") {
      analysisJob = null;
      page("landing");
      $("urlError").textContent = j.message;
      $("manualFallback").classList.remove("hide");
    } else if (j) {
      $("analyzing").querySelector(".loading-item.loader").textContent =
        "◌ " + j.message;
    }
  }
  if (
    state.workspace &&
    document.body.dataset.stage !== "brief" &&
    signature !== lastSignature
  ) {
    if (currentCompany) openCompany(currentCompany);
    else renderList();
  }
  lastSignature = signature;
}
document.addEventListener("click", () => {
  $("menu").style.display = "none";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    closeEventCriteria();
    $("menu").style.display = "none";
  }
});
document
  .querySelectorAll("#onboarding input,#onboarding textarea,#onboarding select")
  .forEach((el) => el.addEventListener("input", saveBriefSoon));
bindChips();
(async () => {
  try {
    await refresh();
    if (state.workspace) renderList();
    else if (state.onboardingDraft) fillBrief(state.onboardingDraft);
    else {
      const active = state.jobs.find(
        (j) => j.type === "analyze" && ["running", "queued"].includes(j.status),
      );
      if (active) {
        analysisJob = active.id;
        page("analyzing");
      }
    }
  } catch (e) {
    toast("Cannot connect to server: " + e.message);
  }
})();
setInterval(() => refresh().catch(() => {}), 2500);
