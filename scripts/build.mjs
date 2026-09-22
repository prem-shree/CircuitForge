// Builds the static site into dist/ (works on GitHub Pages, any static host,
// and when opening dist/index.html directly from disk).
//   node scripts/build.mjs          -> dist/
//   node scripts/build.mjs --serve  -> rebuild on change + http://localhost:8080
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const serve = process.argv.includes('--serve');
execFileSync(process.execPath, ['scripts/build-symbols.mjs'], { stdio: 'inherit' });
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
fs.cpSync('public', 'dist', { recursive: true });
fs.cpSync('examples', 'dist/examples', { recursive: true });
// Bundled third-party symbols (MIT) must ship with their notice.
fs.copyFileSync('src/symbols/LICENSE-electronic-symbols.txt', 'dist/LICENSE-electronic-symbols.txt');
fs.copyFileSync('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');

const options = {
  entryPoints: { app: 'src/ui/main.js' },
  bundle: true,
  format: 'iife', // classic script: runs from file:// too
  target: ['es2020'],
  outdir: 'dist',
  minify: !serve,
  sourcemap: serve ? 'inline' : false,
  legalComments: 'none',
  banner: { js: '/*! CircuitForge. Includes schematic symbols from chris-pikul/electronic-symbols, MIT License, (c) 2022 Chris Pikul. See LICENSE-electronic-symbols.txt */' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: Number(process.env.PORT) || 8080 });
  console.log(`CircuitForge dev server: http://localhost:${port}`);
} else {
  await esbuild.build(options);
  fs.writeFileSync('dist/.nojekyll', '');
  console.log('built dist/');
}
