import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'public', 'icons');

const masterSvg = readFileSync(resolve(iconsDir, 'icon-master.svg'));
const maskableSvg = readFileSync(resolve(iconsDir, 'icon-maskable.svg'));

// All sizes needed for a robust PWA
const sizes = [48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

async function generate() {
  // Generate standard icons
  for (const size of sizes) {
    await sharp(masterSvg)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, `icon-${size}x${size}.png`));
    console.log(`  ✓ icon-${size}x${size}.png`);
  }

  // Generate maskable icons
  for (const size of [192, 512]) {
    await sharp(maskableSvg)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, `icon-maskable-${size}x${size}.png`));
    console.log(`  ✓ icon-maskable-${size}x${size}.png`);
  }

  // Generate favicon (32x32)
  await sharp(masterSvg)
    .resize(32, 32)
    .png()
    .toFile(resolve(iconsDir, '..', 'favicon.png'));
  console.log('  ✓ favicon.png');

  // Generate favicon.ico (using 32x32 PNG as base)
  // sharp doesn't output .ico directly, so we'll create a 32x32 PNG
  // and also a 16x16 for legacy
  await sharp(masterSvg)
    .resize(16, 16)
    .png()
    .toFile(resolve(iconsDir, '..', 'favicon-16x16.png'));
  console.log('  ✓ favicon-16x16.png');

  await sharp(masterSvg)
    .resize(32, 32)
    .png()
    .toFile(resolve(iconsDir, '..', 'favicon-32x32.png'));
  console.log('  ✓ favicon-32x32.png');

  // Apple touch icon (180x180)
  await sharp(masterSvg)
    .resize(180, 180)
    .png()
    .toFile(resolve(iconsDir, '..', 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png');

  console.log('\nAll icons generated successfully!');
}

generate().catch(console.error);
