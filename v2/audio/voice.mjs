// Voices for the two leads with Gemini 3.8 Flash TTS (Google). Each character gets a designed voice (Taiwanese-accented Mandarin);
// every line is synthesized on its own with a delivery style that follows the fight (panting, roaring, sneering, respectful).
// Needs GEMINI_API_KEY in the environment. Designed voice ids are kept in audio/voices.json; audio is cached in out/audio/vo/.
//   node voice.mjs            create voices if needed, synthesize every line that isn't cached
//   node voice.mjs --redo id  re-synthesize one line
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {LINES} from './lines.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const API = 'https://generativelanguage.googleapis.com/v1beta', MODEL = 'gemini-3.8-flash-tts';
const VFILE = resolve(here, 'voices.json'), OUT = resolve(here, '../out/audio/vo');
mkdirSync(OUT, {recursive: true});

/* permanent traits only; emotion goes in each line's style */
const PERSONA = {
  S: {name: '劍客', gender: 'male', desc: '二十多歲的年輕劍客，說國語帶自然的台灣腔。聲音清亮乾淨、中高音、咬字俐落，語氣裡帶一點瀟灑和傲氣。'},
  M: {name: '武僧', gender: 'male', desc: '四十多歲的少林武僧，說國語帶自然的台灣腔。聲音低沉渾厚、胸腔共鳴很強、沉穩有威嚴，發功時聲如洪鐘。'},
};

async function call(path, body) {
  const r = await fetch(`${API}/${path}`, {method: 'POST', headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 600)}`);
  return r;
}

async function voices() {
  const v = existsSync(VFILE) ? JSON.parse(readFileSync(VFILE, 'utf8')) : {};
  for (const [k, p] of Object.entries(PERSONA)) {
    if (v[k]) continue;
    const res = await (await call('voices', {store: true, voice: {model: MODEL, type: 'prompted', display_name: `wanjian-${k}`, gender: p.gender, language_code: 'zh-TW', prompted: {input: p.desc}}})).json();
    v[k] = res.id || res.name;
    if (res.sample_audio?.data) writeFileSync(resolve(OUT, `_sample-${k}.wav`), Buffer.from(res.sample_audio.data, 'base64'));
    console.log('designed voice', k, v[k]);
  }
  writeFileSync(VFILE, JSON.stringify(v, null, 1));
  return v;
}

/* pull the WAV out of whatever shape the interactions response takes */
function findAudio(o) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.data === 'string' && o.data.length > 1000) return o.data;
  for (const k of Object.keys(o)) { const f = findAudio(o[k]); if (f) return f; }
  return null;
}
async function speak(voice, text, style) {
  const r = await call('interactions', {model: MODEL, input: [{type: 'user_input', content: [{type: 'text', text, annotations: [{type: 'speech_metadata', style}]}]}],
    response_format: {type: 'audio', mime_type: 'audio/wav'}, generation_config: {speech_config: [{voice}]}});
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('audio')) return Buffer.from(await r.arrayBuffer());
  const j = await r.json(), b64 = findAudio(j);
  if (!b64) throw new Error('no audio in response: ' + JSON.stringify(j).slice(0, 400));
  return Buffer.from(b64, 'base64');
}

const redo = process.argv.includes('--redo') ? process.argv[process.argv.indexOf('--redo') + 1] : null;
const V = await voices();
for (const L of LINES) {
  const h = createHash('md5').update(`${V[L.who]}|${L.text}|${L.style}`).digest('hex').slice(0, 8), f = resolve(OUT, `${L.id}.wav`), hf = f + '.key';
  if (existsSync(f) && existsSync(hf) && readFileSync(hf, 'utf8') === h && redo !== L.id) continue;
  for (let tries = 0; ; tries++) {
    try { writeFileSync(f, await speak(V[L.who], L.text, L.style)); writeFileSync(hf, h); console.log('ok', L.id, L.text); break; }
    catch (e) { if (tries >= 2) { console.error('FAIL', L.id, e.message); break; } await new Promise((r) => setTimeout(r, 3000)); }
  }
}
