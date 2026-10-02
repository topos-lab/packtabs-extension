import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const SIZES = [16, 32, 48, 96, 128];
const SVG_PATH = path.resolve('public/icon/icon.svg');
const OUTPUT_DIR = path.resolve('public/icon');

async function generateIcons() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error(`SVG source not found at: ${SVG_PATH}`);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  console.log('Generating PackTabs icons using sharp...');

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `${size}.png`);
    
    // For crisp edges on small sizes (16 and 32), we can render at high resolution then resize with lanczos3
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size} icon -> ${outputPath}`);
  }

  console.log('\nAll Chrome & Firefox icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
