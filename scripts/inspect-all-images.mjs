import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey || supabaseKey === '[SENSITIVE]') {
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      price_cents,
      product_images (
        id,
        storage_path,
        alt_text,
        position
      )
    `);

  for (const p of products) {
    console.log(`Product: [${p.id}] "${p.name}" (slug: ${p.slug}, price: ${p.price_cents/100})`);
    for (const img of p.product_images) {
      console.log(`   Image [${img.id}]: path="${img.storage_path}", alt="${img.alt_text}"`);
    }
  }
}

main();
