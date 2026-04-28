import { defineConfig } from "drizzle-kit";

function normalizeDatabaseUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.endsWith(".neon.tech") &&
      (!parsed.searchParams.has("sslmode") ||
        ["prefer", "require", "verify-ca"].includes(
          parsed.searchParams.get("sslmode") ?? "",
        ))
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
}

const databaseUrl = normalizeDatabaseUrl(
  process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_POSTGRES_URL ??
    process.env.DATABASE_POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL,
);

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
