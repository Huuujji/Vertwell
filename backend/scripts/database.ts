import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';

const backendRoot = new URL('../', import.meta.url);
const migrationsRoot = new URL('supabase/migrations/', backendRoot);
const hash = (sql: string) => createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');

export function transactionBody(sql: string) {
  const begins = [...sql.matchAll(/^begin;\s*$/gmi)];
  const commits = [...sql.matchAll(/^commit;\s*$/gmi)];
  if (begins.length !== 1 || commits.length !== 1) throw new Error('Expected one migration transaction envelope.');
  return sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'');
}

export async function migrationFiles() {
  const files = (await readdir(migrationsRoot)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  return Promise.all(files.map(async file => {
    const match = /^(\d+)_(.+)\.sql$/.exec(file)!;
    const sql = await readFile(new URL(file,migrationsRoot),'utf8');
    return {file,version:match[1]!,name:match[2]!,sql,sha256:hash(sql)};
  }));
}

export async function developmentClient() {
  const local = parse(await readFile(new URL('.env.database.local',backendRoot)));
  const settings = {...local,...process.env};
  const ref = settings.VERTWELL_DEV_PROJECT_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error('A valid VERTWELL_DEV_PROJECT_REF is required.');
  const user = settings.VERTWELL_DEV_DATABASE_USER;
  const host = settings.VERTWELL_DEV_DATABASE_HOST;
  if (!user?.endsWith(`.${ref}`) || !host?.endsWith('.pooler.supabase.com')) {
    throw new Error('Expected this development project\'s dashboard session-pooler host/user.');
  }
  if (!settings.VERTWELL_DEV_DATABASE_PASSWORD) throw new Error('Development database password is missing.');
  const client = new pg.Client({
    host,port:Number(settings.VERTWELL_DEV_DATABASE_PORT ?? 5432),user,
    database:settings.VERTWELL_DEV_DATABASE_NAME ?? 'postgres',
    password:settings.VERTWELL_DEV_DATABASE_PASSWORD,
    connectionTimeoutMillis:15000,statement_timeout:30000,
    application_name:'vertwell-development-database',
    ssl:{rejectUnauthorized:true,ca:await readFile(new URL('supabase/certs/supabase-prod-ca-2021.crt',backendRoot),'utf8')},
  });
  return {client,ref};
}

async function inspect(client: pg.Client) {
  const identity = await client.query('select current_database() as database, current_user as role, version()');
  const tables = await client.query(`select n.nspname as schema,c.relname as name,c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','supabase_migrations') and c.relkind='r' order by 1,2`);
  return {identity:identity.rows,tables:tables.rows};
}

async function apply(client: pg.Client, expectedRef: string, actualRef: string) {
  if (expectedRef !== actualRef) throw new Error('Apply requires --project-ref matching the configured development project.');
  const files = await migrationFiles();
  await client.query('begin');
  try {
    await client.query('select pg_advisory_xact_lock(171026,2)');
    const historyExists = await client.query("select to_regclass('supabase_migrations.schema_migrations') as table_name");
    if (!historyExists.rows[0].table_name) {
      const existing = await client.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind='r'`);
      if (existing.rows.length) throw new Error('Untracked existing application tables found; inspect before migration.');
      await client.query(`create schema if not exists supabase_migrations;
        create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
        revoke all on schema supabase_migrations from public,anon,authenticated,service_role;
        revoke all on supabase_migrations.schema_migrations from public,anon,authenticated,service_role;`);
    }
    const history = await client.query<{version:string;statements:string[];name:string}>(
      'select version,statements,name from supabase_migrations.schema_migrations order by version');
    const known = new Set(files.map(file => file.version));
    if (history.rows.some(row => !known.has(row.version))) throw new Error('Remote migration history has unknown files.');
    const result = [];
    for (const file of files) {
      const previous = history.rows.find(row => row.version === file.version);
      if (previous) {
        if (previous.name !== file.name || previous.statements?.length !== 1 || hash(previous.statements[0]!) !== file.sha256) {
          throw new Error(`Migration drift detected for ${file.file}; never overwrite applied history.`);
        }
        result.push({file:file.file,status:'already applied',sha256:file.sha256});
        continue;
      }
      await client.query(transactionBody(file.sql));
      await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values ($1,$2,$3)',
        [file.version,file.name,[file.sql]]);
      result.push({file:file.file,status:'applied',sha256:file.sha256});
    }
    await client.query('commit');
    return result;
  } catch (error) { await client.query('rollback'); throw error; }
}

async function verify(client: pg.Client) {
  const state = await inspect(client);
  const businessTables = state.tables.filter(row => row.schema === 'public');
  if (businessTables.length !== 25 || businessTables.some(row => !row.rls)) throw new Error('Expected 25 RLS-protected application tables.');
  const grants = await client.query(`select table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema='public' and grantee in ('PUBLIC','anon','authenticated','service_role')`);
  if (grants.rows.length) throw new Error('Unexpected application table grants.');
  const helpers = await client.query(`select p.proname,r.rolname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
    where n.nspname='private' and r.rolname in ('anon','authenticated','service_role')
      and has_function_privilege(r.rolname,p.oid,'EXECUTE')`);
  if (helpers.rows.length) throw new Error('Unexpected private helper execution grants.');
  const missingIndexes = await client.query(`select c.conrelid::regclass::text as table_name,c.conname
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where c.contype='f' and n.nspname='public' and not exists (
      select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null
      and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)`);
  if (missingIndexes.rows.length) throw new Error(`Foreign keys missing full leading indexes: ${JSON.stringify(missingIndexes.rows)}`);
  const counts = await client.query(`select (select count(*)::int from auth.users) as auth_users,
    (select count(*)::int from public.profiles) as profiles,(select count(*)::int from public.sales) as sales,
    (select count(*)::int from public.stock_movements) as stock_movements`);
  const history = await client.query<{version:string;name:string;statements:string[]}>(
    'select version,name,statements from supabase_migrations.schema_migrations order by version');
  const files = await migrationFiles();
  if (history.rows.length !== files.length || files.some(file => {
    const remote = history.rows.find(row => row.version === file.version);
    return !remote || remote.name !== file.name || remote.statements?.length !== 1 || hash(remote.statements[0]!) !== file.sha256;
  })) throw new Error('Applied migration history does not match local files.');
  return {...state,counts:counts.rows[0],publicTableGrants:0,privateHelperGrants:0,unindexedForeignKeys:0,
    history:files.map(file => ({file:file.file,sha256:file.sha256}))};
}

async function main() {
  const mode = process.argv[2] ?? 'inspect';
  if (!['inspect','apply','verify'].includes(mode)) throw new Error('Use inspect, apply or verify.');
  const {client,ref} = await developmentClient();
  try {
    await client.connect();
    const result = mode === 'apply' ? await apply(client,process.argv[process.argv.indexOf('--project-ref')+1] ?? '',ref)
      : mode === 'verify' ? await verify(client) : await inspect(client);
    console.log(JSON.stringify({project:ref,mode,result},null,2));
  } finally { await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // Never serialize a client/config object or connection URL containing secrets.
    console.error(error instanceof Error ? error.message : 'Database operation failed.');
    process.exitCode=1;
  });
}
