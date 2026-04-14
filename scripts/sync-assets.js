import fs from 'fs';
import path from 'path';

const srcDir = 'src/web';
const distDir = 'dist/web';

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.cpSync(srcDir, distDir, { recursive: true });
  console.log(`✅ Static assets synchronized from ${srcDir} to ${distDir}`);
} else {
  console.warn(`⚠️ Warning: ${srcDir} not found to synchronize.`);
}
