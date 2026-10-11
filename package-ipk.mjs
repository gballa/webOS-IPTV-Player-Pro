/**
 * Standalone webOS IPK packager.
 * Produces a strictly compliant Debian AR-format .ipk package complying with
 * LG webOS 4.0 - webOS 26 specs, avoiding "ipk verified failed" errors caused by
 * invalid outer formats or epoch-zero timestamps.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PKG_ID = 'com.webos.iptv.pro';
const VERSION = '1.0.0';
const IPK_NAME = `${PKG_ID}_${VERSION}_all.ipk`;

console.log(`[Packager] Packaging webOS application into ${IPK_NAME}...`);

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  console.log('[Packager] dist/ missing, running npm run build first...');
  execSync('npm run build', { stdio: 'inherit' });
}

// Copy appinfo.json and icons to dist/
fs.copyFileSync('appinfo.json', 'dist/appinfo.json');
if (fs.existsSync('icon.png')) fs.copyFileSync('icon.png', 'dist/icon.png');
if (fs.existsSync('largeIcon.png')) fs.copyFileSync('largeIcon.png', 'dist/largeIcon.png');

// Check if official ares-package is available
let aresAvailable = false;
try {
  execSync('ares-package --version', { stdio: 'ignore' });
  aresAvailable = true;
} catch {
  aresAvailable = false;
}

if (aresAvailable) {
  console.log('[Packager] Using system ares-package tool...');
  execSync(`ares-package dist -o . --no-minify`, { stdio: 'inherit' });
  console.log(`[Packager] Successfully generated ${IPK_NAME} using ares-package!`);
} else {
  console.log('[Packager] Using native compliant Debian AR packager with valid webOS timestamps...');

  const stageDir = path.resolve('.ipk_staging');
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  const currentEpoch = Math.floor(Date.now() / 1000);

  // 1. debian-binary
  const debianBinaryContent = Buffer.from('2.0\n', 'ascii');

  // 2. control.tar.gz
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

  const controlTarGz = path.join(stageDir, 'control.tar.gz');
  // Use GNU tar format with current mtime to avoid epoch-zero pkgverifier failure
  execSync(`tar --format=gnu --mtime='@${currentEpoch}' --owner=0 --group=0 -czf "${controlTarGz}" -C "${controlDir}" .`);

  // 3. data.tar.gz
  const dataDir = path.join(stageDir, 'data_dir', 'usr', 'palm', 'applications', PKG_ID);
  fs.mkdirSync(dataDir, { recursive: true });
  execSync(`cp -r dist/* "${dataDir}"`);

  if (fs.existsSync('bundled-service')) {
    const srvDir = path.join(stageDir, 'data_dir', 'usr', 'palm', 'services', `${PKG_ID}.service`);
    fs.mkdirSync(srvDir, { recursive: true });
    execSync(`cp -r bundled-service/* "${srvDir}"`);
  }

  const dataTarGz = path.join(stageDir, 'data.tar.gz');
  execSync(`tar --format=gnu --mtime='@${currentEpoch}' --owner=0 --group=0 -czf "${dataTarGz}" -C "${path.join(stageDir, 'data_dir')}" .`);

  // 4. Construct Debian AR container format:
  // Signature: !<arch>\n
  // Each entry header is 60 bytes:
  // - name: 16 bytes (name/ padded with spaces)
  // - mtime: 12 bytes
  // - uid: 6 bytes
  // - gid: 6 bytes
  // - mode: 8 bytes (octal, e.g. 100644  )
  // - size: 10 bytes
  // - magic trailer: 2 bytes (`\n)
  // Followed by file data, plus a newline padding byte if file size is odd.
  function buildArHeader(name, size, mtime) {
    const entryName = (name + '/').padEnd(16, ' ');
    const ts = String(mtime).padEnd(12, ' ');
    const uid = '0'.padEnd(6, ' ');
    const gid = '0'.padEnd(6, ' ');
    const mode = '100644'.padEnd(8, ' ');
    const sizeStr = String(size).padEnd(10, ' ');
    const magicTrailer = '`\n';
    const rawHeader = entryName + ts + uid + gid + mode + sizeStr + magicTrailer;
    return Buffer.from(rawHeader, 'ascii');
  }

  const controlTarGzBuffer = fs.readFileSync(controlTarGz);
  const dataTarGzBuffer = fs.readFileSync(dataTarGz);

  const arMembers = [
    { name: 'debian-binary', data: debianBinaryContent },
    { name: 'control.tar.gz', data: controlTarGzBuffer },
    { name: 'data.tar.gz', data: dataTarGzBuffer },
  ];

  const fd = fs.openSync(IPK_NAME, 'w');
  fs.writeSync(fd, Buffer.from('!<arch>\n', 'ascii'));

  for (const member of arMembers) {
    const header = buildArHeader(member.name, member.data.length, currentEpoch);
    fs.writeSync(fd, header);
    fs.writeSync(fd, member.data);
    if (member.data.length % 2 !== 0) {
      fs.writeSync(fd, Buffer.from('\n', 'ascii'));
    }
  }

  fs.closeSync(fd);

  // Cleanup staging
  fs.rmSync(stageDir, { recursive: true, force: true });

  const finalSize = (fs.statSync(IPK_NAME).size / 1024).toFixed(1);
  console.log(`[Packager] Build complete: ${IPK_NAME} (${finalSize} KB) [Debian AR format with webOS timestamp validation]`);
}
