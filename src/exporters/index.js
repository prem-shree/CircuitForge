// Browser exports. The SVG string is the single source for every format.
import { buildPDF } from './pdf.js';

const MAX_PIXELS = 12000 * 12000;

export function slug(s) {
  return String(s || 'circuit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'circuit';
}

export function download(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rasterize an SVG string. background: CSS color or null for transparent.
export async function svgToCanvas(svg, width, height, scale = 2, background = '#ffffff') {
  const s = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * s));
  canvas.height = Math.max(1, Math.round(height * s));
  const ctx = canvas.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not rasterize SVG')); img.src = url; });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

const canvasBlob = (canvas, type, quality) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, quality));

export async function toPNG(svg, w, h, { scale = 2, transparent = false } = {}) {
  return canvasBlob(await svgToCanvas(svg, w, h, scale, transparent ? null : '#ffffff'), 'image/png');
}

export async function toJPEG(svg, w, h, { scale = 2, quality = 0.95 } = {}) {
  return canvasBlob(await svgToCanvas(svg, w, h, scale, '#ffffff'), 'image/jpeg', quality);
}

export async function toPDF(svg, w, h, { scale = 4, title } = {}) {
  const canvas = await svgToCanvas(svg, w, h, scale, '#ffffff');
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2]; }
  // 1 CSS px = 0.75 pt
  const bytes = await buildPDF({ width: w * 0.75, height: h * 0.75, pw: canvas.width, ph: canvas.height, rgb, title });
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export async function copyPNG(svg, w, h, opts) {
  if (!window.ClipboardItem) throw new Error('This browser cannot copy images to the clipboard.');
  // Pass the promise directly so Safari keeps the user-gesture context.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPNG(svg, w, h, opts) })]);
}
