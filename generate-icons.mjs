import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  // Raw image data with filter byte 0 at start of each scanline
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let scanIdx = 0;
  for (let y = 0; y < height; y++) {
    scanlines[scanIdx++] = 0; // Filter: None
    const rowOffset = y * width * 4;
    rgba.copy(scanlines, scanIdx, rowOffset, rowOffset + width * 4);
    scanIdx += width * 4;
  }

  const compressed = zlib.deflateSync(scanlines);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function drawTvIcon(x, y, w, h) {
  // Normalized coords
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

  // Rounded rectangle check for badge
  const cornerR = 0.22;
  const inRect = nx > 0.08 && nx < 0.92 && ny > 0.08 && ny < 0.92;
  
  // Background gradient: Deep violet/indigo to electric cyan
  const grad = ny * 0.7 + nx * 0.3;
  let r = Math.round(20 + 35 * grad);
  let g = Math.round(15 + 90 * grad);
  let b = Math.round(55 + 180 * grad);

  // Play triangle in center:
  // Center roughly at 0.52, 0.50
  const px = nx - 0.44;
  const py = ny - 0.50;
  // Equilateral triangle pointing right
  const side = 0.28;
  const isInsideTriangle = (px > -0.06 && px < 0.22) && (Math.abs(py) < (0.22 - px) * 0.85);

  if (isInsideTriangle) {
    // Glowing cyan/white play icon
    return [255, 255, 255, 255];
  }

  // Border glow
  if (inRect && (nx < 0.12 || nx > 0.88 || ny < 0.12 || ny > 0.88)) {
    return [0, 210, 255, 240];
  }

  return [r, g, b, 255];
}

const icon80 = createPng(80, 80, drawTvIcon);
const icon130 = createPng(130, 130, drawTvIcon);

fs.writeFileSync('icon.png', icon80);
fs.writeFileSync('largeIcon.png', icon130);

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}
fs.writeFileSync('public/icon.png', icon80);
fs.writeFileSync('public/largeIcon.png', icon130);
console.log('Successfully generated webOS icon.png (80x80) and largeIcon.png (130x130)!');
