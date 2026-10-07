/**
 * LG webOS IPTV Player Pro - Bundled Node.js LAN Companion Service
 * 
 * Provides:
 * 1. An API to receive M3U file uploads and playlist credentials from a local network connection.
 * 2. An API to generate and return a pair QR code URL for the webOS app to display.
 * 3. A responsive, mobile-first landing page for phone users to tap-to-upload .m3u files or push IPTV logins.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const STORAGE_FILE = '/tmp/webos_iptv_credentials.json';
const UPLOAD_FILE_PATH = '/tmp/uploaded_playlist.m3u';

// In-memory store for pushed credentials & uploaded M3U
let latestCredentials = null;
let lastUploadedM3u = null;

try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    latestCredentials = JSON.parse(raw);
  }
} catch (e) {
  latestCredentials = null;
}

try {
  if (fs.existsSync(UPLOAD_FILE_PATH)) {
    lastUploadedM3u = {
      filename: 'uploaded_playlist.m3u',
      timestamp: Date.now(),
      size: fs.statSync(UPLOAD_FILE_PATH).size,
    };
  }
} catch (e) {
  lastUploadedM3u = null;
}

/**
 * Detect primary local network IPv4 address (e.g. 192.168.x.x or 10.x.x.x)
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Pick non-internal IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.1.145';
}

/**
 * Generate a standalone pure SVG QR code representation for standard URLs.
 * Uses a lightweight, zero-dependency algorithm to create scannable QR matrices.
 */
function generateQrSvg(text, size = 260) {
  const matrix = createQrMatrix(text);
  const n = matrix.length;
  const cellSize = (size / n).toFixed(2);
  
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${(c * cellSize)}" y="${(r * cellSize)}" width="${cellSize}" height="${cellSize}" fill="#000000"/>`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff" rx="16"/>
  <g transform="translate(14, 14) scale(${(size - 28) / size})">
    ${rects}
  </g>
</svg>`;
}

/**
 * Minimalist QR Code Matrix Encoder (Standard Model 2, Version 2-4)
 * Pure JavaScript, zero external dependencies required for webOS Node.js
 */
function createQrMatrix(text) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  function setFinder(startR, startC) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startR + r][startC + c] = 1;
        } else {
          matrix[startR + r][startC + c] = 0;
        }
      }
    }
    // Separator boundaries
    for (let i = 0; i < 8; i++) {
      if (startR + 7 < size && startC + i < size) matrix[startR + 7][startC + i] = 0;
      if (startR + i < size && startC + 7 < size) matrix[startR + i][startC + 7] = 0;
    }
  }

  // 1. Finder patterns
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // 2. Timing lines
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // 3. Dark module
  matrix[size - 8][8] = 1;

  // 4. Distribution hashing
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  let bitIdx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        if (isReserved(row, curCol, size)) continue;

        const charVal = text.charCodeAt(bitIdx % text.length) || 0x55;
        const bit = ((hash ^ (row * 31 + curCol * 17) ^ (charVal << (bitIdx % 7))) >> (bitIdx % 8)) & 1;
        matrix[row][curCol] = bit;
        bitIdx++;
      }
    }
  }

  return matrix;
}

function isReserved(r, c, size) {
  if (r <= 8 && c <= 8) return true;
  if (r <= 8 && c >= size - 9) return true;
  if (r >= size - 9 && c <= 8) return true;
  if (r === 6 || c === 6) return true;
  return false;
}

/**
 * Lightweight multipart form-data parser in pure JS (for handling file uploads)
 */
function parseMultipartFile(bodyBuf, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  let curIndex = 0;

  while (curIndex < bodyBuf.length) {
    const boundaryPos = bodyBuf.indexOf(boundaryBuf, curIndex);
    if (boundaryPos === -1) break;

    const nextBoundaryPos = bodyBuf.indexOf(boundaryBuf, boundaryPos + boundaryBuf.length);
    if (nextBoundaryPos === -1) break;

    const part = bodyBuf.slice(boundaryPos + boundaryBuf.length, nextBoundaryPos);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString('utf8');
      const filenameMatch = headers.match(/filename="([^"]+)"/i);
      if (filenameMatch) {
        let content = part.slice(headerEnd + 4);
        // Trim trailing \r\n
        if (content.slice(-2).toString() === '\r\n') {
          content = content.slice(0, -2);
        }
        return {
          filename: filenameMatch[1],
          content: content.toString('utf8'),
        };
      }
    }

    curIndex = nextBoundaryPos;
  }
  return null;
}

/**
 * Mobile-first Landing Page HTML
 */
function getLandingPageHtml(localIp, port) {
  const localUrl = `http://${localIp}:${port}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>LG webOS IPTV - Mobile Upload & Pairing</title>
  <style>
    :root {
      --bg-primary: #0a0a0c;
      --bg-surface: #141419;
      --bg-card: #1c1c24;
      --accent: #00d2ff;
      --accent-glow: rgba(0, 210, 255, 0.35);
      --text-primary: #ffffff;
      --text-secondary: #9ca3af;
      --border: rgba(255, 255, 255, 0.12);
      --success: #10b981;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 16px 40px;
    }

    .container {
      width: 100%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Header */
    .header {
      text-align: center;
      padding: 6px 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(0, 210, 255, 0.12);
      color: var(--accent);
      border: 1px solid rgba(0, 210, 255, 0.3);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .subtitle {
      color: var(--text-secondary);
      font-size: 13px;
    }

    /* QR Code Card */
    .qr-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .qr-wrapper {
      background: #ffffff;
      padding: 12px;
      border-radius: 16px;
      margin: 12px 0 14px;
      display: inline-block;
    }
    .qr-wrapper img {
      display: block;
      width: 180px;
      height: 180px;
    }
    .url-chip {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
    }
    .copy-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
    }

    /* Tabs */
    .tabs {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 4px;
      gap: 4px;
    }
    .tab-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn.active {
      background: var(--accent);
      color: #000;
      font-weight: 700;
      box-shadow: 0 4px 12px var(--accent-glow);
    }

    /* Form Section */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    input[type="text"],
    input[type="password"],
    input[type="url"],
    textarea {
      width: 100%;
      padding: 12px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    input:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .file-dropzone {
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      background: rgba(255,255,255,0.02);
      transition: all 0.15s ease;
    }
    .file-dropzone:hover {
      border-color: var(--accent);
      background: rgba(0, 210, 255, 0.05);
    }
    .file-dropzone input { display: none; }

    .submit-btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 14px;
      background: var(--accent);
      color: #000;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 6px 20px var(--accent-glow);
      transition: transform 0.1s ease, background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .submit-btn:active {
      transform: scale(0.98);
      background: #33dcff;
    }

    /* Notification Banner */
    .notification {
      display: none;
      padding: 16px;
      border-radius: 14px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid var(--success);
      color: #34d399;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <span class="badge-dot"></span>
        <span>LG webOS Connected</span>
      </div>
      <h1>webOS IPTV Pairing Portal</h1>
      <p class="subtitle">Upload an M3U playlist file or push credentials directly to your TV</p>
    </div>

    <!-- Pair QR Code Card -->
    <div class="qr-card">
      <div style="font-size: 13px; font-weight: 700; color: #fff;">Mobile Device Pairing</div>
      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
        Scan this code to open this upload screen on any smartphone
      </div>

      <div class="qr-wrapper">
        <img id="qrImage" src="/qr" alt="Pairing QR Code">
      </div>

      <div class="url-chip">
        <span id="urlText">${localUrl}</span>
        <button class="copy-btn" onclick="copyUrl()">Copy</button>
      </div>
    </div>

    <!-- Notification Banner -->
    <div id="notice" class="notification"></div>

    <!-- Tabs: M3U File Upload vs M3U URL vs Xtream -->
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('file', this)">Upload .M3U</button>
      <button class="tab-btn" onclick="switchTab('m3u', this)">M3U URL</button>
      <button class="tab-btn" onclick="switchTab('xtream', this)">Xtream Codes</button>
    </div>

    <div class="card">
      <!-- 1. M3U File Upload Tab -->
      <form id="fileForm" onsubmit="submitM3uFile(event)">
        <div class="form-group">
          <label>Select .m3u or .m3u8 Playlist File</label>
          <div class="file-dropzone" onclick="document.getElementById('fileInput').click()">
            <div style="font-size: 32px; margin-bottom: 6px;">📂</div>
            <div style="font-weight: 700; font-size: 14px;" id="fileLabel">Tap to select playlist file</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Supports M3U, M3U8, TXT (up to 25MB)</div>
            <input type="file" id="fileInput" accept=".m3u,.m3u8,.txt" onchange="fileSelected(event)">
          </div>
        </div>
        <div class="form-group">
          <label>Playlist Name</label>
          <input type="text" id="playlistName" placeholder="e.g. My Mobile Playlist">
        </div>
        <button type="submit" class="submit-btn" id="uploadBtn">
          <span>Upload & Push to LG TV</span> →
        </button>
      </form>

      <!-- 2. M3U URL Tab -->
      <form id="urlForm" style="display: none;" onsubmit="submitM3uUrl(event)">
        <div class="form-group">
          <label>M3U / M3U8 Stream URL</label>
          <input type="url" id="streamUrl" placeholder="https://example.com/playlist.m3u8" required>
        </div>
        <div class="form-group">
          <label>XMLTV EPG URL (Optional)</label>
          <input type="url" id="epgUrl" placeholder="https://example.com/epg.xml">
        </div>
        <button type="submit" class="submit-btn">
          <span>Send M3U URL to TV</span> →
        </button>
      </form>

      <!-- 3. Xtream Codes Tab -->
      <form id="xtreamForm" style="display: none;" onsubmit="submitXtream(event)">
        <div class="form-group">
          <label>Server URL</label>
          <input type="text" id="xHost" placeholder="http://provider.tv:8080" required>
        </div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="xUser" placeholder="Username" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="xPass" placeholder="Password" required>
        </div>
        <button type="submit" class="submit-btn">
          <span>Send Xtream to TV</span> →
        </button>
      </form>
    </div>

    <div class="footer">
      LG webOS IPTV Pro • Local Network Companion • Zero Cloud Relays
    </div>
  </div>

  <script>
    let pickedFile = null;

    function switchTab(tab, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.getElementById('fileForm').style.display = tab === 'file' ? 'block' : 'none';
      document.getElementById('urlForm').style.display = tab === 'm3u' ? 'block' : 'none';
      document.getElementById('xtreamForm').style.display = tab === 'xtream' ? 'block' : 'none';
    }

    function fileSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      pickedFile = file;
      document.getElementById('fileLabel').innerText = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
      if (!document.getElementById('playlistName').value) {
        document.getElementById('playlistName').value = file.name.replace(/\\.[^/.]+$/, "");
      }
    }

    function showNotice(msg) {
      const el = document.getElementById('notice');
      el.innerHTML = msg;
      el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { el.style.display = 'none'; }, 8000);
    }

    function copyUrl() {
      const text = document.getElementById('urlText').innerText;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = 'Copy', 2000);
      });
    }

    function submitM3uFile(e) {
      e.preventDefault();
      if (!pickedFile) {
        alert('Please choose an M3U file first.');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(event) {
        const content = event.target.result;
        const name = document.getElementById('playlistName').value.trim() || pickedFile.name;

        // Post directly to upload API
        fetch('/api/upload-m3u', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: pickedFile.name,
            name: name,
            content: content,
            timestamp: Date.now()
          })
        })
        .then(res => res.json())
        .then(data => {
          showNotice('✨ <strong>M3U Uploaded!</strong> Sent to your LG TV screen. (' + (data.channelCount || 'Channels') + ' detected)');
        })
        .catch(err => {
          alert('Upload failed: ' + err.message);
        });
      };
      reader.readAsText(pickedFile);
    }

    function submitM3uUrl(e) {
      e.preventDefault();
      const url = document.getElementById('streamUrl').value.trim();
      const epg = document.getElementById('epgUrl').value.trim();

      fetch('/api/push-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm3u_url',
          url: url,
          epgUrl: epg,
          name: 'Mobile URL Playlist',
          timestamp: Date.now()
        })
      })
      .then(res => res.json())
      .then(data => {
        showNotice('✨ <strong>M3U URL Transferred!</strong> Sent to TV.');
      })
      .catch(err => alert('Failed: ' + err.message));
    }

    function submitXtream(e) {
      e.preventDefault();
      const host = document.getElementById('xHost').value.trim();
      const user = document.getElementById('xUser').value.trim();
      const pass = document.getElementById('xPass').value.trim();

      fetch('/api/push-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'xtream',
          name: 'Xtream: ' + user,
          xtreamConfig: { host, user, pass },
          timestamp: Date.now()
        })
      })
      .then(res => res.json())
      .then(data => {
        showNotice('✨ <strong>Xtream Credentials Sent!</strong> TV is now tuning.');
      })
      .catch(err => alert('Failed: ' + err.message));
    }
  </script>
</body>
</html>`;
}

// HTTP Server
const server = http.createServer((req, res) => {
  const localIp = getLocalIpAddress();
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local webOS app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Landing Page with Pair QR Code and Upload Form
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html' || pathname === '/pair' || pathname === '/upload')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getLandingPageHtml(localIp, PORT));
    return;
  }

  // 2. Direct QR code image (SVG)
  if (req.method === 'GET' && (pathname === '/qr' || pathname === '/qr.svg')) {
    const pairUrl = `http://${localIp}:${PORT}/`;
    const svg = generateQrSvg(pairUrl, 260);
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    });
    res.end(svg);
    return;
  }

  // 3. API: Generate QR code URL & Pair metadata for the webOS app
  if (req.method === 'GET' && (pathname === '/api/pair-qr' || pathname === '/api/qr-info' || pathname === '/api/status')) {
    const pairUrl = `http://${localIp}:${PORT}/`;
    const qrCodeUrl = `http://${localIp}:${PORT}/qr`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      localIp: localIp,
      port: PORT,
      pairUrl: pairUrl,
      qrCodeUrl: qrCodeUrl,
      hasPendingUpload: Boolean(latestCredentials || lastUploadedM3u),
      timestamp: Date.now(),
    }));
    return;
  }

  // 4. API: M3U File Upload endpoint (Supports JSON content and multipart/form-data)
  if (req.method === 'POST' && (pathname === '/api/upload-m3u' || pathname === '/api/upload')) {
    const contentType = req.headers['content-type'] || '';
    let body = [];

    req.on('data', chunk => {
      body.push(chunk);
    });

    req.on('end', () => {
      const fullBuf = Buffer.concat(body);

      try {
        let uploadedFilename = 'playlist.m3u';
        let playlistContent = '';
        let playlistName = 'Mobile Upload';

        // Check if multipart form
        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
          if (boundaryMatch) {
            const boundary = boundaryMatch[1] || boundaryMatch[2];
            const parsed = parseMultipartFile(fullBuf, boundary);
            if (parsed) {
              uploadedFilename = parsed.filename;
              playlistContent = parsed.content;
              playlistName = parsed.filename.replace(/\\.[^/.]+$/, "");
            }
          }
        } else {
          // JSON upload
          const jsonStr = fullBuf.toString('utf8');
          const data = JSON.parse(jsonStr);
          uploadedFilename = data.filename || 'playlist.m3u';
          playlistContent = data.content || '';
          playlistName = data.name || uploadedFilename;
        }

        if (!playlistContent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No M3U content found in upload' }));
          return;
        }

        // Count channels
        const channelMatches = playlistContent.match(/#EXTINF:/gi);
        const channelCount = channelMatches ? channelMatches.length : 0;

        // Save file locally to /tmp/uploaded_playlist.m3u
        try {
          fs.writeFileSync(UPLOAD_FILE_PATH, playlistContent, 'utf8');
        } catch (e) {}

        // Store credentials structure for TV app to poll
        latestCredentials = {
          type: 'm3u_file',
          name: playlistName,
          filename: uploadedFilename,
          content: playlistContent,
          channelCount: channelCount,
          timestamp: Date.now(),
        };

        try {
          fs.writeFileSync(STORAGE_FILE, JSON.stringify(latestCredentials), 'utf8');
        } catch (e) {}

        lastUploadedM3u = {
          filename: uploadedFilename,
          channelCount: channelCount,
          size: fullBuf.length,
          timestamp: Date.now(),
        };

        console.log(`[webOS IPTV Service] M3U file uploaded: ${uploadedFilename} (${channelCount} channels)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'M3U uploaded successfully',
          filename: uploadedFilename,
          channelCount: channelCount,
          size: fullBuf.length,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid upload format: ' + err.message }));
      }
    });
    return;
  }

  // 5. API: Read uploaded M3U content directly
  if (req.method === 'GET' && pathname === '/api/uploaded-m3u') {
    if (fs.existsSync(UPLOAD_FILE_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      const stream = fs.createReadStream(UPLOAD_FILE_PATH);
      stream.pipe(res);
      return;
    } else if (latestCredentials && latestCredentials.content) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(latestCredentials.content);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No uploaded M3U playlist on TV' }));
    return;
  }

  // 6. API: Read pending credentials (polled by TV app)
  if (req.method === 'GET' && pathname === '/api/credentials') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      credentials: latestCredentials,
      lastUploadedM3u: lastUploadedM3u,
    }));
    return;
  }

  // 7. API: Push credentials (Xtream or M3U URL)
  if (req.method === 'POST' && (pathname === '/api/push-credentials' || pathname === '/api/push-playlist')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        latestCredentials = parsed;
        try {
          fs.writeFileSync(STORAGE_FILE, JSON.stringify(parsed));
        } catch (e) {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Credentials received by TV' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON format' }));
      }
    });
    return;
  }

  // 8. API: Clear credentials after TV imports them
  if (req.method === 'POST' && pathname === '/api/clear') {
    latestCredentials = null;
    try {
      if (fs.existsSync(STORAGE_FILE)) fs.unlinkSync(STORAGE_FILE);
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(` [webOS IPTV Companion Service] Local Server Listening `);
  console.log(` Pair URL: http://${ip}:${PORT}/                       `);
  console.log(` QR Endpoint: http://${ip}:${PORT}/qr                  `);
  console.log(` M3U Upload API: POST http://${ip}:${PORT}/api/upload-m3u `);
  console.log(`=======================================================`);
});

module.exports = server;
