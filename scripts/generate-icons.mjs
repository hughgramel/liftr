import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG dumbbell icon - simple and clean design
const createDumbbellSvg = (size) => {
  const padding = size * 0.15;
  const innerSize = size - padding * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3B82F6" rx="${size * 0.2}"/>
  <g transform="translate(${padding}, ${padding})">
    <g fill="white" transform="translate(${innerSize/2}, ${innerSize/2}) rotate(45)">
      <!-- Center bar -->
      <rect x="${-innerSize * 0.35}" y="${-innerSize * 0.06}" width="${innerSize * 0.7}" height="${innerSize * 0.12}" rx="${innerSize * 0.03}"/>
      <!-- Left weight -->
      <rect x="${-innerSize * 0.42}" y="${-innerSize * 0.18}" width="${innerSize * 0.12}" height="${innerSize * 0.36}" rx="${innerSize * 0.03}"/>
      <!-- Right weight -->
      <rect x="${innerSize * 0.30}" y="${-innerSize * 0.18}" width="${innerSize * 0.12}" height="${innerSize * 0.36}" rx="${innerSize * 0.03}"/>
      <!-- Left outer weight -->
      <rect x="${-innerSize * 0.48}" y="${-innerSize * 0.14}" width="${innerSize * 0.08}" height="${innerSize * 0.28}" rx="${innerSize * 0.02}"/>
      <!-- Right outer weight -->
      <rect x="${innerSize * 0.40}" y="${-innerSize * 0.14}" width="${innerSize * 0.08}" height="${innerSize * 0.28}" rx="${innerSize * 0.02}"/>
    </g>
  </g>
</svg>`;
};

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

async function generateIcons() {
  console.log('Generating LiftR icons...');

  for (const size of sizes) {
    const svg = createDumbbellSvg(size);
    const buffer = Buffer.from(svg);

    try {
      const pngBuffer = await sharp(buffer).png().toBuffer();

      // Determine filename
      let filename;
      if (size === 16) filename = 'favicon-16x16.png';
      else if (size === 32) filename = 'favicon-32x32.png';
      else if (size === 180) filename = 'apple-touch-icon.png';
      else if (size === 192) {
        filename = 'icon-192x192.png';
        // Also save as android-chrome
        writeFileSync(join(publicDir, 'android-chrome-192x192.png'), pngBuffer);
      }
      else if (size === 512) {
        filename = 'icon-512x512.png';
        // Also save as android-chrome
        writeFileSync(join(publicDir, 'android-chrome-512x512.png'), pngBuffer);
      }
      else filename = `icon-${size}x${size}.png`;

      writeFileSync(join(publicDir, filename), pngBuffer);
      console.log(`  Created ${filename}`);
    } catch (err) {
      console.error(`  Failed to create ${size}x${size}: ${err.message}`);
    }
  }

  // Create favicon.ico from 32x32
  const svg32 = createDumbbellSvg(32);
  const ico = await sharp(Buffer.from(svg32)).png().toBuffer();
  writeFileSync(join(publicDir, 'favicon.ico'), ico);
  console.log('  Created favicon.ico');

  console.log('Done!');
}

generateIcons().catch(console.error);
