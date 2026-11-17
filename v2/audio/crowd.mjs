// Crowd voices for the AI cut with Gemini 3.8 Flash TTS: the army on the plain and the townspeople of the cliff city, each a
// designed voice (Taiwanese-accented Mandarin). Every call is one short shout or murmur; ai/crowdmix.mjs layers them into a crowd.
// Needs GEMINI_API_KEY. Voice ids go into audio/voices.json next to the leads'; audio is cached in <VO_OUT>/crowd/.
//   VO_OUT=D:/wanjian-fx/v2-out/ai/vo node audio/crowd.mjs [--redo id]
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const API = 'https://generativelanguage.googleapis.com/v1beta', MODEL = 'gemini-3.8-flash-tts';
const VFILE = resolve(here, 'voices.json'), OUT = resolve(process.env.VO_OUT || resolve(here, '../out/audio/vo'), 'crowd');
mkdirSync(OUT, {recursive: true});

export const PERSONA = {
  G: {name: '將軍', gender: 'male', desc: '五十多歲的將軍，說國語帶台灣腔。聲音粗啞宏亮、中氣十足，說話威嚴有力。'},
  A: {name: '老兵', gender: 'male', desc: '三十多歲的粗獷士兵，說國語帶台灣腔。嗓門很大、聲音沙啞低沉。'},
  B: {name: '小兵', gender: 'male', desc: '十九歲的年輕士兵，說國語帶台灣腔。聲音偏高、還帶點少年氣，容易緊張。'},
  W: {name: '老婦', gender: 'female', desc: '六十多歲的老婦人，說國語帶台灣腔。聲音沙啞、溫和，說話慢。'},
  F: {name: '父親', gender: 'male', desc: '三十歲左右的年輕父親，說國語帶台灣腔。聲音平實、溫暖，普通老百姓。'},
  T: {name: '鐵匠', gender: 'male', desc: '四十多歲的鐵匠，說國語帶台灣腔。身材壯碩，聲音粗厚、宏亮。'},
  C: {name: '女孩', gender: 'female', desc: '六歲的小女孩，說國語帶台灣腔。童聲，清脆稚嫩、音調很高。'},
};

/* group: army (on the plain, far from camera except s28/s42) or town (in the streets under the dome) */
export const WALLA = [
  /* s28: the army draws */
  {id: 'g_draw', who: 'G', text: '弓——拉滿——！', style: '戰場上對千軍萬馬下令，拉長音、聲嘶力竭地大吼'},
  {id: 'g_loose', who: 'G', text: '放箭——！', style: '戰場上對千軍萬馬下令，拉長音、聲嘶力竭地大吼'},
  {id: 'a_he', who: 'A', text: '喝！', style: '士兵齊聲吶喊，短促有力，用盡全力'},
  {id: 'b_he', who: 'B', text: '喝！', style: '士兵齊聲吶喊，短促有力，用盡全力'},
  {id: 'a_sha', who: 'A', text: '殺——！', style: '衝鋒前的怒吼，拉長音，殺氣騰騰'},
  {id: 'b_sha', who: 'B', text: '殺——！', style: '衝鋒前的怒吼，拉長音，殺氣騰騰'},
  {id: 'g_sha', who: 'G', text: '殺——！', style: '衝鋒前的怒吼，拉長音，殺氣騰騰'},
  /* s29: fire from the sky over the town */
  {id: 'w_fire', who: 'W', text: '天啊……是火箭！', style: '抬頭看見滿天火光，驚恐地叫出來'},
  {id: 'f_run', who: 'F', text: '快！快進屋！', style: '驚慌地大喊，催促家人逃命'},
  {id: 't_hide', who: 'T', text: '躲起來！都躲起來！', style: '在街上對眾人大吼，聲音急促'},
  {id: 'c_dad', who: 'C', text: '爹——！', style: '小女孩嚇哭了，尖聲叫爸爸'},
  {id: 'w_scream', who: 'W', text: '啊——！', style: '驚恐的尖叫'},
  {id: 'f_scream', who: 'F', text: '啊——！', style: '驚恐的大叫'},
  {id: 'b_scream', who: 'B', text: '啊——！', style: '驚恐的大叫'},
  /* s32–s33: the golden bell holds */
  {id: 'w_bell', who: 'W', text: '金鐘……是金鐘……', style: '仰望天空，敬畏又不敢相信，輕聲喃喃'},
  {id: 'f_buddha', who: 'F', text: '佛祖顯靈了……', style: '抬頭看著金光，聲音發抖，又驚又喜'},
  {id: 'c_look', who: 'C', text: '爹，你看！好亮喔！', style: '小女孩興奮又好奇，指著天空'},
  {id: 't_held', who: 'T', text: '擋住了……真的擋住了！', style: '不敢相信，從低聲到激動'},
  {id: 'w_amituofo', who: 'W', text: '阿彌陀佛……阿彌陀佛……', style: '雙手合十，虔誠地低聲唸佛'},
  {id: 'f_wow', who: 'F', text: '哇……', style: '張大嘴巴驚嘆，氣聲'},
  {id: 't_wow', who: 'T', text: '哇……', style: '張大嘴巴驚嘆，氣聲'},
  /* s35: the dome cracks */
  {id: 'f_crack', who: 'F', text: '裂開了！', style: '驚恐地指著天空大喊'},
  {id: 'w_duck', who: 'W', text: '快躲！', style: '驚慌失措地尖叫'},
  {id: 't_above', who: 'T', text: '小心頭上！', style: '對人群大吼示警'},
  /* s38–s39: the arrows turn back on the army */
  {id: 'b_back', who: 'B', text: '箭……箭轉回來了！', style: '嚇到結巴，聲音發抖地大喊'},
  {id: 'a_what', who: 'A', text: '那是什麼東西？！', style: '驚駭地大吼'},
  {id: 'b_dragon', who: 'B', text: '是龍……是龍啊！', style: '嚇到腿軟，崩潰地尖叫'},
  {id: 'g_hold', who: 'G', text: '穩住！不准退！', style: '強作鎮定地怒吼，但聲音裡有恐懼'},
  /* s41–s42: the river wall */
  {id: 'a_run', who: 'A', text: '快跑啊！', style: '恐慌地狂喊逃命'},
  {id: 'b_retreat', who: 'B', text: '撤！撤——！', style: '崩潰地尖聲大叫'},
  {id: 'a_scream', who: 'A', text: '啊——！', style: '驚恐的大叫'},
  {id: 'b_how', who: 'B', text: '怎麼可能……', style: '失魂落魄，低聲顫抖'},
  {id: 'a_sorcery', who: 'A', text: '妖……妖法……', style: '嚇呆了，低聲喃喃'},
  /* s43: saved */
  {id: 't_saved', who: 'T', text: '得救了！我們得救了！', style: '狂喜地大聲歡呼'},
  {id: 'f_cheer', who: 'F', text: '好啊——！', style: '激動地歡呼，喜極而泣'},
  {id: 'w_bless', who: 'W', text: '阿彌陀佛，菩薩保佑……', style: '喜極而泣，哽咽地唸'},
  {id: 'c_laugh', who: 'C', text: '哈哈！好漂亮！', style: '小女孩開心地笑'},
  {id: 't_cheer', who: 'T', text: '好——！', style: '振臂歡呼，聲音宏亮'},
  {id: 'b_cheer', who: 'B', text: '好——！', style: '振臂歡呼'},
];

async function call(path, body) {
  const r = await fetch(`${API}/${path}`, {method: 'POST', headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 600)}`);
  return r;
}
async function voices() {
  const v = existsSync(VFILE) ? JSON.parse(readFileSync(VFILE, 'utf8')) : {};
  for (const [k, p] of Object.entries(PERSONA)) {
    const key = 'crowd_' + k;
    if (v[key]) continue;
    let res;
    try { res = await (await call('voices', {store: true, voice: {model: MODEL, type: 'prompted', display_name: `wanjian-crowd-${k}`, gender: p.gender, language_code: 'zh-TW', prompted: {input: p.desc}}})).json(); }
    catch (e) { console.error('voice FAIL', key, e.message.slice(0, 120)); continue; }
    v[key] = res.id || res.name;
    console.log('designed voice', key, v[key]);
    writeFileSync(VFILE, JSON.stringify(v, null, 1));
  }
  return v;
}
function findAudio(o) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.data === 'string' && o.data.length > 1000) return o.data;
  for (const k of Object.keys(o)) { const f = findAudio(o[k]); if (f) return f; }
  return null;
}
async function speak(voice, text, style) {
  const r = await call('interactions', {model: MODEL, input: [{type: 'user_input', content: [{type: 'text', text, annotations: [{type: 'speech_metadata', style}]}]}],
    response_format: {type: 'audio', mime_type: 'audio/wav'}, generation_config: {speech_config: [{voice}]}});
  if ((r.headers.get('content-type') || '').includes('audio')) return Buffer.from(await r.arrayBuffer());
  const j = await r.json(), b64 = findAudio(j);
  if (!b64) throw new Error('no audio in response: ' + JSON.stringify(j).slice(0, 400));
  return Buffer.from(b64, 'base64');
}

if (process.argv[1]?.endsWith('crowd.mjs')) {   // run as a script; imported (by crowdmix.mjs) it only lends WALLA
  const redo = process.argv.includes('--redo') ? process.argv[process.argv.indexOf('--redo') + 1] : null;
  const V = await voices();
  for (const L of WALLA) {
    const v = V['crowd_' + L.who];
    if (!v) { console.error('skip', L.id, '(no voice', L.who + ')'); continue; }
    const h = createHash('md5').update(`${v}|${L.text}|${L.style}`).digest('hex').slice(0, 8), f = resolve(OUT, `${L.id}.wav`), hf = f + '.key';
    if (existsSync(f) && existsSync(hf) && readFileSync(hf, 'utf8') === h && redo !== L.id) continue;
    for (let tries = 0; ; tries++) {
      try { writeFileSync(f, await speak(v, L.text, L.style)); writeFileSync(hf, h); console.log('ok', L.id, L.text); break; }
      catch (e) { if (tries >= 2) { console.error('FAIL', L.id, e.message); break; } await new Promise((r) => setTimeout(r, 3000)); }
    }
  }
}
