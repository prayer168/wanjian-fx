import * as THREE from 'three';
import {loadMocap} from '../mocap.js';

/* one-off probe: duration, travel, hits and landings of every Mixamo clip */
export default async function mxprobe() {
  const names = ['S_draw_sword','S_gs_combo_slash','S_gs_downward_slash','S_gs_hilt_melee','S_gs_jump_attack','S_gs_low_slash','S_gs_pose_idle','S_gs_power_slash','S_gs_slide_attack','S_gs_spin_attack_run','S_gs_spin_kick','S_gs_to_block','S_inward_slash','S_one_hand_sword_combo','S_outward_slash','S_run_with_sword','S_sheath_sword','S_spell_two_hand_sword','S_ss_blocked_impact','S_ss_jump_attack','S_swordplay_idle','S_two_hand_sword_combo',
    'M_aerial_360_kick','M_bicycle_kick','M_cast_two_hands','M_cast_wide','M_eight_punch_combo','M_elbow_uppercut','M_fight_idle','M_flying_sidekick','M_four_punch_combo','M_high_block','M_hurricane_kick','M_inward_block','M_long_yell','M_low_block','M_open_palm_combo','M_praying','M_quad_punch','M_roar','M_roundhouse','M_spinning_back_kick','M_summon','M_two_palm_push',
    'X_aerial_backflip_land','X_backflip_moving','X_big_front_flip','X_cartwheel','X_evade_midair','X_get_up','X_hard_landing','X_hit_flip_back','X_hit_reaction','X_jump_back_dodge','X_jump_from_sprint','X_kip_up','X_knocked_down','X_landing','X_rocked_uppercut','X_run_flip_off_wall','X_run_up_wall','X_running_jump_land','X_sprint','X_standing_backflip','X_twist_flip_run','X_wall_run_diag'];
  const mo = await loadMocap(names);
  const f = (a) => a.map((h) => h.t.toFixed(2)).join('/');
  console.error('\n' + names.map((n) => { const c = mo.clips[n]; return `${n} dur=${c.dur.toFixed(2)} travel=${(c.travel.x / 100).toFixed(1)},${(c.travel.z / 100).toFixed(1)} tip=${f(c.hits.tip)} R=${f(c.hits.R)} L=${f(c.hits.L)} FR=${f(c.hits.FR)} FL=${f(c.hits.FL)} land=${c.lands.map((x) => x.toFixed(2)).join('/')}`; }).join('\n'));
  return {moonDir: new THREE.Vector3(0, 1, 0), shots: [{name: 'x', dur: .1, cam() {}}], update() {}};
}
