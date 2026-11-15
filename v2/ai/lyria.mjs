// One music cue with Lyria (Google, lyria-3.5 through the Gemini API generateContent). Instrumental only.
//   node lyria.mjs <out-base> --prompt "..." | --prompt-file p.txt     -> <out-base>.<ext> (mp3 or wav, as returned)
// Needs GEMINI_API_KEY in the environment.
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const MODEL = process.env.LYRIA_MODEL || 'lyria-3.5';
const a = process.argv.slice(2), out = a[0];
let prompt = '';
for (let i = 1; i < a.length; i++) { if (a[i] === '--prompt') prompt = a[++i]; else if (a[i] === '--prompt-file') prompt = readFileSync(a[++i], 'utf8'); }
if (!out || !prompt) { console.error('usage: node lyria.mjs <out-base> --prompt "..."'); process.exit(1); }

const EXT = {'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/L16': 'pcm', 'audio/ogg': 'ogg', 'audio/flac': 'flac'};
for (let tries = 0; ; tries++) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {method: 'POST',
    headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({contents: [{role: 'user', parts: [{text: prompt.trim()}]}]})});
  const j = r.ok ? await r.json() : null;
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const au = parts.find((p) => p.inlineData?.data);
  if (au) {
    const mime = au.inlineData.mimeType.split(';')[0], f = `${out}.${EXT[mime] || 'bin'}`;
    mkdirSync(dirname(resolve(f)), {recursive: true});
    writeFileSync(f, Buffer.from(au.inlineData.data, 'base64'));
    const txt = parts.filter((p) => p.text).map((p) => p.text).join(' ').slice(0, 300);
    console.log('ok', f, au.inlineData.mimeType, txt ? `| ${txt}` : '');
    break;
  }
  const why = r.ok ? JSON.stringify(j).slice(0, 800) : `${r.status}: ${(await r.text()).slice(0, 800)}`;
  if (tries >= 2) { console.error('FAIL', why); process.exit(1); }
  console.error('retry', why.slice(0, 300));
  await new Promise((s) => setTimeout(s, 5000));
}
