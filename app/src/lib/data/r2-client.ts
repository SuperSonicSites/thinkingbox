import type { CellData, ISPEntry, PlansBundle } from "./types";

/**
 * Abstract data client for fetching pre-computed data.
 * Production: KV-first with R2 fallback.
 * Dev: filesystem fallback (reads from data/precomputed/).
 */
export interface DataClient {
  getCellData(geohash: string): Promise<CellData | null>;
  getISPsForHex(hexuid: string): Promise<ISPEntry[]>;
  getPlans(): Promise<PlansBundle>;
}

/** Cloudflare R2 Bucket binding shape. */
interface R2Bucket {
  get(key: string): Promise<{ json(): Promise<unknown> } | null>;
}

/** Cloudflare KV Namespace binding shape. */
interface KVNamespace {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** TTL values in seconds for KV cache entries. */
const KV_TTL = {
  cell: 3600,     // 1 hour
  isp: 21600,     // 6 hours
  plans: 86400,   // 24 hours
} as const;

interface R2KVEnv {
  DATA_BUCKET?: R2Bucket;
  LOOKUP_CACHE?: KVNamespace;
}

/**
 * Create a DataClient backed by Cloudflare R2 + KV.
 * KV is checked first (fast edge cache). On miss, falls back to R2
 * and populates KV for subsequent requests.
 */
export function createR2DataClient(env: R2KVEnv): DataClient {
  const bucket = env.DATA_BUCKET;
  const kv = env.LOOKUP_CACHE;

  async function fetchJSON<T>(
    kvKey: string,
    r2Key: string,
    ttl: number
  ): Promise<T | null> {
    // KV-first
    if (kv) {
      const cached = await kv.get(kvKey, { type: "json" });
      if (cached !== null) {
        return cached as T;
      }
    }

    // R2 fallback
    if (bucket) {
      const obj = await bucket.get(r2Key);
      if (obj) {
        const data = (await obj.json()) as T;
        // Write-through to KV
        if (kv) {
          await kv.put(kvKey, JSON.stringify(data), { expirationTtl: ttl }).catch(() => {
            // Swallow KV write errors — read path still works via R2
          });
        }
        return data;
      }
    }

    return null;
  }

  return {
    async getCellData(geohash: string): Promise<CellData | null> {
      return fetchJSON<CellData>(
        `cell:${geohash}`,
        `cells/${geohash}.json`,
        KV_TTL.cell
      );
    },

    async getISPsForHex(hexuid: string): Promise<ISPEntry[]> {
      const result = await fetchJSON<ISPEntry[]>(
        `isp:${hexuid}`,
        `isps/${hexuid}.json`,
        KV_TTL.isp
      );
      return result ?? [];
    },

    async getPlans(): Promise<PlansBundle> {
      const result = await fetchJSON<PlansBundle>(
        "plans:all",
        "plans.json",
        KV_TTL.plans
      );
      return result ?? { plans: [] };
    },
  };
}

/**
 * Create a DataClient that reads from local filesystem.
 * Used in dev when R2/KV bindings are not available.
 */
export function createLocalDataClient(basePath: string): DataClient {
  return {
    async getCellData(geohash: string): Promise<CellData | null> {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const filePath = path.join(basePath, "cells", `${geohash}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as CellData;
      } catch {
        return null;
      }
    },

    async getISPsForHex(hexuid: string): Promise<ISPEntry[]> {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const filePath = path.join(basePath, "isps", `${hexuid}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as ISPEntry[];
      } catch {
        return [];
      }
    },

    async getPlans(): Promise<PlansBundle> {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const filePath = path.join(basePath, "plans.json");
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as PlansBundle;
      } catch {
        return { plans: [] };
      }
    },
  };
}

/**
 * Get the appropriate DataClient based on the environment.
 * Returns R2/KV client in production, local filesystem client in dev.
 */
export function getDataClient(env: Record<string, unknown>): DataClient {
  const r2Env = env as unknown as R2KVEnv;
  if (r2Env.DATA_BUCKET) {
    return createR2DataClient(r2Env);
  }
  // Fallback to local filesystem for dev
  const basePath = (env.PRECOMPUTED_DATA_PATH as string | undefined)
    ?? "data/precomputed";
  return createLocalDataClient(basePath);
}
