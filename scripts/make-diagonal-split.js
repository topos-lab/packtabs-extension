import { execSync } from 'node:child_process';
import fs from 'node:fs';

function makeDiagonalSplit(lightPath: string, darkPath: string, outPath: string) {
  execSync(`ffmpeg -i "${lightPath}" -f rawvideo -pix_fmt rgba light.raw -y`);
  execSync(`ffmpeg -i "${darkPath}" -f rawvideo -pix_fmt rgba dark.raw -y`);

  const light = fs.readFileSync('light.raw');
  const dark = fs.readFileSync('dark.raw');
  const out = Buffer.alloc(1280 * 800 * 4);

  // Line equation: Ax + By + C = 0
  // Passes through (x=860, y=0) and (x=440, y=800)
  const A = 800;
  const B = 420;
  const C = -688000;
  const len = Math.sqrt(A * A + B * B);

  // Line width: 2.5px
  const halfLineWidth = 1.2;

  for (let y = 0; y < 800; y++) {
    for (let x = 0; x < 1280; x++) {
      const idx = (y * 1280 + x) * 4;
      const signedDist = (A * x + B * y + C) / len;

      if (Math.abs(signedDist) <= halfLineWidth) {
        // Crisp, sleek divider line (Zinc-300 / subtle border color)
        out[idx] = 180;
        out[idx + 1] = 185;
        out[idx + 2] = 195;
        out[idx + 3] = 255;
      } else if (signedDist < 0) {
        // Left-hand side: Light Mode
        out[idx] = light[idx];
        out[idx + 1] = light[idx + 1];
        out[idx + 2] = light[idx + 2];
        out[idx + 3] = 255;
      } else {
        // Right-hand side: Dark Mode
        out[idx] = dark[idx];
        out[idx + 1] = dark[idx + 1];
        out[idx + 2] = dark[idx + 2];
        out[idx + 3] = 255;
      }
    }
  }

  fs.writeFileSync('out.raw', out);
  execSync(`ffmpeg -f rawvideo -pix_fmt rgba -s 1280x800 -i out.raw -pix_fmt rgb24 "${outPath}" -y`);
  try {
    fs.unlinkSync('light.raw');
    fs.unlinkSync('dark.raw');
    fs.unlinkSync('out.raw');
  } catch (err) {
    console.warn('Temporary file cleanup warning:', err);
  }
}

makeDiagonalSplit('docs/screenshots/saved-group-light-zh.png', 'docs/screenshots/saved-group-dark-zh.png', 'docs/screenshots/theme-comparison-zh.png');
makeDiagonalSplit('docs/screenshots/saved-group-light-en.png', 'docs/screenshots/saved-group-dark-en.png', 'docs/screenshots/theme-comparison-en.png');
console.log('Successfully generated theme-comparison-zh.png and theme-comparison-en.png');
