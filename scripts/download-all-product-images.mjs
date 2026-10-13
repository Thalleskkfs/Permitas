import fs from 'fs';
import path from 'path';
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
      category_id,
      categories (name),
      product_images (
        id,
        storage_path,
        alt_text,
        position
      )
    `);

  const outDir = path.resolve('public', 'downloaded_products');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const mapping = [];

  for (const p of products) {
    for (const img of p.product_images) {
      const ext = path.extname(img.storage_path) || '.png';
      const filename = `${p.slug}${ext}`;
      const dest = path.join(outDir, filename);

      const url = `https://permitaseprazer.com.br/imagens/${img.storage_path}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(dest, buffer);
          mapping.push({
            slug: p.slug,
            name: p.name,
            price: p.price_cents / 100,
            category: p.categories?.name,
            filename,
            path: dest,
            storage_path: img.storage_path,
            size: buffer.length
          });
          console.log(`Saved ${filename} (${buffer.length} bytes)`);
        } else {
          console.log(`Failed to fetch ${url}: ${res.status}`);
        }
      } catch (err) {
        console.error(`Error fetching ${url}:`, err.message);
      }
    }
  }

  fs.writeFileSync('public/downloaded_products/mapping.json', JSON.stringify(mapping, null, 2));
  console.log(`Total images downloaded: ${mapping.length}`);
}

main();
