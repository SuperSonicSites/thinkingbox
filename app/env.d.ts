/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  HYPERDRIVE?: {
    connectionString: string;
  };
  LOOKUP_CACHE?: KVNamespace;
  DATA_BUCKET?: R2Bucket;
  INGESTION_QUEUE?: Queue;
  GEOCODE_PROVIDER: string;
  GOOGLE_PLACES_API_KEY?: string;
  MOCK_PLANS: string;
  DATABASE_URL?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
