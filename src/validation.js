import { getDomain } from "tldts";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export function domain(url) {
  const host = new URL(url.includes("://") ? url : "https://" + url).hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  return getDomain(host, { allowPrivateDomains: true }) || host;
}

function privateIP(a) {
  if (a.includes(":")) return !/^2[0-9a-f]{3}:/i.test(a);
  const [x, y] = a.split(".").map(Number);
  return (
    x === 0 ||
    x === 10 ||
    x === 127 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    (x === 100 && y >= 64 && y <= 127) ||
    x >= 224 ||
    (x === 198 && (y === 18 || y === 19))
  );
}
export async function publicUrl(value) {
  const u = new URL(value);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port)) ||
    (!host.includes(".") && !host.includes(":")) ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  )
    throw Error("Use a public http(s) URL");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((x) => privateIP(x.address)))
    throw Error("Private network URLs are not allowed");
  return u.href;
}
export function text(v, max = 12000) {
  if (typeof v !== "string" || v.length > max) throw Error("Invalid text");
  return v.trim();
}
export function brief(v) {
  if (!v || typeof v !== "object") throw Error("Invalid brief");
  const b = structuredClone(v);
  for (const k of ["productUrl", "productName", "productDescription"])
    b[k] = text(b[k] || "", 12000);
  if (!b.productDescription) throw Error("Product description is required");
  for (const [o, k] of [
    ["icpCriteria", "companyTypes"],
    ["icpCriteria", "fundingStages"],
    ["targetPeople", "roles"],
  ]) {
    if (!Array.isArray(b[o]?.[k]) || b[o][k].length > 20)
      throw Error("Invalid criteria");
    b[o][k] = b[o][k].map((x) => text(x, 120));
  }
  if (b.icpCriteria.fundingStages.includes("Any"))
    b.icpCriteria.fundingStages = ["Any"];
  if (!b.icpCriteria.companyTypes.length && !b.icpCriteria.customText?.trim())
    throw Error("Describe your ICP");
  if (
    !b.targetPeople.roles.length &&
    !b.targetPeople.responsibilityDescription?.trim()
  )
    throw Error("Describe target people");
  if (
    !["Required", "Preferred", "Any"].includes(b.icpCriteria.shippingPreference)
  )
    throw Error("Invalid release preference");
  if (!b.outreachGoal?.purpose || !b.outreachGoal?.callToAction)
    throw Error("Outreach purpose and next step required");
  return b;
}
export function jsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected a JSON object");
  return value;
}

export function validateResearch(kind, value) {
  jsonObject(value);
  if (kind === "product") {
    for (const k of [
      "productName",
      "productDescription",
      "responsibilityDescription",
      "callToAction",
    ])
      text(value[k]);
    for (const k of ["companyTypes", "roles"])
      if (
        !Array.isArray(value[k]) ||
        value[k].some((x) => typeof x !== "string")
      )
        throw Error("Malformed product suggestions");
    return value;
  }
  const field = {
    companies: "companies",
    contacts: "people",
    events: "events",
  }[kind];
  if (!field || !Array.isArray(value[field]))
    throw Error("Malformed browser research: expected " + field + " array");
  if (value[field].length > 200)
    throw Error("Browser result exceeds record budget");
  for (const item of value[field]) {
    jsonObject(item);
    const keys =
      kind === "companies"
        ? ["name", "domain", "fitReason", "sourceUrl", "evidence"]
        : kind === "contacts"
          ? ["name", "title", "sourceUrl", "evidence"]
          : ["type", "summary", "sourceUrl", "evidence"];
    for (const k of keys)
      if (
        typeof item[k] !== "string" ||
        !item[k].trim() ||
        item[k].length > 12000
      )
        throw Error("Malformed browser field: " + k);
    if (
      kind === "events" &&
      item.occurredAt !== null &&
      (!/^\d{4}-\d{2}-\d{2}/.test(item.occurredAt) ||
        !Number.isFinite(Date.parse(item.occurredAt)))
    )
      throw Error("Event date must be ISO or null");
  }
  if (
    value.coverageGaps !== undefined &&
    (!Array.isArray(value.coverageGaps) ||
      value.coverageGaps.some((x) => typeof x !== "string"))
  )
    throw Error("Malformed coverage gaps");
  return value;
}

export function companyOwnedEvidence(company){
  try{return domain(company.domain)===domain(company.sourceUrl)}catch{return false}
}
