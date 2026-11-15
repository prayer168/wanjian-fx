// Keyframes and costume sheets with Nano Banana Pro (Google, gemini-3-pro-image). One still per shot; reference images keep the
// two leads looking the same from shot to shot. Needs GEMINI_API_KEY in the environment (never written to disk).
//   node keyframe.mjs <out.png> --prompt "..." | --prompt-file p.txt  [--ref a.png --ref b.png]  [--aspect 16:9]  [--size 2K]
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const API = 'https://generativelanguage.googleapis.com/v1beta', MODEL = process.env.KEYFRAME_MODEL || 'gemini-3-pro-image';

const a = process.argv.slice(2), out = a[0], refs = [];
let prompt = '', aspect = '16:9', size = '2K';
for (let i = 1; i < a.length; i++) {
  if (a[i] === '--prompt') prompt = a[++i];
  else if (a[i] === '--prompt-file') prompt = readFileSync(a[++i], 'utf8');
  else if (a[i] === '--ref') refs.push(a[++i]);
  else if (a[i] === '--aspect') aspect = a[++i];
  else if (a[i] === '--size') size = a[++i];
}
if (!out || !prompt) { console.error('usage: node keyframe.mjs <out.png> --prompt "..." [--ref img]...'); process.exit(1); }

const MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'};
const parts = [...refs.map((f) => ({inlineData: {mimeType: MIME[extname(f).toLowerCase()] || 'image/png', data: readFileSync(f).toString('base64')}})), {text: prompt.trim()}];
const body = {contents: [{role: 'user', parts}], generationConfig: {responseModalities: ['IMAGE'], imageConfig: {aspectRatio: aspect, imageSize: size}}};

for (let tries = 0; ; tries++) {
  const r = await fetch(`${API}/models/${MODEL}:generateContent`, {method: 'POST', headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const j = r.ok ? await r.json() : null;
  const img = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (img) {
    mkdirSync(dirname(resolve(out)), {recursive: true});
    writeFileSync(out, Buffer.from(img.inlineData.data, 'base64'));
    console.log('ok', out, img.inlineData.mimeType);
    break;
  }
  const why = r.ok ? JSON.stringify(j).slice(0, 600) : `${r.status}: ${(await r.text()).slice(0, 600)}`;
  if (tries >= 2) { console.error('FAIL', why); process.exit(1); }
  console.error('retry', why.slice(0, 200));
  await new Promise((s) => setTimeout(s, 4000));
}
