// Disposable PostgreSQL stand-ins only; hosted migrations use Supabase Realtime.
export async function testRealtime(database: { exec(sql: string): Promise<unknown> }) {
  await database.exec(`create schema realtime;
    grant usage on schema auth to authenticated;
    create table realtime.messages(id uuid default gen_random_uuid(),topic text,extension text,payload jsonb,event text,private boolean);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$select current_setting('request.realtime.topic',true)$$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void
      language sql as $$insert into realtime.messages(payload,event,topic,private,extension) values(payload,event,topic,private,'broadcast')$$;`);
}
