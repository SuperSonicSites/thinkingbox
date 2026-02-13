import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getDatabase(env?: {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
}): ReturnType<typeof postgres> {
  if (sql) return sql;

  const connectionString =
    env?.HYPERDRIVE?.connectionString ??
    env?.DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/ispbyaddress";

  sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for Hyperdrive compatibility
  });

  return sql;
}

export type SQL = ReturnType<typeof postgres>;
