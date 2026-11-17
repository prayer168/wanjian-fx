// Sound effects and ambience for the AI cut: recorded effects from the Sonniss GDC 2024 bundle (royalty-free, no attribution;
// not redistributed, so the library stays outside the repo — SFXLIB points at it) layered with the synthesized ones in
// audio/dsp.mjs, on the edit timeline of film.mjs. Every cue is anchored to a shot: g(id, t) is t seconds into the finished
// shot; gs(id, t) is t seconds into the shot's source clip, carried through its speed ramp, so a hit lands on its frame.
// Hit times were read off the clips frame by frame. Output: <AI_OUT>/sfx.wav (48 kHz float stereo, before the final mix).
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {SR, buf, add, bed, rng, smooth, Biquad, wind, crackle, bell, chime, boom, whoosh, thunder, knock, drone, wav} from '../audio/dsp.mjs';
import {bank, play, loop} from '../audio/sampler.mjs';
import {SHOTS, TAIL, FLASH, timeline, outAt} from './film.mjs';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', LIB = process.env.SFXLIB || 'D:/wanjian-fx/sfxlib/sonniss2024/lib';
const {T, end} = timeline(), S = Object.fromEntries(SHOTS.map((s) => [s.id, s]));
const g = (id, dt = 0) => T[id] + dt;
const gs = (id, ts) => T[id] + outAt(S[id], ts);
const B = buf(end + TAIL), R = rng(77), rp = (a) => R() * 2 * a - a;
const env = (pts) => (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * smooth(a, b, t); } return pts.at(-1)[1]; };
const put = (t, len, fn, o) => add(B, t, t + len, fn, o);

/* ── the recordings: [file under LIB, start, length] ── */
const MW = 'Justsoundeffects - Melee Weapons/', MS = 'Pole Position - The Metal Hit Sweeteners Library/', DW = 'Rescopic Sound - Distinct Whooshes/';
const HM = (v) => `Jake Fielding - Haunted Metal Vol.${v} - Cinematic ${['Hits & Impacts', 'Creaks & Risers', 'Tones & Textures'][v - 1]}/`;
const AS = 'Rogue Waves - Anime Studio/', TM = 'Mechanical Wave - Torturing Metal/', CF = 'Mechanical Wave - Cinematic Feel/', IM = 'InMotionAudio - ';
const BZ = (d) => `BluezoneCorp - ${d}/Bluezone_BC0`, OE = 'Orbital Emitter - Cinematic Transitions for Editors Volume 2/', DD = 'DavidDumais - Explosion SFX Pack/';
const RAIN = 'Bolt - Backyard Rain & Thunder - Suburban Rain Recordings/RAIN_', PROTEST = 'TheWorkRoom Audio Post - South African Ambiences - Protests/SAPST01.wav';
const K = bank(LIB, {
  ...Object.fromEntries([0, 2.42, 4.82, 7.23, 9.62].map((t, i) => [`clash${i}`, [MW + 'WEAPArmr_Metal Shield Block Hits_JSE_MW.wav', t, .75]])),
  ...Object.fromEntries([0, 1.8, 3.59, 5.36, 7.03].map((t, i) => [`iron${i}`, [MS + 'Iron - Thick - HIT - Hammer.wav', t, 1.6]])),
  ...Object.fromEntries([0, 2.15, 4.58].map((t, i) => [`barrel${i}`, [MS + 'Oil Barrel - HIT - Hammer - Take 2.wav', t, 2]])),
  ...Object.fromEntries([0, 2.46, 4.8, 7.22].map((t, i) => [`ric${i}`, ['Justsoundeffects - Steampunk Gadgets/MECHMisc_Ricochet Hits 01_JSE_SG.wav', t, 1.1]])),
  metal: [TM + 'METLImpt_Metal Impact-03_MWSFX_TM.wav'], scrape: [TM + 'METLFric_Screeching Metal Rub-11_MWSFX_TM.wav'],
  debris: [TM + 'METLCrsh_Drop Fall Metal Rattle Scrap Debris_06_MWSFX_TM.wav'],
  boom1: [HM(1) + 'DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_02.wav'],
  boom2: [HM(1) + 'DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_18.wav'],
  boom3: [HM(1) + 'DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_60.wav'],
  boom4: [HM(1) + 'DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_78.wav'],
  riseWail: [HM(2) + 'DSGNRise_Cinematic Metallic Riser, Trailer, Designed Eerie Wail_JF_Haunted Metal Vol 2_02.wav'],
  riseGroan: [HM(2) + 'DSGNRise_Cinematic Metallic Riser, Trailer, Designed Groan_JF_Haunted Metal Vol 2_08.wav'],
  rise39: [HM(2) + 'DSGNRise_Cinematic Metallic Riser, Trailer, Designed,_JF_Haunted Metal Vol 2_39.wav'],
  rattle: [HM(3) + 'DSGNRise_Deep Metallic Rattle, Tense, Epic_JF_Haunted Metal Vol 3_07.wav'],
  tonal: [HM(3) + 'DSGNTonl_Deep Metallic Hits, Epic, Sub, Bass_JF_Haunted Metal Vol 3_12.wav'],
  dron: [HM(3) + 'DSGNDron_Tense Metallic Tone, Cinematic, Eerie, Wail,_JF_Haunted Metal Vol 3_26.wav'],
  cine: [CF + 'DSGNBoom_Cinematic Hit_MWSFX_CF 05.wav'], braam: [CF + 'DSGNBram_Cinematic Horn_MWSFX_CF 05.wav'], heavy: [CF + 'WHSH_Sci-Fi Heavy Whoosh_MWSFX_CF 29.wav'],
  passLow: ['Chupapsound - Essential Scifi/WHOOSH PASS SF LOW.wav'], roar: ['Chupapsound - Essential Scifi/GRWL ROAR ANGRY.wav'],
  airy: [DW + 'WHSH_Airy-Whoosh Wind Gust 11_RSCPC_DW.wav'], flabby: [DW + 'WHSH_Deviant-Whoosh Flabby Slow 09_RSCPC_DW.wav'],
  fast: [DW + 'WHSH_Pure SciFi-Whoosh Fast 03_RSCPC_DW.wav'], watery: [DW + 'WHSH_Watery-Whoosh FIzzy Fast 03_RSCPC_DW.wav'],
  blade: [AS + 'WEAPSwrd_Mecha Energy Sword Cut_RogueWaves_AnimeStudio.wav'], synthW: [AS + 'WHSH_Whoosh Synth Noise 28_RogueWaves_AnimeStudio.wav', 0, 2],
  chargeDn: [AS + 'DSGNMisc_Charge Down Classic 1_RogueWaves_AnimeStudio.wav'], punch: ['Doex Studio - 90s Anime SFX Pack/Noise_Punch_006.wav'],
  gong: [OE + '80,TheGong.wav'], dragon: [OE + '08,DragonReveal - dramatic and recap.wav'],
  impact: [BZ('Modern Cinematic Impact') + '294_modern_cinematic_impact_022.wav'], impBoom: [BZ('Modern Cinematic Impact') + '294_modern_cinematic_impact_boom_003.wav'],
  stone1: [BZ('Stone Impact') + '297_stone_impact_041.wav'], stoneHam: [BZ('Stone Impact') + '297_stone_impact_hammer_015.wav'],
  rumble: [BZ('Alien Tripod') + '292_alien_tripod_debris_rock_collapse_earthquake_rumble_large_005.wav'],
  wImpact: [BZ('Designed Water') + '298_designed_water_impact_006.wav'], wTrans: [BZ('Designed Water') + '298_designed_water_transition_impact_017.wav'],
  wTex: [BZ('Designed Water') + '298_designed_water_texture_014.wav'], wUnder: [BZ('Designed Water') + '298_designed_water_underwater_005.wav'],
  splash: [IM + 'Submerge/WATRImpt_Impact20_InMotionAudio_Submerge.wav'],
  snap: [IM + 'Wood/WOODBrk_Snap09_InMotionAudio_Wood.wav'], woodDrop: [IM + 'Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav'],
  cloth0: [IM + 'Torn T-Shirt/CLOTHRip_CottonRips13_InMotionAudio_TornTShirt.wav'], cloth1: [IM + 'Torn T-Shirt/CLOTHRip_CottonRips44_InMotionAudio_TornTShirt.wav'],
  woodCrash: [DD + 'WOODCrsh_Designed Wood Crash And Debris 13_DDUMAIS_NONE.wav'], explo: [DD + 'EXPLReal_Medium Realistic Explosion 15_DDUMAIS_NONE.wav'],
  handBell: ['Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav'],
  horse: ['UberDuo - Horsin’ Around – Character Play Set/ANMLHors_Horse, Quarter Horse, Mare, Snort_Uberduo_HORS_Stereo-001.wav'],
  /* beds */
  rain: [RAIN + 'Rain at Night Slow Crescendo Calm Suburban_BOLT_BackyardRain_UsiPro.wav', 300, 140],
  storm: [RAIN + 'Distant Thunder and Rain Long Thunderstorm C_BOLT_BackyardRain_UsiPro.wav'],
  gale: ['Pole Position - Wind In Trees/Wind - Cherry Tree - Strong - Bed - On Ground - ORTF - CMC6.wav', 1, 130],
  waves: ['Nick McMahan - Cascadia Shore Waves/WATRSurf_Ocean Medium to Large Rocks 02 Loop_Cascadia Shore Waves.wav', 0, 40],
  army: [PROTEST, 20, 60],
});
const hit = (name, t, o = {}) => play(B, t, K[name], o);
const N15 = .85;   // n15: the frame the bowstrings let go
/* steel on steel: a block hit with a ricochet ring on top */
const clash = (t, k, o = {}) => { hit(`clash${k % 5}`, t, {gain: .8, ...o}); hit(`ric${k % 4}`, t + .01, {gain: .35, rate: 1 + rp(.1), ...o}); };

/* ── beds ── */
add(B, .2, 9, bell(98, {decay: 12, seed: 2}), {gain: .45});                                               // opening toll over black
hit('tonal', .25, {gain: .5, rate: .8});
loop(B, 0, g('n09'), K.gale, env([[0, .12], [g('s01'), .3], [g('s07'), .22], [g('n02'), .14], [g('s16'), .2], [g('n09'), .25]]));
/* the army camp across the river: a far, dark murmur in the prologue; loud when the archers draw and when the river wall hits */
{
  const e = env([[0, 0], [g('s01', 1), .07], [g('s02'), .03], [g('s07'), 0], [g('s27'), 0], [g('s27', 2), .12], [g('s28'), .5], [g('s28', 3), .4], [g('s29', 2), .12],
    [g('s38'), .1], [g('s39'), .3], [g('s41'), .55], [g('s41', 5), .4], [g('s42'), .3], [g('s42', 3.2), .06], [g('s43', 2), 0]]);
  const [L, Rr] = K.army, lpL = new Biquad('lp', 900), lpR = new Biquad('lp', 900);
  for (let i = 0; i < B[0].length; i++) { const k = i % L.length, l = lpL.run(L[k]), r = lpR.run(Rr[k]), v = e(i / SR); B[0][i] += l * v; B[1][i] += r * v; }
}
/* rain: in as the swordsman leaps down to the bridge, drained away while time is frozen (s19–s21), back for the fight, lighter
   through the siege, gone when the dome dissolves */
loop(B, g('n09'), g('s43', 3), K.rain, env([[g('n09'), 0], [g('n09', 1.5), .8], [g('s19', .5), .8], [g('s19', 3), 0], [g('s21', 5.2), 0], [g('s22'), .85],
  [g('s27'), .7], [g('s29'), .45], [g('s41'), .4], [g('s42', 3), .3], [g('s43'), .15], [g('s43', 2.5), 0]]));
loop(B, g('s18'), g('s19', 3), K.storm, env([[g('s18'), 0], [g('s18', .5), .5], [g('s19'), .4], [g('s19', 3), 0]]), {offset: 30});
loop(B, g('s44'), end + TAIL, K.gale, env([[g('s44'), 0], [g('s44', 2.5), .12], [end, .1], [end + TAIL, 0]]), {offset: 60});
add(B, g('s20'), g('s22'), drone(110, 3), {gain: .1});                                                // the frozen moment hums

/* ── prologue ── */
hit('horse', g('s01', 5.2), {gain: .12, lp: 1500, pan: .5});
hit('dron', g('s02', .2), {gain: .3});
for (let k = 0; k < 11; k++) put(g('s04', .1 + k * .3), .4, knock(700 + R() * 500, {decay: .05, seed: k}), {gain: .45, pan: rp(.2)});   // running over the tiles
hit('airy', g('s05'), {gain: .35});

/* ── act 1: the tower ── */
hit('airy', g('s07'), {gain: .6}); hit('cloth1', g('s07', .8), {gain: .3});
hit('woodDrop', g('n01'), {gain: .8}); hit('stoneHam', g('n01', .02), {gain: .5, rate: .7}); hit('punch', g('n01', .02), {gain: .4, rate: .6});   // he lands
hit('handBell', g('n02', .2), {gain: .06, lp: 3000});
/* n03c: the monk gathers his power — wind rising, a metallic groan swelling into the throw */
hit('riseGroan', g('n03c', 2.2), {gain: .35, max: 3.2}); hit('dron', g('n03c', 1.5), {gain: .25}); hit('airy', g('n03c', 2.6), {gain: .3});
put(g('n03c', 2.4), 3, crackle(303, {rate: 30}), {gain: .2}); put(g('n03c', 2), 3.4, wind(303, {lo: 150, hi: 700, gust: 1.5}), {gain: .25});
/* s08: the golden palm thrown — gathering, launch, impact on the flash */
hit('chargeDn', g('s08'), {gain: .35, rate: .6}); hit('heavy', g('s08', .05), {gain: .7});
hit('impBoom', g('s08', FLASH.s08), {gain: .9}); hit('boom2', g('s08', FLASH.s08), {gain: .6});
/* s09: he cuts the palm apart */
hit('blade', g('s09', .3), {gain: .7}); hit('fast', g('s09', .2), {gain: .4});
hit('impact', g('s09', FLASH.s09), {gain: .8}); hit('iron0', g('s09', FLASH.s09), {gain: .7}); hit('debris', g('s09', FLASH.s09 + .05), {gain: .4, rate: 1.3}); put(g('s09', .6), 2, crackle(9, {rate: 40}), {gain: .3});
/* n04: the dash and thrust */
hit('fast', g('n04'), {gain: .6}); hit('cloth0', g('n04', .3), {gain: .4});
/* s10: blade point on the palm, the slide, two more meetings */
for (const [ts, k] of [[.1, 0], [2.0, 1], [3.0, 2]]) clash(gs('s10', ts), k);
hit('scrape', gs('s10', .6), {gain: .3, max: .8}); put(gs('s10', .1), 1.5, crackle(10, {rate: 90}), {gain: .3});
/* n05: the palm slaps the flat of the blade */
hit('iron1', g('n05', FLASH.n05 - .02), {gain: .9}); hit('ric1', g('n05', FLASH.n05), {gain: .5}); hit('punch', g('n05', FLASH.n05), {gain: .4});
/* n06: the spin kick blocked on the forearms */
hit('flabby', g('n06'), {gain: .3, max: .5}); hit('punch', g('n06', .03), {gain: .8}); hit('stoneHam', g('n06', .03), {gain: .5, rate: .6});
/* s11: blade grinding along the bronze forearm */
hit('barrel1', g('s11', FLASH.s11 - .02), {gain: .8}); clash(g('s11', FLASH.s11), 3, {gain: .6});
hit('scrape', g('s11', .45), {gain: .5, rate: .8}); put(g('s11', .3), 2.3, crackle(11, {rate: 140}), {gain: .4});
/* n07: they burst out onto the eaves; the lantern rope is cut */
hit('woodCrash', g('n07', .05), {gain: .9}); hit('stone1', g('n07', .1), {gain: .5}); hit('airy', g('n07', .2), {gain: .4});
hit('blade', gs('n07', 1.7), {gain: .5}); hit('snap', gs('n07', 1.75), {gain: .6});
/* s12: burning lanterns land on the stones */
bed(B, g('s12'), g('s14'), () => crackle(12, {rate: 18}), () => crackle(13, {rate: 18}), env([[g('s12'), 0], [g('s12', .6), 1], [g('s14'), .3]]), .4);
for (const ts of [.6, 1.0, 1.6, 2.4, 3.0]) { hit('woodDrop', gs('s12', ts), {gain: .4, rate: .9 + rp(.15), pan: rp(.5)}); put(gs('s12', ts), 1.5, boom({f1: 180, f2: 70, len: .5, seed: ts * 10}), {gain: .2, pan: rp(.5)}); }
/* s13: whips of ink around the swordsman */
hit('watery', g('s13', .1), {gain: .5, rate: .7}); hit('flabby', g('s13', 1.2), {gain: .45}); hit('wUnder', g('s13'), {gain: .25});
hit('blade', gs('s13', 2.0), {gain: .5});
/* s14: the spinning ring of beads beats the ink apart */
hit('synthW', g('s14', .1), {gain: .4});
for (let k = 0; k < 9; k++) put(g('s14', .3 + k * .3), .5, knock(400 + R() * 300, {decay: .09, seed: 30 + k}), {gain: .6, pan: rp(.4)});
hit('wTex', g('s14', .4), {gain: .3});
hit('fast', g('n08'), {gain: .3});
/* s15: the palm lands on him and he flies */
hit('cine', g('s15', FLASH.s15 - .12), {gain: .9}); hit('punch', g('s15', FLASH.s15 - .02), {gain: .8}); hit('boom3', g('s15', FLASH.s15 - .09), {gain: .6});   // these files open with a few frames of air
hit('heavy', g('s15', 1.1), {gain: .45}); hit('cloth1', g('s15', 1.3), {gain: .4});
/* s16: he skids over the tiles, his blade scraping sparks */
hit('scrape', gs('s16', .4), {gain: .35}); put(gs('s16', .4), 1.6, crackle(16, {rate: 120}), {gain: .35});
for (let k = 0; k < 10; k++) put(gs('s16', .2 + R() * 1.6), .3, knock(900 + R() * 900, {decay: .04, seed: 50 + k}), {gain: .35, pan: rp(.5)});
hit('ric2', gs('s16', 4.0), {gain: .4});

/* ── act 2: frozen rain ── */
hit('airy', g('n09', .1), {gain: .5}); hit('passLow', g('n09', 1.2), {gain: .35});
put(g('s18', .1), 7, thunder(18, {len: 5}), {gain: .5});
hit('rise39', g('s19'), {gain: .3}); hit('chargeDn', g('s19', 1.2), {gain: .25, rate: .5});                   // the rain stops in the air
for (let k = 0; k < 9; k++) put(g('s20', .5 + k * .55), 1.5, chime(2400 + R() * 1600, k), {gain: .07, pan: rp(.7)});
/* s22: he flicks the hanging drops at the monk like needles */
for (let k = 0; k < 6; k++) hit(k % 2 ? 'fast' : 'watery', g('s22', .15 + k * .4), {gain: .35, rate: 1.2 + rp(.2), pan: rp(.5)});
/* s23: the ring of gold takes them */
hit('wTrans', g('s23', .2), {gain: .5}); hit('cine', g('s23', FLASH.s23 - .02), {gain: .8}); hit('wImpact', g('s23', FLASH.s23), {gain: .6});
put(g('s23', FLASH.s23), 6, bell(196, {decay: 3, seed: 23}), {gain: .25}); put(g('s23', .6), 2.5, crackle(23, {rate: 200}), {gain: .3});
/* n10–n13 and s24–s25: the bridge fight */
hit('fast', g('n10'), {gain: .5});
for (const ts of [.2, .6, 1.0, 1.4, 1.8]) hit('splash', gs('n10', ts), {gain: .3, rate: 1.1 + rp(.15), pan: rp(.2)});   // running through the water
hit('heavy', g('s24', .05), {gain: .45, rate: 1.2}); hit('fast', g('s24', .95), {gain: .3});                        // the palm on the sword wrist, then the swordsman spins out
hit('splash', g('n11', .3), {gain: .4}); hit('splash', g('n11', .9), {gain: .35, rate: 1.1});
hit('heavy', g('n12', .02), {gain: .55}); hit('watery', g('n12', .1), {gain: .3});                      // the palm sweeps over his head
hit('metal', g('n13', .03), {gain: .35, rate: 1.5}); hit('blade', gs('n13', 1.0), {gain: .4}); hit('ric3', gs('n13', 1.2), {gain: .45});   // the point at his beads, then the flick
hit('blade', g('s25', .08), {gain: .5}); hit('ric3', g('s25', .15), {gain: .3});                                  // the point slips under the cord at his neck
hit('snap', g('s25', .15), {gain: .5, rate: 1.3});
for (let k = 0; k < 16; k++) put(g('s25', 1.2 + R() * 1.7), .2, knock(2000 + R() * 1500, {decay: .03, seed: 60 + k}), {gain: .3, pan: rp(.7)});   // beads scatter
for (const dt of [.4, 1.0, 1.6, 2.3, 3.1]) hit('splash', g('s26', dt), {gain: .2, rate: 1.6 + rp(.2)});         // beads into the canal
hit('dron', g('s27'), {gain: .25});

/* ── act 3: ten thousand arrows ── */
/* n15: the volley — bowstrings slapping, a wall of arrows tearing upward */
for (let k = 0; k < 8; k++) hit('snap', g('n15', N15 + R() * .12), {gain: .25, rate: 1.6 + R() * .5, pan: rp(.7)});
hit('heavy', g('n15', N15), {gain: .6}); hit('passLow', g('n15', N15 + .05), {gain: .5}); hit('cine', g('n15', N15 - .08), {gain: .5});
for (let k = 0; k < 10; k++) hit(['fast', 'airy'][k % 2], g('n15', N15 + .05 + R() * .4), {gain: .2, rate: .9 + R() * .4, pan: rp(.8)});
hit('braam', g('s28', .2), {gain: .7}); hit('braam', g('s28', 1.6), {gain: .45, rate: .75, pan: .4});      // war horns
bed(B, g('s28'), g('s29', 2), () => crackle(28, {rate: 25}), () => crackle(29, {rate: 25}), () => 1, .3);       // torches
for (let k = 0; k < 14; k++) hit(['fast', 'passLow', 'airy'][k % 3], g('s29', R() * 3.8), {gain: .18 + R() * .1, rate: .8 + R() * .4, pan: rp(.8)});
/* n16: the monk runs up the tower stairs — nothing lands before the dome is up */
for (let k = 0; k < 7; k++) put(g('n16', .08 + k * .28), .4, knock(180 + R() * 90, {decay: .09, seed: 90 + k}), {gain: .55, pan: rp(.15)});
hit('woodDrop', g('n16', .3), {gain: .12, rate: .7, lp: 1500}); hit('fast', g('n16', .2), {gain: .3});
hit('riseWail', g('s29'), {gain: .3, max: 8});
hit('woodDrop', g('s30', .05), {gain: .15, rate: .5, lp: 900});                                              // ropes and timber creak on the wind-up
put(g('s30', 1.4), 1, whoosh(30, {from: 120, to: 500, len: .9}), {gain: .5}); hit('heavy', g('s30', 1.5), {gain: .4, rate: .7});   // the log swings
/* s31: the bell */
put(g('s31', FLASH.s31), 16, bell(65, {decay: 15, bright: 1.2, seed: 31}), {gain: .9});
hit('gong', g('s31', FLASH.s31 - .03), {gain: .8}); hit('boom1', g('s31', FLASH.s31), {gain: .9}); hit('impBoom', g('s31', FLASH.s31), {gain: .6});
/* s32: arrows break on the golden dome */
for (let k = 0; k < 30; k++) hit(`iron${k % 5}`, g('s32', R() * 6.3), {gain: .1 + R() * .08, rate: 1.4 + R() * .6, lp: 3500, pan: rp(.8)});
for (let k = 0; k < 12; k++) hit(['fast', 'passLow'][k % 2], g('s32', R() * 7.5), {gain: .12, rate: .9 + R() * .3, pan: rp(.8)});
put(g('s32'), 8, crackle(32, {rate: 60}), {gain: .3}); hit('tonal', g('s32', .3), {gain: .3});
for (let k = 0; k < 6; k++) hit(`iron${k % 5}`, g('s33', .4 + k * .6), {gain: .06, rate: 1.6, lp: 1800, pan: rp(.8)});
for (let k = 0; k < 4; k++) put(g('s34', .2 + k * .85), 1, boom({f1: 60, f2: 40, len: .25, seed: 340 + k}), {gain: .45});   // heartbeat
hit('rattle', g('s34'), {gain: .3, max: 4.2});
/* s35: the dome cracks */
hit('riseGroan', g('s35'), {gain: .4, max: 1.5}); hit('boom4', g('s35', FLASH.s35 - .17), {gain: .8}); hit('iron2', g('s35', FLASH.s35), {gain: .5, rate: .7}); hit('scrape', g('s35', FLASH.s35), {gain: .4, rate: .5});
put(g('s35', FLASH.s35), 4, thunder(35, {len: 2}), {gain: .45});
for (const dt of [.3, 1.4, 2.5, 3.6, 4.7, 5.8]) { hit('airy', g('s36', dt), {gain: .35, max: 1}); hit('woodDrop', g('s36', dt + .5), {gain: .25}); }
/* s37 → n14 → s38: the arrows stop, turn and go cold */
hit('rise39', g('s37'), {gain: .4}); hit('chargeDn', g('s37', 2.0), {gain: .5, rate: .7}); hit('boom2', g('s37', 2.4), {gain: .6});
hit('synthW', g('n14', .3), {gain: .3, rate: .6}); hit('tonal', g('n14', 2.4), {gain: .55});
for (let k = 0; k < 10; k++) put(g('n14', 2.4 + k * .08), 1.4, chime(2600 + R() * 1800, 80 + k), {gain: .05, pan: rp(.7)});   // flames turning to ice
hit('heavy', g('s38'), {gain: .5, rate: .6}); put(g('s38'), 5.2, wind(38, {lo: 120, hi: 600, gust: 2}), {gain: .35});
/* s39: the dragon */
hit('dragon', g('s39'), {gain: .8}); hit('roar', g('s39', 3), {gain: .55, rate: .55, lp: 2500}); hit('roar', g('s39', 6.2), {gain: .4, rate: .5, lp: 2000});
put(g('s39'), 8, wind(39, {lo: 80, hi: 400, gust: 2}), {gain: .3});
put(g('s40'), 5.2, drone(55, 40), {gain: .2}); hit('dron', g('s40', .2), {gain: .3});
/* s41: it dives into the river and throws up a wall of water */
hit('roar', g('s41'), {gain: .5, rate: .6}); hit('impBoom', g('s41', FLASH.s41 - .03), {gain: .9}); hit('wImpact', g('s41', FLASH.s41), {gain: .9});
hit('explo', g('s41', FLASH.s41), {gain: .5, lp: 900}); hit('wTrans', g('s41', FLASH.s41 + .3), {gain: .7});
loop(B, g('s41', .5), g('s42', 3), K.waves, env([[g('s41', .5), 0], [g('s41', 1.2), .7], [g('s42'), .4], [g('s42', 3), 0]]));
put(g('s41', .6), 8, thunder(41, {len: 6}), {gain: .5}); hit('rumble', g('s41', 1), {gain: .5});
hit('horse', g('s42', .5), {gain: .4, pan: -.3}); hit('horse', g('s42', 1.6), {gain: .3, rate: .9, pan: .4});
for (let k = 0; k < 4; k++) hit('woodDrop', g('s42', 1 + k * .5), {gain: .2, rate: .7, pan: rp(.6)});      // dropped torches
for (let k = 0; k < 14; k++) put(g('s43', R() * 4), 1.6, chime(1800 + R() * 2500, 70 + k), {gain: .05, pan: rp(.8)});

/* ── epilogue ── */
for (let k = 0; k < 6; k++) put(g('s44', .5 + R() * 4), .4, chime(3200 + R() * 1200, 90 + k), {gain: .035, pan: rp(.8)});   // morning birds, far
put(g('s47', 2.2), 12, bell(98, {decay: 9, bright: .7, seed: 47}), {gain: .3});                             // the cracked bell, softly

/* soft-clip and write */
for (const ch of B) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * .9);
mkdirSync(OUT, {recursive: true});
writeFileSync(join(OUT, 'sfx.wav'), wav(B));
console.log('wrote', join(OUT, 'sfx.wav'), (end + TAIL).toFixed(1) + 's');
