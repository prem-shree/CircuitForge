// Minimal single-page PDF writer embedding a lossless (Flate) RGB image.
// ponytail: raster PDF (rendered from the SVG at high DPI); switch to svg2pdf.js
// if true vector PDF output is needed (it brings font-embedding work for Ω/µ).

async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const enc = new TextEncoder();

// width/height: page size in points; rgb: Uint8Array of pw*ph*3.
export async function buildPDF({ width, height, pw, ph, rgb, title = 'CircuitForge schematic' }) {
  const img = await deflate(rgb);
  const chunks = [];
  const offsets = [];
  let pos = 0;
  const put = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    chunks.push(b);
    pos += b.length;
  };
  const obj = (n, body) => { offsets[n] = pos; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  const esc = (s) => String(s).replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '?');
  const W = +width.toFixed(2), H = +height.toFixed(2);

  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    put(`<< /Type /XObject /Subtype /Image /Width ${pw} /Height ${ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`);
    put(img);
    put('\nendstream');
  });
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => put(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  obj(6, () => put(`<< /Title (${esc(title)}) /Producer (CircuitForge) >>`));
  const xref = pos;
  put(`xref\n0 7\n0000000000 65535 f \n`);
  for (let i = 1; i <= 6; i++) put(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  put(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
