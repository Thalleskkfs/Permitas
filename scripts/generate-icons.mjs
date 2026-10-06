import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('./node_modules/.pnpm/sharp@0.35.4_@types+node@20.19.43/node_modules/sharp');

async function main() {
  const svgBuffer = fs.readFileSync('public/marca/favicon-preto.svg');
  
  // 48x48 PNG (Standard for Google Search)
  await sharp(svgBuffer).resize(48, 48).png().toFile('public/favicon.png');
  console.log('Created public/favicon.png (48x48)');

  // 192x192 PNG (High-res for mobile Google Search & Android)
  await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png');
  console.log('Created public/icon-192.png (192x192)');

  // 180x180 PNG (Apple touch icon)
  await sharp(svgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png');
  console.log('Created public/apple-touch-icon.png (180x180)');

  // 48x48, 32x32, 16x16 for favicon.ico
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type (1 = ICO)
  header.writeUInt16LE(3, 4); // 3 images: 16x16, 32x32, 48x48

  const entries = [
    { width: 16, height: 16, buf: png16 },
    { width: 32, height: 32, buf: png32 },
    { width: 48, height: 48, buf: png48 },
  ];

  let offset = 6 + (16 * entries.length);
  const dirBuffers = [];
  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(entry.width, 0);
    dir.writeUInt8(entry.height, 1);
    dir.writeUInt8(0, 2); // color count
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(entry.buf.length, 8); // size of image data
    dir.writeUInt32LE(offset, 12); // offset of image data
    dirBuffers.push(dir);
    offset += entry.buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirBuffers, ...entries.map(e => e.buf)]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  console.log('Created public/favicon.ico (multi-res 16, 32, 48)');

  fs.writeFileSync('src/app/favicon.ico', icoBuffer);
  console.log('Created src/app/favicon.ico');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
