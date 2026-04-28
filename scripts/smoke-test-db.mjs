import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DATABASE_POSTGRES_URL ??
  process.env.DATABASE_POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "Set DATABASE_URL or POSTGRES_URL before running smoke-test-db.",
  );
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

const tables = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name
`;
console.log(`Tables in DB (${tables.length}):`);
for (const t of tables) console.log(`  - ${t.table_name}`);

const enums = await sql`
  select t.typname
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e'
  order by t.typname
`;
console.log(`\nEnums (${enums.length}):`);
for (const e of enums) console.log(`  - ${e.typname}`);

await sql.end();
