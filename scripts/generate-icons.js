#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT   = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ─── Inline PNG encoder (no deps) ───────────────────────────────────────────
function crc32(buf) {
  let c = 0xFFFFFFFF;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let k = 0; k < 8; k++) v = (v & 1) ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
    t[i] = v;
  }
  for (const b of buf) c = t[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t   = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(pixels, w, h) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(0); // filter type None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rows.push(pixels[i], pixels[i+1], pixels[i+2]);
    }
  }
  const raw  = Buffer.from(rows);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ─── Draw logo on a pixel buffer ─────────────────────────────────────────────
function drawLogo(size) {
  const px = new Uint8Array(size * size * 4);

  // Background gradient: top-left #4f46e5 → bottom-right #7c3aed
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * (size - 1));
      const r = Math.round(0x4f + (0x7c - 0x4f) * t);
      const g = Math.round(0x46 + (0x3a - 0x46) * t);
      const b = Math.round(0xe5 + (0xed - 0xe5) * t);
      const i = (y * size + x) * 4;
      px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=255;
    }
  }

  // Rounded corners mask
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x < radius ? radius : x > size-1-radius ? size-1-radius : x;
      const cy = y < radius ? radius : y > size-1-radius ? size-1-radius : y;
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy > radius*radius) {
        const i = (y * size + x) * 4;
        px[i+3] = 0;
      }
    }
  }

  const s = size;

  // Triangle vertices (centred, equilateral)
  const margin = s * 0.18;
  const cx = s / 2, cy = s / 2;
  const R  = s / 2 - margin;          // circumradius
  // top node, bottom-left, bottom-right (rotated so flat at bottom)
  const pts = [
    { x: cx,               y: cy - R              },  // top
    { x: cx - R*Math.sin(Math.PI/3), y: cy + R*0.5 }, // bottom-left
    { x: cx + R*Math.sin(Math.PI/3), y: cy + R*0.5 }  // bottom-right
  ];

  // Draw anti-aliased line using Xiaolin Wu approximation
  function setPixelBlend(px, x, y, br, w, h) {
    if (x < 0||x>=w||y < 0||y>=h) return;
    const i = (y*w+x)*4;
    const a = Math.round(br*255);
    // blend white over existing pixel
    px[i]   = Math.min(255, px[i]   + Math.round((255-px[i])   * br));
    px[i+1] = Math.min(255, px[i+1] + Math.round((255-px[i+1]) * br));
    px[i+2] = Math.min(255, px[i+2] + Math.round((255-px[i+2]) * br));
    px[i+3] = 255;
  }

  function drawThickLine(x0,y0,x1,y1,thick) {
    const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
    const nx=-dy/len, ny=dx/len;
    const steps=Math.ceil(len*2);
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const bx=x0+dx*t, by=y0+dy*t;
      for(let r=-thick;r<=thick;r++){
        const px2=Math.round(bx+nx*r), py2=Math.round(by+ny*r);
        if(px2>=0&&px2<s&&py2>=0&&py2<s){
          const br=1-Math.max(0,Math.abs(r)-thick+1);
          setPixelBlend(px,px2,py2,br,s,s);
        }
      }
    }
  }

  // Line thickness
  const lw = Math.max(2, s * 0.045);
  drawThickLine(pts[0].x, pts[0].y, pts[1].x, pts[1].y, lw);
  drawThickLine(pts[1].x, pts[1].y, pts[2].x, pts[2].y, lw);
  drawThickLine(pts[2].x, pts[2].y, pts[0].x, pts[0].y, lw);

  // Draw filled circles at each vertex (nodes)
  const nr = Math.max(3, s * 0.085); // node radius
  for (const pt of pts) {
    for (let y = Math.floor(pt.y - nr - 1); y <= Math.ceil(pt.y + nr + 1); y++) {
      for (let x = Math.floor(pt.x - nr - 1); x <= Math.ceil(pt.x + nr + 1); x++) {
        if (x<0||x>=s||y<0||y>=s) continue;
        const dx = x - pt.x, dy = y - pt.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const br = Math.max(0, Math.min(1, nr - dist + 0.5));
        if (br > 0) setPixelBlend(px, x, y, br, s, s);
      }
    }
  }

  return px;
}

// ─── Generate all sizes ───────────────────────────────────────────────────────
for (const size of SIZES) {
  const pixels = drawLogo(size);
  const png    = makePNG(pixels, size, size);
  const file   = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✅ icon-${size}.png (${png.length} bytes)`);
}
console.log('🎉 Done');
