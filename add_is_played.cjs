const { Client } = require('pg');

const hosts = [
  'db.iphngnvzdqmuibscmtjk.supabase.co',
  'aws-0-eu-west-3.pooler.supabase.com',
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com'
];

async function tryConnect(host) {
  const isPooler = host.includes('pooler');
  const user = isPooler ? 'postgres.iphngnvzdqmuibscmtjk' : 'postgres';
  const port = isPooler ? 6543 : 5432;
  const client = new Client({
    host,
    port,
    user,
    password: 'As6858r77169',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    await client.connect();
    console.log('Connected to', host);
    return client;
  } catch (err) {
    console.log('Failed', host, err.message);
    return null;
  }
}

async function run() {
  for (const h of hosts) {
    const c = await tryConnect(h);
    if (c) {
      try {
        await c.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_played BOOLEAN DEFAULT FALSE;');
        console.log('Column is_played added successfully to questions table!');
      } catch (e) {
        console.log('Error adding column:', e.message);
      }
      await c.end();
      break;
    }
  }
}
run();
