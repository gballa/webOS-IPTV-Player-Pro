/**
 * Standalone webOS IPK packager.
 * Produces a valid, installable .ipk package complying with webOS 4.0 - webOS 26 specs.
 * Can be installed on LG webOS TVs via Developer Mode CLI (ares-install), webOS Dev Manager, or Homebrew Channel.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';

const PKG_ID = 'com.webos.iptv.pro';
const VERSION = '1.0.0';
const IPK_NAME = `${PKG_ID}_${VERSION}_all.ipk`;

console.log(`[Packager] Packaging webOS application into ${IPK_NAME}...`);

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  console.error('[Packager] Error: dist/ directory does not exist. Run npm run build first.');
  process.exit(1);
}

// Copy appinfo.json and icons to dist/
fs.copyFileSync('appinfo.json', 'dist/appinfo.json');
if (fs.existsSync('icon.png')) fs.copyFileSync('icon.png', 'dist/icon.png');
if (fs.existsSync('largeIcon.png')) fs.copyFileSync('largeIcon.png', 'dist/largeIcon.png');

// If ares-package is available on the machine, prefer official ares-package
let aresAvailable = false;
try {
  execSync('ares-package --version', { stdio: 'ignore' });
  aresAvailable = true;
} catch {
  aresAvailable = false;
}

if (aresAvailable) {
  console.log('[Packager] Using system ares-package tool...');
  execSync(`ares-package dist bundled-service -o . --no-minify`, { stdio: 'inherit' });
  console.log(`[Packager] Successfully generated ${IPK_NAME} using ares-package!`);
} else {
  console.log('[Packager] ares-package not in PATH; generating Debian-format .ipk package using native tar/ar pipeline...');

  // Create staging directory
  const stageDir = path.resolve('.ipk_staging');
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  // 1. debian-binary
  fs.writeFileSync(path.join(stageDir, 'debian-binary'), '2.0\n');

  // 2. control file
  const controlContent = `Package: ${PKG_ID}
Version: ${VERSION}
Section: misc
Priority: optional
Architecture: all
Maintainer: LG webOS Community
Description: High-performance IPTV player for LG webOS TVs featuring 10-foot spatial navigation, native 4K/HDR engine, EPG, Xtream Codes, and Live DVR.
`;

  const controlDir = path.join(stageDir, 'control_dir');
  fs.mkdirSync(controlDir);
  fs.writeFileSync(path.join(controlDir, 'control'), controlContent);

  // Archive control.tar.gz
  execSync(`tar -czf ${path.join(stageDir, 'control.tar.gz')} -C ${controlDir} .`);

  // 3. data.tar.gz containing dist files installed to /media/developer/apps/usr/palm/applications/com.webos.iptv.pro
  const dataDir = path.join(stageDir, 'data_dir', 'usr', 'palm', 'applications', PKG_ID);
  fs.mkdirSync(dataDir, { recursive: true });

  // Copy dist files into target path
  execSync(`cp -r dist/* ${dataDir}`);
  if (fs.existsSync('bundled-service')) {
    const srvDir = path.join(stageDir, 'data_dir', 'usr', 'palm', 'services', `${PKG_ID}.service`);
    fs.mkdirSync(srvDir, { recursive: true });
    execSync(`cp -r bundled-service/* ${srvDir}`);
  }

  const dataTarGz = path.join(stageDir, 'data.tar.gz');
  execSync(`tar -czf ${dataTarGz} -C ${path.join(stageDir, 'data_dir')} .`);

  // 4. Create .ipk archive (standard Debian ar or tar archive format)
  // Check if `ar` is available
  let arAvailable = false;
  try {
    execSync('ar --version', { stdio: 'ignore' });
    arAvailable = true;
  } catch {
    arAvailable = false;
  }

  if (arAvailable) {
    execSync(`ar -cr ${IPK_NAME} ${path.join(stageDir, 'debian-binary')} ${path.join(stageDir, 'control.tar.gz')} ${dataTarGz}`);
  } else {
    // Standard tar format is accepted by webOS ipkg / opkg
    execSync(`tar -czf ${IPK_NAME} -C ${stageDir} debian-binary control.tar.gz data.tar.gz`);
  }

  // Cleanup staging
  fs.rmSync(stageDir, { recursive: true, force: true });
  console.log(`[Packager] Build complete: ${IPK_NAME} (${(fs.statSync(IPK_NAME).size / 1024).toFixed(1)} KB)`);
}
