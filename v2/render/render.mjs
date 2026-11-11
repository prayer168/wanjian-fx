// Frame-by-frame offline render: serves v2/ over a local http server, opens a page with ?render=1,
// calls window.__renderFrame(i) for every 60fps frame, screenshots the 1920x1080 #view and pipes it to ffmpeg.
// Usage: node render.mjs [page=film/film.html?shot=act2] [out=../out/clip.mp4] [--frames N] [--from N] [--stills 0,300,900] [--png]
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdirSync, readFile} from 'node:fs';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const png = args.includes('--png') && args.splice(args.indexOf('--png'), 1);
const framesArg = flag('--frames');
const from = +(flag('--from') || 0);
const stills = (flag('--stills') || '').split(',').filter(Boolean).map(Number);
const pagePath = args[0] || 'film/film.html';
const out = resolve(here, args[1] || '../out/clip.mp4');
mkdirSync(dirname(out), {recursive: true});

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.vrm': 'application/octet-stream', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wav': 'audio/wav'};
const server = createServer((req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': TYPES[extname(p)] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/${pagePath}${pagePath.includes('?') ? '&' : '?'}render=1`;

const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.error('[page]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
await page.goto(url);
await page.waitForFunction(() => typeof window.__renderFrame === 'function', null, {timeout: 120000});
await page.evaluate(() => document.fonts.ready);
const total = framesArg ? +framesArg : await page.evaluate(() => window.__reelFrames);
const stage = page.locator('#view');
const done = async () => { await browser.close(); server.close(); };

if (stills.length) {
  // inspection mode: write numbered PNGs next to the output, no video
  for (const f of stills) {
    await page.evaluate((i) => window.__renderFrame(i), f);
    await stage.screenshot({path: out.replace(/\.mp4$/, '') + `-f${String(f).padStart(5, '0')}.png`});
  }
  await done();
  console.log('stills done');
  process.exit(0);
}

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
const t0 = Date.now();
for (let i = from; i < from + total; i++) {
  await page.evaluate((n) => window.__renderFrame(n), i);
  const shot = () => stage.screenshot(png ? {type: 'png', timeout: 180000} : {type: 'jpeg', quality: 94, timeout: 180000});
  let buf; try { buf = await shot(); } catch { await page.evaluate((n) => window.__renderFrame(n), i); buf = await shot(); }  // a slow GPU frame gets one redraw + retry
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if ((i - from) % 120 === 0) console.log(`frame ${i - from}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await done();
console.log('wrote', out);
