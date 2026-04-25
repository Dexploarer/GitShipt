import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

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
