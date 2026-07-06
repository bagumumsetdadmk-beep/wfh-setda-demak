const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.example', 'utf8');
const NEXT_PUBLIC_SUPABASE_URL = "https://mlcoidhujxbjdatssjjq.supabase.co"; 
const anon = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, anon);

async function check() {
  const { data, error } = await supabase.from('work_reports').select('*, profiles!inner(*)').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
check();
