// Monday 23 November 2026, drawn as one newspaper page.
// A single-file renderer: it paints 36 dated stories onto a
// 1024 by 1024 canvas and saves a PNG. No network, no clock,
// no randomness - the same bytes come out on every run.
// The page is built from the 23 November news dossier:
// 3 lead stories, 10 small stories, 23 more in the list,
// a dotted world map with 12 numbered pins, and a red-framed
// box naming the big stories that are NOT from this date.
// The wide banner illustration (hero.png) is an original
// flat-vector triptych made for this page: the chip rally,
// the empty climate hall, and the drone boat at sea.

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const IMG_W = 1024;
const IMG_H = 1024;
const MARGIN = 16;
const PAGE_W = IMG_W - MARGIN * 2;

type Colour = [r: number, g: number, b: number];

const PAPER: Colour = [250, 245, 232];
const SHEET: Colour = [253, 250, 238];
const INK: Colour = [26, 26, 28];
const CRIMSON: Colour = [164, 32, 28];
const CRIMSON_DEEP: Colour = [126, 22, 22];
const NAVY: Colour = [30, 48, 88];
const STEEL: Colour = [62, 114, 168];
const PALE_SKY: Colour = [210, 229, 240];
const LEAF: Colour = [92, 144, 92];
const AMBER: Colour = [205, 152, 46];
const TANGERINE: Colour = [228, 114, 34];
const STONE: Colour = [124, 122, 114];
const SAND: Colour = [232, 222, 196];
const CHARCOAL: Colour = [40, 40, 42];
const SNOW: Colour = [255, 255, 255];
const GREEN: Colour = [34, 139, 74];

// ------------------------------------------------------------------
// Letterforms. Every glyph is seven rows tall and five pixels wide,
// stored as one number per row: the top bit is the leftmost pixel.
// Capitals fill all seven rows, small letters sit on rows two to
// six, and the tails of g, j, p, q and y drop into the last row.
// ------------------------------------------------------------------
type Glyph = readonly number[];
const FONT: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x08, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x11, 0x11],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1e, 0x08, 0x08, 0x08, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ";": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "*": [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  "~": [0x00, 0x00, 0x00, 0x0a, 0x15, 0x00, 0x00],
  "^": [0x04, 0x0a, 0x11, 0x00, 0x00, 0x00, 0x00],
  "|": [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  "·": [0x00, 0x00, 0x00, 0x0c, 0x0c, 0x00, 0x00],
  "—": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
};

// ------------------------------------------------------------------
// Canvas: one RGB byte buffer, plus the drawing primitives.
// ------------------------------------------------------------------
const px = new Uint8Array(IMG_W * IMG_H * 3);

function setPixel(x: number, y: number, c: Colour): void {
  if (x < 0 || y < 0 || x >= IMG_W || y >= IMG_H) return;
  const i = (y * IMG_W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: Colour): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(IMG_W, x + w);
  const y1 = Math.min(IMG_H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * IMG_W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function frame(x: number, y: number, w: number, h: number, c: Colour, t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, w: number, c: Colour): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: Colour): void {
  fillRect(x, y, 1, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: Colour): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: Colour): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circle(cx: number, cy: number, r: number, c: Colour): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Colour): void {
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(IMG_W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(IMG_H - 1, Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x - x0) * (y2 - y0) - (y - y0) * (x2 - x0)) / d;
      const b = ((x - x1) * (y0 - y1) - (y - y1) * (x0 - x1)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPixel(x, y, c);
    }
  }
}

// ------------------------------------------------------------------
// Text engine. One glyph cell is 6*scale wide (5 pixels + spacing)
// and 7*scale tall. Bold draws each lit pixel twice, one pixel to
// the right, which thickens the stroke without widening the cell.
// ------------------------------------------------------------------
function normalise(s: string): string {
  return s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–]/g, "-");
}

function glyphFor(ch: string): Glyph {
  return FONT[ch] ?? FONT["?"] ?? FONT[" "];
}

function drawGlyph(x: number, y: number, ch: string, scale: number, c: Colour, bold: boolean): void {
  const g = glyphFor(ch);
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if ((row >> (4 - col)) & 1) {
        const bx = x + col * scale;
        const by = y + r * scale;
        fillRect(bx, by, scale, scale, c);
        if (bold) fillRect(bx + scale, by, 1, scale, c);
      }
    }
  }
}

function textWidth(s: string, scale: number): number {
  return normalise(s).length * 6 * scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: Colour, bold = false): void {
  const t = normalise(s);
  for (let i = 0; i < t.length; i++) {
    drawGlyph(x + i * 6 * scale, y, t[i], scale, c, bold);
  }
}

function drawTextCentred(cx: number, y: number, s: string, scale: number, c: Colour, bold = false): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c, bold);
}

function drawTextRight(xRight: number, y: number, s: string, scale: number, c: Colour, bold = false): void {
  drawText(xRight - textWidth(s, scale), y, s, scale, c, bold);
}

function lineHeight(scale: number): number {
  return 7 * scale + 2;
}

// Greedy word wrap. Returns lines that fit maxChars characters.
function wrap(text: string, maxChars: number): string[] {
  const words = normalise(text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    const next = cur ? cur + " " + w : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draws wrapped text inside a column; returns the height used.
function drawWrapped(
  x: number,
  y: number,
  text: string,
  scale: number,
  c: Colour,
  colWidth: number,
  maxLines = 99,
  bold = false,
): number {
  const maxChars = Math.max(1, Math.floor(colWidth / (6 * scale)));
  const lines = wrap(text, maxChars).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lineHeight(scale), lines[i], scale, c, bold);
  }
  return lines.length * lineHeight(scale);
}

// ------------------------------------------------------------------
// PNG writer: filter byte zero per scanline, zlib level 9, CRC32
// computed by hand. Deterministic - same input, same bytes.
// ------------------------------------------------------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(tag: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(tag, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tag, "ascii"), data])) >>> 0, 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const stride = 1 + IMG_W * 3;
  const raw = Buffer.alloc(IMG_H * stride);
  for (let y = 0; y < IMG_H; y++) {
    raw[y * stride] = 0;
    raw.set(px.subarray(y * IMG_W * 3, (y + 1) * IMG_W * 3), y * stride + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(IMG_W, 0);
  ihdr.writeUInt32BE(IMG_H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------
// PNG reader for the hero illustration: 8-bit RGB or RGBA,
// non-interlaced, all five scanline filters. Returns plain RGB.
// ------------------------------------------------------------------
interface DecodedImage {
  w: number;
  h: number;
  rgb: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf: Buffer): DecodedImage {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error("hero.png: bad PNG signature");
  let off = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Buffer[] = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (tag === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (tag === "IDAT") {
      idatParts.push(Buffer.from(data));
    } else if (tag === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`hero.png: unsupported PNG (depth ${bitDepth}, type ${colorType}, interlace ${interlace})`);
  }
  const bpp = colorType === 2 ? 3 : 4;
  const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  if (raw.length < (stride + 1) * h) throw new Error("hero.png: short IDAT");
  const rgb = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const v = raw[rowStart + i];
      if (filter === 0) cur[i] = v;
      else if (filter === 1) cur[i] = (v + a) & 0xff;
      else if (filter === 2) cur[i] = (v + b) & 0xff;
      else if (filter === 3) cur[i] = (v + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) cur[i] = (v + paeth(a, b, c)) & 0xff;
      else throw new Error(`hero.png: unknown filter ${filter}`);
    }
    for (let x = 0; x < w; x++) {
      const si = x * bpp;
      const di = (y * w + x) * 3;
      rgb[di] = cur[si];
      rgb[di + 1] = cur[si + 1];
      rgb[di + 2] = cur[si + 2];
    }
    prev = cur;
  }
  return { w, h, rgb };
}

// Nearest-neighbour blit of a source rectangle onto a destination
// rectangle. Fixed-point, deterministic, no smoothing.
function blit(
  src: DecodedImage,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  for (let yy = 0; yy < dh; yy++) {
    const syy = sy + Math.floor((yy * sh) / dh);
    for (let xx = 0; xx < dw; xx++) {
      const sxx = sx + Math.floor((xx * sw) / dw);
      const si = (syy * src.w + sxx) * 3;
      setPixel(dx + xx, dy + yy, [src.rgb[si], src.rgb[si + 1], src.rgb[si + 2]]);
    }
  }
}

// ------------------------------------------------------------------
// Dotted world map: 12 rows of 62 cells, "#" is land. Rows run from
// about 75N at the top to about 55S at the bottom.
// ------------------------------------------------------------------
const MAP_ROWS: string[] = [
  "    ######                  ##############  ######################    ",
  "   #########              ##########################################  ",
  "    ##########      ###  #########################################    ",
  "     #########     ####  ####  ##################################     ",
  "      ######       ####   ###   ########  ####################        ",
  "       ####   ##   #####   ##    ######   ##########  ####            ",
  "        ##    #####  ####        ####     ####   ####  ##             ",
  "             #####  ###          ##       ##    ####                 ",
  "              ####  ##           ##       #########  ###             ",
  "              ###   #                     ########  ##               ",
  "               ##                          ######                    ",
  "               #                            ####                     ",
];

interface Pin {
  n: number;
  lon: number;
  lat: number;
  name: string;
}

const PINS: Pin[] = [
  { n: 1, lon: 30.5, lat: 50.4, name: "KYIV" },
  { n: 2, lon: 20.1, lat: 32.1, name: "BENGHAZI" },
  { n: 3, lon: 30.7, lat: 36.9, name: "ANTALYA" },
  { n: 4, lon: 4.4, lat: 50.9, name: "BRUSSELS" },
  { n: 5, lon: 106.0, lat: -6.1, name: "BANTEN" },
  { n: 6, lon: 56.5, lat: 26.6, name: "HORMUZ" },
  { n: 7, lon: 34.5, lat: 31.5, name: "GAZA" },
  { n: 8, lon: -107.4, lat: 24.8, name: "SINALOA" },
  { n: 9, lon: 127.0, lat: 37.5, name: "SEOUL" },
  { n: 10, lon: -74.1, lat: 4.7, name: "BOGOTA" },
  { n: 11, lon: 29.0, lat: 41.0, name: "ISTANBUL" },
  { n: 12, lon: -74.0, lat: 40.7, name: "NEW YORK" },
];

// ------------------------------------------------------------------
// The news of Monday 23 November 2026, as reported that day.
// Leads 01-03, small stories 04-13, the numbered list 14-36.
// ------------------------------------------------------------------
interface Lead {
  n: string;
  kicker: string;
  colour: Colour;
  headline: string;
  deck: string;
  body: string;
  source: string;
}

const LEADS: Lead[] = [
  {
    n: "01",
    kicker: "MARKETS + TECH",
    colour: NAVY,
    headline: "HUANG IS BACK",
    deck: "NVIDIA +31% IN A DAY",
    body: "Nvidia's board reinstates Jensen Huang as chief executive, 11 days after he quit. Shares jump about 31% - the best day since 2003 - adding $952bn in value. The Nasdaq gains 6.5%.",
    source: "Sources: Reuters, AP",
  },
  {
    n: "02",
    kicker: "CLIMATE",
    colour: LEAF,
    headline: "COP31 COLLAPSES",
    deck: "NO DEAL IN ANTALYA",
    body: "The UN climate talks in Antalya end with no deal - the first failure since 2009 - after the EU rejects a final text silent on fossil fuels. The longest summit on record runs 50+ hours over time.",
    source: "Sources: BBC, AP",
  },
  {
    n: "03",
    kicker: "WAR AT SEA",
    colour: CRIMSON,
    headline: "WAR AT SEA",
    deck: "SEVEN DRONES, ONE WARSHIP",
    body: "Ukraine says seven naval drones sank the Russian corvette Merkury off Libya, and hit the cargo ship Angara. Kyiv says the ship carried weapons. The UN mission in Libya calls for an independent probe.",
    source: "Sources: Reuters, Zelenskyy",
  },
];

interface Small {
  n: string;
  kicker: string;
  colour: Colour;
  title: string;
  body: string;
}

const SMALLS: Small[] = [
  { n: "04", kicker: "EUROPE", colour: CRIMSON, title: "KYIV REGION HIT", body: "Strikes kill 15+ in Kyiv region; a boy, 7, is freed from rubble." },
  { n: "05", kicker: "MIDDLE EAST", colour: TANGERINE, title: "SANCTIONS ON IRAN", body: "US hits 2 dozen+ Iranian exchange houses and front firms." },
  { n: "06", kicker: "MIDDLE EAST", colour: TANGERINE, title: "HORMUZ STANDOFF", body: "Iran vows to counter the US blockade 'by all means'." },
  { n: "07", kicker: "ASIA-PACIFIC", colour: STEEL, title: "BANTEN FIRE", body: "Candy factory fire in West Java kills 24; about 30 are missing." },
  { n: "08", kicker: "EUROPE", colour: CRIMSON, title: "BELGIUM GROUNDED", body: "Strike shuts airports 7am-9pm; 429 flights, 59,500 hit." },
  { n: "09", kicker: "EUROPE", colour: CRIMSON, title: "EU SANCTIONS PLAN", body: "EU plan hits 60 banks, crypto sites and 70 shadow-fleet ships." },
  { n: "10", kicker: "ASIA-PACIFIC", colour: STEEL, title: "NEPAL AID $1.62BN", body: "India offers Nepal $1.62bn to rebuild after the August floods." },
  { n: "11", kicker: "LATIN AMERICA", colour: AMBER, title: "CHAPO ISIDRO HELD", body: "Mexico captures 'El Chapo Isidro'; 17 die in cartel violence." },
  { n: "12", kicker: "MARKETS + TECH", colour: NAVY, title: "BITCOIN NEAR $61K", body: "Bitcoin holds near $61,000 after a slide to $55,100." },
  { n: "13", kicker: "ASIA-PACIFIC", colour: STEEL, title: "SEOUL MINISTER QUITS", body: "Education minister quits over exam-cheating chaos; 111 caught." },
];

const ALSO: string[] = [
  "Iran flogs singer Parastoo Ahmadi and 4 band members, 74 lashes each, over a 2024 concert without a hijab.",
  "Finland summons Russia's ambassador; Moscow warns Estonia's border closure verges on open war.",
  "NATO meets in Brussels over Russian missiles that came down in Poland last week.",
  "Gaza: toxic contamination across 99% of the strip, Oxfam report warns of health risks for generations.",
  "Kenya and DR Congo restore full diplomatic ties after a 2023 fallout over the M23 rebellion.",
  "Saudi strike on Yemen's Hodeida kills 4 and wounds 18, Houthi media report.",
  "Manchester arena evacuated after tear gas at a concert; 12,000 out, 50+ assessed, 1 in hospital.",
  "Amtrak train derails in Louisiana after hitting a truck; 5 hurt, 95 aboard, probe under way.",
  "A lion is on the loose on Istanbul's outskirts; police hunt it with thermal imaging.",
  "Thousands rally in Istanbul against the crackdown on the opposition and independent media.",
  "Nigeria's Tinubu: the presidential villa itself suffers water and power cuts.",
  "Hungary's PM Magyar to visit Transcarpathia, the first such visit since 2015.",
  "Kim Jong-un rebuffs Trump's talks offer and stresses sovereignty, state media say.",
  "Netanyahu urges Trump to strike Iran soon, Israel's Kan broadcaster reports.",
  "Poland: Russia tried to kill rapper Kyivstoner twice, Warsaw says; Denmark expels a diplomat.",
  "US Army to detonate bomb chemicals in Iowa despite a court hold; locals fear toxic fallout.",
  "WHO: fighting disrupts the Ebola response in DR Congo; 5,678 dead of 11,613 cases.",
  "Nine shot at a California concert, one in critical condition; no arrests announced.",
  "Sydney trial: prosecution says a double murder was an execution, not self-defence.",
  "South Korea: the Gulf of Aden deployment is not indirect war participation, minister says.",
  "Cameroon's ex-rebels caught between hiding and broken promises after a decade of war.",
  "China, South Korea and Taiwan step in to support markets after the AI stock sell-off.",
  "'Hunger Games' opens to $120m, a day after GTA VI launches; Greece renews the Marbles call.",
];

const STATS: { num: string; label: string; colour: Colour }[] = [
  { num: "+31%", label: "NVIDIA BEST DAY SINCE 2003", colour: GREEN },
  { num: "7", label: "DRONES SANK THE MERKURY", colour: CRIMSON },
  { num: "15+", label: "KILLED IN KYIV REGION", colour: CRIMSON },
  { num: "24", label: "KILLED, BANTEN FIRE", colour: CRIMSON },
  { num: "59,500", label: "TRAVELLERS HIT IN BELGIUM", colour: CRIMSON },
  { num: "$1.62BN", label: "INDIA AID TO NEPAL", colour: CRIMSON },
];

const REGIONS: { name: string; colour: Colour }[] = [
  { name: "NORTH AMERICA", colour: NAVY },
  { name: "EUROPE", colour: CRIMSON },
  { name: "MIDDLE EAST", colour: TANGERINE },
  { name: "ASIA-PACIFIC", colour: STEEL },
  { name: "AFRICA", colour: LEAF },
  { name: "LATIN AMERICA", colour: AMBER },
  { name: "MARKETS + TECH", colour: CHARCOAL },
];

// ------------------------------------------------------------------
// Page composition. A vertical cursor walks down the sheet; every
// section reports the height it used. Nothing here reads the clock,
// the network, or any random source.
// ------------------------------------------------------------------
function sectionHead(y: number, text: string): number {
  drawText(MARGIN, y, text, 2, CRIMSON, true);
  hline(MARGIN, y + 18, PAGE_W, INK);
  return y + 22;
}

function compose(hero: DecodedImage): number {
  fillRect(0, 0, IMG_W, IMG_H, PAPER);
  fillRect(MARGIN, MARGIN, PAGE_W, IMG_H - 2 * MARGIN, SHEET);
  frame(MARGIN, MARGIN, PAGE_W, IMG_H - 2 * MARGIN, INK, 2);

  let y = MARGIN + 10;

  // Kicker bar.
  fillRect(MARGIN, y, PAGE_W, 22, CRIMSON);
  drawText(MARGIN + 10, y + 4, "THE WORLD IN ONE PAGE", 2, SNOW, true);
  drawTextRight(MARGIN + PAGE_W - 10, y + 4, "36 STORIES - 7 REGIONS", 2, SNOW, true);
  y += 22 + 4;

  // Masthead: the date, huge.
  drawTextCentred(IMG_W / 2, y, "MONDAY 23 NOVEMBER 2026", 6, INK, true);
  y += 44 + 2;
  drawTextCentred(IMG_W / 2, y, "ONE DAY. ONE PAGE. EVERY STORY THAT MATTERED.", 2, CRIMSON_DEEP, true);
  y += 16 + 4;

  // One-line sub-head.
  drawTextCentred(
    IMG_W / 2,
    y,
    "HUANG IS BACK - COP31 COLLAPSES - WAR AT SEA - KYIV HIT - BELGIUM GROUNDED",
    2,
    INK,
  );
  y += 16 + 4;

  // Stat strip: six boxes.
  const statW = 160;
  const statGap = 6;
  const statX0 = MARGIN + Math.floor((PAGE_W - (6 * statW + 5 * statGap)) / 2);
  for (let i = 0; i < STATS.length; i++) {
    const bx = statX0 + i * (statW + statGap);
    fillRect(bx, y, statW, 44, i % 2 === 0 ? SAND : SHEET);
    frame(bx, y, statW, 44, STONE, 1);
    drawTextCentred(bx + statW / 2, y + 4, STATS[i].num, 3, STATS[i].colour, true);
    drawTextCentred(bx + statW / 2, y + 31, STATS[i].label, 1, INK);
  }
  y += 44 + 4;

  // Region chips.
  let chipsW = 0;
  for (const r of REGIONS) chipsW += textWidth(r.name, 1) + 16;
  chipsW += (REGIONS.length - 1) * 6;
  let cx = MARGIN + Math.floor((PAGE_W - chipsW) / 2);
  for (const r of REGIONS) {
    const w = textWidth(r.name, 1) + 16;
    fillRect(cx, y, w, 20, r.colour);
    drawText(cx + 8, y + 6, r.name, 1, SNOW, true);
    cx += w + 6;
  }
  y += 20 + 4;

  // Hero banner: the original triptych, cropped to its middle band.
  frame(MARGIN, y, PAGE_W, 108, INK, 2);
  blit(hero, 0, 85, hero.w, 150, MARGIN + 2, y + 2, PAGE_W - 4, 104);
  y += 108 + 2;
  drawTextCentred(
    IMG_W / 2,
    y,
    "LEFT: HUANG RETURNS, NVIDIA SOARS. CENTRE: COP31 ENDS WITH NO DEAL. RIGHT: UKRAINE'S DRONES SINK THE MERKURY.",
    1,
    STONE,
  );
  y += 9 + 4;

  // Three lead stories.
  y = sectionHead(y, "THE THREE BIG STORIES");
  const colW = 320;
  const colGap = 16;
  const leadTop = y;
  let leadH = 0;
  for (let i = 0; i < LEADS.length; i++) {
    const L = LEADS[i];
    const lx = MARGIN + i * (colW + colGap);
    let ly = leadTop;
    drawText(lx, ly, `${L.n} - ${L.kicker}`, 1, L.colour, true);
    ly += 9 + 2;
    drawText(lx, ly, L.headline, 3, INK, true);
    ly += 23 + 2;
    drawText(lx, ly, L.deck, 2, CRIMSON, true);
    ly += 16 + 2;
    ly += drawWrapped(lx, ly, L.body, 1, INK, colW);
    ly += 2;
    drawText(lx, ly, L.source, 1, STONE);
    ly += 9;
    leadH = Math.max(leadH, ly - leadTop);
  }
  vline(MARGIN + colW + colGap / 2, leadTop, leadH, STONE);
  vline(MARGIN + 2 * colW + colGap + colGap / 2, leadTop, leadH, STONE);
  y = leadTop + leadH + 4;

  // Ten small stories, two rows of five.
  y = sectionHead(y, "MORE FROM MONDAY");
  const smallW = 192;
  const smallGap = 8;
  const smallTop = y;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      const s = SMALLS[row * 5 + col];
      const sx = MARGIN + col * (smallW + smallGap);
      const sy = smallTop + row * 63;
      drawText(sx, sy, `${s.n} - ${s.kicker}`, 1, s.colour, true);
      drawWrapped(sx, sy + 11, s.title, 2, INK, smallW, 2, true);
      drawWrapped(sx, sy + 11 + 32, s.body, 1, INK, smallW, 2);
    }
  }
  y = smallTop + 2 * 63 - 6 + 4;

  // World map with numbered pins.
  y = sectionHead(y, "WHERE IT HAPPENED");
  const mapX = MARGIN;
  const mapY = y;
  const mapH = 72;
  const cellW = PAGE_W / 62;
  const cellH = mapH / 12;
  fillRect(mapX, mapY, PAGE_W, mapH, PALE_SKY);
  frame(mapX, mapY, PAGE_W, mapH, STONE, 1);
  for (let r = 0; r < MAP_ROWS.length; r++) {
    const row = MAP_ROWS[r].padEnd(62, " ").slice(0, 62);
    for (let c = 0; c < 62; c++) {
      if (row[c] === "#") {
        fillRect(
          Math.round(mapX + c * cellW + cellW / 2 - 2),
          Math.round(mapY + r * cellH + cellH / 2 - 2),
          4,
          4,
          NAVY,
        );
      }
    }
  }
  for (let i = 0; i < PINS.length; i++) {
    const p = PINS[i];
    const col = ((p.lon + 180) / 360) * 62;
    const rowF = ((75 - p.lat) / 130) * 12;
    const dotX = Math.round(mapX + col * cellW);
    const dotY = Math.round(mapY + rowF * cellH);
    fillCircle(dotX, dotY, 4, CRIMSON);
    circle(dotX, dotY, 4, SNOW);
  }
  y = mapY + mapH + 2;
  drawTextCentred(
    IMG_W / 2,
    y,
    "1 KYIV  2 BENGHAZI  3 ANTALYA  4 BRUSSELS  5 BANTEN  6 HORMUZ  7 GAZA  8 SINALOA  9 SEOUL  10 BOGOTA  11 ISTANBUL  12 NEW YORK",
    1,
    INK,
  );
  y += 9 + 4;

  // The numbered list: the rest of the day.
  y = sectionHead(y, "ALSO ON MONDAY 23 NOVEMBER");
  for (let i = 0; i < ALSO.length; i++) {
    drawText(MARGIN, y, `${14 + i}.`, 1, CRIMSON, true);
    drawText(MARGIN + 30, y, ALSO[i], 1, INK);
    y += 8;
  }
  y += 2;

  // Date check: what was deliberately left out.
  frame(MARGIN, y, PAGE_W, 40, CRIMSON, 2);
  drawText(MARGIN + 8, y + 5, "DATE CHECK - WHAT WE LEFT OUT ON PURPOSE", 2, CRIMSON, true);
  drawText(
    MARGIN + 8,
    y + 23,
    "COP31 deadlock draft (22 Nov) - Huang resignation (12 Nov) - GTA VI launch (22 Nov): background, not 23 Nov news.",
    1,
    INK,
  );
  drawText(
    MARGIN + 8,
    y + 32,
    "Nepal earthquake reports dated 24 Nov: that story belongs to tomorrow's page, not this one.",
    1,
    INK,
  );
  y += 40 + 4;

  // Footer.
  drawTextCentred(
    IMG_W / 2,
    y,
    "Sources: Reuters - AP - BBC - Bloomberg - Daily Summary of World - BusinessWorld - The Company Chronicle.",
    1,
    STONE,
  );
  y += 9;
  drawTextCentred(
    IMG_W / 2,
    y,
    "Every story happened or was first reported on Monday 23 November 2026.",
    1,
    STONE,
  );
  y += 9;
  return y;
}

function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const hero = decodePng(fs.readFileSync(path.join(here, "hero.png")));
  console.log(`hero ${hero.w}x${hero.h}`);
  const endY = compose(hero);
  console.log(`page ends at y=${endY} of ${IMG_H} (stories: ${3 + SMALLS.length + ALSO.length})`);
  if (endY > IMG_H - MARGIN) throw new Error(`page overflow: ends at y=${endY}`);
  const out = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, out);
  const sum = crypto.createHash("md5").update(out).digest("hex");
  console.log(`entry.png ${out.length} bytes md5 ${sum} -> ${outPath}`);
}

main();
