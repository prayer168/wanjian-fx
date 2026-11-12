// Section lengths of the film in order, in seconds: read from the rendered clips when they exist (the shot lists in
// film/js/scenes/*.js decide them), otherwise the last known values.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
const DEF = [['prologue', 23], ['act1', 43], ['act2', 44], ['act3', 39], ['act4', 32], ['act5', 34], ['act6', 22], ['epilogue', 16]];
export const SECTIONS = DEF.map(([n, d]) => {
  const f = `${OUT}/scene-${n}.mp4`;
  if (!existsSync(f)) return [n, d];
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {encoding: 'utf8'});
  return [n, Math.round(parseFloat(r.stdout) * 60) / 60 || d];
});
