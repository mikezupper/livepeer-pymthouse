/**
 * NaaP pipeline catalog and pricing client.
 *
 * Provides cached access to two NaaP endpoints:
 *  - /v1/dashboard/pipeline-catalog  → pipeline list with models
 *  - /v1/dashboard/pricing           → per-orchestrator pricing rows
 *
 * Pricing rows are used at signing time to validate that the signed ticket
 * price matches the advertised price for the claimed pipeline/model/orchestrator.
 */

const NAAP_API_BASE_URL =
  process.env.NAAP_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://naap-api.cloudspe.com/v1";

const REQUEST_TIMEOUT_MS = 3000;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PipelineCatalogEntry {
  id: string;
  name: string;
  models: string[];
  regions?: string[];
}

export interface PricingRow {
  orchAddress: string;
  orchName?: string;
  pipeline: string;
  model: string;
  /** Wei per pricing unit as a bigint-compatible string. */
  priceWeiPerUnit: string;
  /** Pixels per pricing unit as a bigint-compatible string. */
  pixelsPerUnit: string;
  isWarm?: boolean;
}

// ─── In-memory TTL caches ────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CATALOG_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PRICING_TTL_MS = 60 * 1000; // 1 minute (pricing can change more rapidly)

let catalogCache: CacheEntry<PipelineCatalogEntry[]> | null = null;
let pricingCache: CacheEntry<PricingRow[]> | null = null;

// ─── Validation ──────────────────────────────────────────────────────────────

function parseCatalogEntry(raw: unknown, index: number): PipelineCatalogEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : null;
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : null;
  if (!id || !name) return null;
  const models = Array.isArray(r.models)
    ? (r.models as unknown[]).filter((m): m is string => typeof m === "string" && m.trim() !== "")
    : [];
  const regions = Array.isArray(r.regions)
    ? (r.regions as unknown[]).filter((m): m is string => typeof m === "string")
    : undefined;
  return { id, name, models, regions };
}

function parsePricingRow(raw: unknown): PricingRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const orchAddress = typeof r.orchAddress === "string" ? r.orchAddress.trim() : "";
  const pipeline = typeof r.pipeline === "string" ? r.pipeline.trim() : "";
  const model = typeof r.model === "string" ? r.model.trim() : "";
  if (!orchAddress || !pipeline || !model) return null;

  const rawPrice = r.priceWeiPerUnit ?? r.price_wei_per_unit;
  const rawPixels = r.pixelsPerUnit ?? r.pixels_per_unit;

  const priceWeiPerUnit =
    typeof rawPrice === "string" || typeof rawPrice === "number"
      ? String(rawPrice).trim()
      : null;
  const pixelsPerUnit =
    typeof rawPixels === "string" || typeof rawPixels === "number"
      ? String(rawPixels).trim()
      : null;

  if (!priceWeiPerUnit || !pixelsPerUnit) return null;

  // Validate that both values are positive BigInt-compatible integers
  try {
    const price = BigInt(priceWeiPerUnit);
    const pixels = BigInt(pixelsPerUnit);
    if (price <= 0n || pixels <= 0n) return null;
  } catch {
    return null;
  }

  return {
    orchAddress,
    orchName: typeof r.orchName === "string" ? r.orchName : undefined,
    pipeline,
    model,
    priceWeiPerUnit,
    pixelsPerUnit,
    isWarm: typeof r.isWarm === "boolean" ? r.isWarm : undefined,
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function naapGet(path: string): Promise<unknown> {
  const url = `${NAAP_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`NaaP API ${path} returned ${res.status}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch (and cache) the NaaP pipeline catalog. */
export async function fetchPipelineCatalog(): Promise<PipelineCatalogEntry[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.data;
  }
  const raw = await naapGet("/dashboard/pipeline-catalog");
  if (!Array.isArray(raw)) {
    throw new Error("NaaP pipeline-catalog response is not an array");
  }
  const entries: PipelineCatalogEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = parseCatalogEntry(raw[i], i);
    if (entry) entries.push(entry);
  }
  catalogCache = { data: entries, expiresAt: Date.now() + CATALOG_TTL_MS };
  return entries;
}

/**
 * In-memory pricing snapshot only (no network). Used on hot paths such as
 * `generate-live-payment` so signing never waits on NaaP.
 */
export function getCachedDashboardPricing(): PricingRow[] | null {
  if (pricingCache && pricingCache.expiresAt > Date.now()) {
    return pricingCache.data;
  }
  return null;
}

/**
 * Refresh pricing from NaaP and update the in-memory cache. Call from non-hot
 * paths (e.g. `GET /api/v1/pipeline-pricing`) or tests that need a primed cache.
 */
export async function refreshDashboardPricing(): Promise<PricingRow[]> {
  const raw = await naapGet("/dashboard/pricing");
  if (!Array.isArray(raw)) {
    throw new Error("NaaP pricing response is not an array");
  }
  const rows: PricingRow[] = [];
  for (const item of raw) {
    const row = parsePricingRow(item);
    if (row) rows.push(row);
  }
  pricingCache = { data: rows, expiresAt: Date.now() + PRICING_TTL_MS };
  return rows;
}

/** Fetch (and cache) NaaP per-orchestrator pricing rows — cache read, else network refresh. */
export async function fetchDashboardPricing(): Promise<PricingRow[]> {
  const cached = getCachedDashboardPricing();
  if (cached !== null) {
    return cached;
  }
  return refreshDashboardPricing();
}

/** Invalidate in-memory caches (useful for tests). */
export function invalidateNaapCaches(): void {
  catalogCache = null;
  pricingCache = null;
}

/**
 * Find pricing rows that match a pipeline/model, optionally filtered to a
 * specific orchestrator address.  Returns only valid rows.
 */
export function filterPricingRows(
  rows: PricingRow[],
  pipeline: string,
  model: string,
  orchAddress?: string,
): PricingRow[] {
  return rows.filter((r) => {
    if (r.pipeline !== pipeline || r.model !== model) return false;
    if (orchAddress && r.orchAddress.toLowerCase() !== orchAddress.toLowerCase()) return false;
    return true;
  });
}
