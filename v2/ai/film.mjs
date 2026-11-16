// 《鐘鳴臨淵》— the AI-video cut. One table drives everything: keyframes (Nano Banana Pro), image-to-video (Wan 2.2),
// the edit, the voice lines and the sound cues. Style follows the reference film: realistic live-action stills, haze, rim light,
// low-saturation teal/amber grade; each shot asks for ONE clear action; spectacle is set up by scale first, then rewrites it.
//   key:  what the still shows (the LOOK prefix/suffix and the character/plate refs are added by the scripts)
//   move: the Wan prompt — one action + one camera move
//   refs: S = swordsman sheets, M = monk sheets, plus plate names
//   dur:  seconds used in the edit (taken from the start of the clip, after speed); speed > 1 tightens the slightly slow Wan motion
//   ramp: speed ramp instead of one speed — [[source seconds up to, speed], ...] e.g. fast into an impact, slow on it, fast out
//   tr:   how this shot comes in — {type: 'dissolve', d: 1} (default is a straight cut)
//   ext:  the clip is extended once with a second Wan pass that starts from its last frame (extmove = that pass's prompt)
//   flip: the clip is mirrored in the edit (keeps the swordsman left / monk right when Wan put them the other way round)
//   Fight rules: the swordsman is always screen LEFT and the monk screen RIGHT; the monk meets the blade only with his palm on
//   the FLAT of the blade, at the swordsman's wrist, or with his bronze-hard forearm — a blade never passes into a body.

/* black before the first shot and after the last, seconds (the opening bell tolls over the head) */
export const HEAD = 1.5, TAIL = 5;

export const LOOK = {
  pre: `A single still frame from a big-budget live-action Chinese historical fantasy epic feature film, 16:9. Photographed on location with real actors on an ARRI cinema camera with anamorphic lenses. It must look like an actual photograph: real skin with pores and sweat, real woven linen, silk and leather with creases, dirt and wear, real wood, stone and bronze, atmospheric haze and volumetric light. Not an illustration, not CGI, not a video-game render, not a fantasy poster, no painterly glow.`,
  fx: `The supernatural effect is a high-end feature-film VFX shot: it behaves like real light, embers, mist, water and dust inside the real location and casts light on the faces, cloth, wet stone and haze around it.`,
  post: `Restrained, desaturated teal-and-amber colour grade, cool shadows, deep natural blacks, soft anamorphic flare, fine film grain, shallow depth of field. No text, no letters, no calligraphy characters, no captions, no watermark, no logo, no border, no frame.`,
};

export const WHO = {
  S: `the young swordsman from the reference photos (same face and costume: mid twenties, East Asian, lean, long black hair in a high ponytail tied with a pale grey ribbon, layered off-white and pale-grey linen hanfu, sleeves bound by worn dark leather bracers, charcoal sash, dark boots, a slim straight steel jian whose blade is about as long as his arm, roughly 80 cm, with a dark grip and a small round guard — always the same sword, never shorter or longer)`,
  M: `the warrior monk from the reference photos (same face and costume: in his forties, East Asian, shaved head, short dark stubble, broad and heavily muscled, ochre-saffron kasaya that leaves his right shoulder and arm bare, a long string of dark wooden prayer beads around his neck, grey leg wraps)`,
};

/* costume sheets and location plates; generated first, then passed as references to every keyframe that needs them */
export const CAST = {
  S_sheet: {ref: ['test02'], prompt: `Costume and camera test photograph for a live-action wuxia feature film: the young swordsman on the LEFT of the reference image, the same actor and costume, photographed three times side by side on a plain mid-grey studio backdrop under soft even key light: full body front view, full body side view, full body back view. Standing relaxed, sword held in the right hand pointing down. Mid twenties, East Asian, lean, sharp calm eyes, long black hair in a high ponytail tied with a pale grey ribbon, layered off-white and pale-grey linen hanfu with crossed collar, sleeves bound into worn dark leather bracers, charcoal sash, dark cloth trousers and dark boots, slim straight steel jian with a dark grip. Real photograph, real fabric, no text, no labels.`},
  S_face: {ref: ['test02'], prompt: `Close-up portrait photograph of the young swordsman on the LEFT of the reference image, same actor, same hair and costume, three-quarter view, chest up, plain dark grey backdrop, soft side light with a cool rim light. Real skin texture, natural, no makeup glamour, film grain. No text.`},
  M_sheet: {ref: ['test02'], prompt: `Costume and camera test photograph for a live-action wuxia feature film: the warrior monk on the RIGHT of the reference image, the same actor and costume, photographed three times side by side on a plain mid-grey studio backdrop under soft even key light: full body front view, full body side view, full body back view. Standing in a calm upright posture, hands relaxed. In his forties, East Asian, shaved head, short dark stubble, weathered resolute face, broad shoulders and heavily muscled, ochre-saffron kasaya that leaves the RIGHT shoulder and RIGHT arm bare, long string of dark wooden prayer beads around his neck, grey cloth leg wraps and cloth shoes. Real photograph, real fabric, no text, no labels.`},
  M_face: {ref: ['test02'], prompt: `Close-up portrait photograph of the warrior monk on the RIGHT of the reference image, same actor, three-quarter view, chest up, bare right shoulder, prayer beads, plain dark grey backdrop, soft side light with a cool rim light. Real skin texture, weathered, film grain. No text.`},
  city: {ref: [], prompt: `${'$LOOK'} Extreme wide aerial establishing shot at night. An ancient Chinese walled city of grey-tiled roofs and wooden halls sits on top of a sheer rock cliff above a wide misty river gorge. At the very edge of the cliff rises a tall seven-storey dark wooden bell tower with flared eaves; its open top floor holds one enormous ancient bronze bell, faintly lit by a few oil lamps. Warm paper lanterns dot the streets. A natural-size full moon veiled by thin cloud. Across the river, on a dark plain, the camp of a vast besieging army: thousands of small torch fires and tents stretching to the horizon. Mist lies in the gorge. ${'$POST'}`},
  tower: {ref: ['city'], prompt: `${'$LOOK'} Inside the open top floor of the seven-storey wooden bell tower from the reference image, at night. Massive dark timber columns and brackets, open sides with low wooden railings. In the centre hangs one enormous ancient bronze bell, three metres tall, green-black patina, engraved with worn decorative bands and lotus patterns, hung from a huge beam; beside it a heavy wooden striking log hangs on two ropes. Oil lamps, a worn straw meditation mat. Through the open side, far below, the misty river gorge and the thousands of enemy torch fires on the plain. Cool moonlight from outside, warm lamp light inside, light haze. Empty of people. ${'$POST'}`},
  bridge: {ref: ['city'], prompt: `${'$LOOK'} Night, heavy rain, inside the cliff city from the reference image. A narrow canal between old wooden houses, crossed by a single high stone arch bridge with low stone railings, wet and gleaming. Red paper lanterns hang from the eaves and reflect as long smears in the dark rippling water. In the background, above the roofs, the dark silhouette of the tall seven-storey bell tower. Empty of people. ${'$POST'}`},
};

export const SHOTS = [
  /* ── 序：臨淵 ─────────────────────────────────────────── */
  {id: 's01', refs: ['city'], dur: 8.5, ext: 1,
    extmove: `The aerial drone shot keeps gliding slowly forward toward the cliff city and the tall bell tower, which grows larger in frame; mist drifts through the gorge below, torch fires flicker on the plain. Epic, calm, majestic.`,
    key: `Extreme wide aerial shot at night, the same city, cliff, bell tower and army camp as the reference image, seen from high above the river gorge. Mist flows through the gorge, a natural-size moon behind thin cloud, thousands of enemy torch fires across the river plain.`,
    move: `Slow, steady aerial drone shot gliding forward over the misty river gorge toward the cliff city and the tall bell tower. Mist drifts below, torch fires flicker on the plain, clouds move slowly across the moon. Epic, calm, majestic.`},
  {id: 's02', refs: ['tower', 'M'], dur: 4, speed: 0.65, tr: {type: 'dissolve', d: 1},   // slowed so the cut ends before Wan brings a face in at 3 s
    key: `Extreme close-up of the surface of the enormous ancient bronze bell from the reference image: green-black patina, worn lotus reliefs, centuries of dust. A weathered, scarred, strong hand of the monk rests flat on the bronze, a few dark wooden prayer beads wrapped around the wrist. Warm oil-lamp light rakes across the metal, cool moonlight on the edge.`,
    move: `The weathered hand slides slowly across the cold bronze surface of the bell, fine dust drifts down in the lamp light. Locked-off camera, the framing stays on the hand and the bronze only, no face or other person enters the frame. Quiet, solemn.`, seed: 2},
  {id: 's03', refs: ['tower', 'M_face', 'M_sheet'], dur: 5,
    key: `Medium shot, ${'$M'} sits cross-legged in meditation on a straw mat in the open top floor of the bell tower, eyes closed, hands resting on his knees, the enormous bronze bell hanging behind him. Through the open side behind him, far below and out of focus, the thousands of enemy torch fires on the plain. Warm lamp light on his face, cool moonlight rim on his bare shoulder.`,
    move: `The monk slowly opens his eyes and looks ahead, calm and heavy. The oil lamp flames bend in a sudden gust of wind, his kasaya stirs. Very slow push in toward his face.`},
  {id: 's04', refs: ['S_sheet', 'city'], dur: 3.5, speed: 1.2,
    key: `Low tracking shot at roof level at night: close on the dark boots and the hem of the off-white robe of ${'$S'} running fast along the ridge of a grey-tiled roof, moonlight, dust and a cracked tile kicking up, city roofs and lanterns streaking out of focus behind.`,
    move: `Fast low tracking shot racing alongside the running boots along the roof ridge, tiles crack and dust kicks up with every step, the robe hem whips in the wind.`},
  {id: 's05', refs: ['S_sheet', 'S_face', 'city'], dur: 5,
    key: `Wide shot at night: ${'$S'} crouches on the ridge of a high roof, a dark silhouette against the veiled moon, robes and ponytail streaming in the wind. Across a gap, the tall seven-storey bell tower glows with its lamps. Below, the city lanterns in mist.`,
    move: `The swordsman slowly rises from his crouch to stand tall on the roof ridge, robes and ponytail streaming in the wind, he looks toward the bell tower. Slow push in. Mist drifts past.`},
  {id: 's06', refs: ['tower', 'M_face', 'M_sheet'], dur: 4,
    key: `Medium close-up of ${'$M'}, standing at the railing of the open top floor of the bell tower, looking out into the night, calm and unmoved, the bronze bell softly lit behind him. Wind moves the edge of his kasaya. Cool moonlight on one side of his face, warm lamp light on the other.`,
    move: `The monk slowly turns his head toward the camera's left and narrows his eyes, the wind moves his kasaya and the prayer beads sway slightly. Static camera, very subtle push in.`},

  /* ── 一：瓦上 ─────────────────────────────────────────── */
  {id: 's07', refs: ['S_sheet', 'city'], dur: 3, speed: 1.2,
    key: `Wide side-on shot at night: ${'$S'} in mid-air, leaping across the gap between a roof and the tall bell tower, body stretched forward, sword in hand, robes and ponytail trailing behind, small against the veiled moon; the city lanterns far below in mist.`,
    move: `The swordsman sails swiftly through the air from left to right across the frame and leaves past the right edge, robes and ponytail snapping in the wind. Locked-off camera, the bell tower and the city stay still. Mist drifts far below.`, seed: 3},
  {id: 'n01', refs: ['S_sheet', 'M_sheet', 'tower'], dur: 2.5, speed: 1.2,
    key: `Medium-wide shot at night inside the open top floor of the bell tower from the reference image: ${'$S'} lands in a low crouch on the wooden floor just inside the railing on the LEFT side of the frame, one hand on the floor, sword held back, dust and a few dead leaves blasting out from the impact, robes still settling; on the RIGHT, beside the enormous bronze bell, ${'$M'} stands calmly facing him.`,
    move: `The swordsman lands hard in a crouch, dust bursts out across the floorboards and his robes settle around him; the monk on the right does not move. Camera static, a slight shake on the landing.`},
  {id: 'n02', refs: ['S_sheet', 'S_face', 'M_sheet', 'tower'], dur: 4,
    key: `Medium two-shot at night in the open top floor of the bell tower: ${'$S'} on the LEFT rises to his full height, sword held low at his side pointing at the floor, a faint confident smile; ${'$M'} on the RIGHT faces him, hands loosely together in front of him; the enormous bronze bell hangs behind and between them. Oil lamps flicker, wind blows through the open sides.`,
    move: `The swordsman straightens up and says a short sentence to the monk with a faint smile, his lips moving as he speaks; the monk watches him without moving. Lamp flames bend in the wind. Very slow push in.`},
  {id: 'n03', refs: ['M_face', 'M_sheet', 'tower'], dur: 3.1,
    key: `Close-up at night of ${'$M'} in the top floor of the bell tower, warm lamp light on one side of his face, cool moonlight on the other, the bronze bell out of focus behind him; stern and calm, looking toward the left of frame.`,
    move: `The monk says a few short words slowly and firmly, his lips moving as he speaks, then his jaw sets. Static camera.`},
  {id: 's08', refs: ['tower', 'M_sheet'], dur: 3, ramp: [[0.6, 1.5], [1.4, 0.6], [9, 1.3]],
    key: `Medium-wide low angle at night: ${'$M'} on the outer balcony of the bell tower's top floor pushes his right palm forward; a translucent golden palm print the size of a door bursts out from his palm into the night air, made of glowing golden haze and embers, lighting his face, chest and the timber eaves gold. ${'$FX'}`,
    move: `The monk thrusts his palm forward and the huge translucent golden palm print surges out toward the camera, embers and dust blasting outward, his kasaya snapping back. Camera holds, slight shake.`},
  {id: 's09', refs: ['S_sheet', 'S_face'], dur: 2.8, ramp: [[0.5, 1.6], [1.3, 0.5], [9, 1.4]],
    key: `Medium shot at night in mid-air: ${'$S'} slashes his sword downward and cuts a huge translucent golden palm print in half; the two halves split apart and break into thousands of golden embers that stream past him, lighting his determined face and white robes gold. ${'$FX'}`,
    move: `The swordsman's sword slices down through the golden palm print, the two halves peel apart and disintegrate into streams of golden embers flying past the camera. His robes ripple.`},
  {id: 'n04', refs: ['S_sheet', 'tower'], dur: 1.6, speed: 1.5,
    key: `Medium tracking shot at night across the floorboards of the bell tower's top floor from the reference image: ${'$S'} dashes from left to right in a long low lunge, sword arm fully extended in a straight thrust, ponytail and robes streaming behind him, lamp flames whipping.`,
    move: `The swordsman explodes forward from left to right in a fast lunge with a straight sword thrust, the camera tracks fast alongside him. Dust and lamp flames whip in his wake.`},
  {id: 's10', refs: ['S_sheet', 'M_sheet', 'tower'], dur: 2.6, speed: 1.5,   // cut before the blade comes up by the monk's neck
    key: `Medium two-shot, knees up, at night on the tiled outer eave roof of the bell tower: ${'$S'} on the left thrusts his straight sword; ${'$M'} on the right slaps the flat of the blade aside with his bare right palm; a spray of bright sparks bursts from the steel. Moonlit rim light, lanterns far below out of focus.`,
    move: `Both fighters stay face to face in the frame the whole time, trading fast blows: the monk slaps the sword aside with a spray of sparks, the swordsman spins and thrusts again, the monk blocks with his forearm and pushes back. Fast, sharp kung fu with real weight. Medium two-shot, camera static.`, seed: 4},
  {id: 'n05', refs: ['S_sheet', 'M_sheet'], dur: 1.4, speed: 1.3,
    key: `Extreme close-up at night in the bell tower: the point of the steel sword comes in from the LEFT; the monk's bare open right palm, coming from the RIGHT, slaps the FLAT side of the blade sideways, a few bright sparks and a puff of dust where palm meets steel. The blade lies flat against his palm, clearly beside his hand, never cutting into it.`,
    move: `The monk's palm slaps the flat of the blade aside with a sharp snap, a few sparks fly, the blade swings away to the side. Very fast. Camera static.`},
  {id: 'n06', refs: ['S_sheet', 'M_sheet', 'tower'], dur: 1.1, speed: 1.4,   // the kick and the block only: afterwards his sword hand is empty
    key: `Medium two-shot at night in the top floor of the bell tower from the reference image: ${'$S'} on the LEFT in the middle of a spinning back kick, robes flaring; ${'$M'} on the RIGHT blocks the kick with both forearms crossed in front of his chest, his feet sliding back on the floorboards, dust kicking up.`,
    move: `The swordsman's spinning kick slams into the monk's crossed forearms, the monk slides back half a step, dust bursts from the floorboards, both reset into stance. Fast. Camera static.`},
  {id: 's11', refs: ['S_sheet', 'M_sheet', 'tower'], dur: 2.6, ramp: [[0.6, 1.2], [9, 0.6]],
    key: `Close-up at night inside the top floor of the bell tower from the reference image, the bronze bell and lamps out of focus behind: the monk's bare, heavily muscled forearm blocks the swordsman's steel blade, the edge pressing on the outside of the forearm without cutting in; where the steel meets the skin, the skin shines like dark polished bronze and a shower of bright orange sparks sprays out. Both faces partly visible at the frame edges, out of focus. ${'$FX'}`,
    move: `The steel blade scrapes along the bronze-hard forearm, a long shower of sparks sprays out, the arm does not yield. Slow motion. Camera static.`},
  {id: 'n07', refs: ['S_sheet', 'M_sheet', 'city'], dur: 3, speed: 1.2,
    key: `Wide exterior shot at night of the upper storeys of the tall seven-storey bell tower at the cliff edge from the reference image: ${'$S'} and ${'$M'} burst out of the open top floor onto the flared outer eave roof just below it, roof tiles flying; a long string of red paper lanterns hanging from the eave corner has just been cut by the sword and starts to fall, two of the lanterns catching fire. The city lights far below in mist.`,
    move: `The two fighters crash out onto the flared eave roof, tiles fly off, the cut string of red lanterns drops away toward the streets below, two of them bursting into flame. Camera tilts down slightly following the lanterns.`},
  {id: 's12', refs: ['S_sheet', 'M_sheet', 'city'], dur: 4,
    key: `Wide low angle from a narrow city street at night looking up between the eaves: a long string of red paper lanterns has been cut loose and is falling, several lanterns on fire, burning paper and embers raining down toward the wet street like a rain of fire, the flames lighting the wooden eaves orange. High above on a roof ridge, small against the veiled moon, two tiny figures, ${'$S'} and ${'$M'}, clash in silhouette. ${'$FX'}`,
    move: `The burning red lanterns fall slowly down past the camera, trailing flames and embers, while the two tiny figures on the roof above clash. Slow motion, slow tilt down.`},
  {id: 's13', refs: ['S_sheet', 'S_face', 'tower'], dur: 4, speed: 0.55,   // Wan fades the ink after ~2.3 s: use that part in slow motion
    key: `Medium shot at night on the bell tower eave: ${'$S'} sweeps his sword through the air in a great arc, and the path of the blade is left hanging in the air as a huge sweeping brush stroke of thick wet black ink, abstract like a giant calligraphy stroke (not a readable character), dripping, glossy, suspended in front of him. ${'$FX'}`,
    move: `The thick black ink stroke stays hanging in mid-air the whole time, it never fades: drips stretch down from it, then the ink hardens and splits into dozens of glossy black blades that shoot forward toward the camera. The swordsman holds his pose, his sword stays steel grey. Slow push in.`, seed: 5},
  {id: 's14', refs: ['M_sheet', 'M_face', 'tower'], dur: 3, flip: 1, speed: 1.3,
    key: `Medium shot at night: ${'$M'} whirls his long string of prayer beads in front of him; the beads glow warm gold and spin into a bright golden ring; glossy black ink blades flying at him smash against the ring and burst into clouds of black ink mist and droplets. ${'$FX'}`,
    move: `The prayer beads spin into a blazing golden ring, black ink blades slam into it one after another and explode into black ink mist that sprays outward. The monk stands firm. Camera holds.`},
  {id: 'n08', refs: ['S_face', 'S_sheet', 'tower'], dur: 1.5,
    key: `Close-up at night of ${'$S'} on the bell tower eave, a fine spray of black ink droplets bursting past his face from the right, golden light flaring on his face from the right; his eyes widen in surprise.`,
    move: `Black ink mist sprays past his face, he flinches and narrows his eyes. Fast. Camera static.`},
  {id: 's15', refs: ['S_sheet', 'M_sheet'], dur: 2.8, ramp: [[0.5, 1.4], [1.3, 0.45], [9, 1.5]],
    key: `Medium shot at night on the tiled roof: ${'$M'} lands a heavy open-palm strike on the chest of ${'$S'}; at the point of impact a ring of shockwave blasts dust, rain-damp tile chips and air outward; the swordsman's robes ripple violently backward, his face in pain. ${'$FX'}`,
    move: `The palm strike lands, the shockwave ring blasts outward, and the swordsman is thrown backward off his feet out of the frame, robes and hair whipping forward, his face twisted in pain. The monk stays rooted in his stance with a stern, grim face, his palm still extended. Nobody smiles. Slow motion turning into speed. Camera shake.`, seed: 6},
  {id: 's16', refs: ['S_sheet', 'tower'], dur: 4, speed: 1.25,
    key: `Wide shot at night down the steep tiled slope of the bell tower roof: ${'$S'} slides down the tiles toward the edge, tiles breaking loose and tumbling into the dark void; he stabs his sword into the roof to stop himself at the very edge, sparks at the blade, the city far below in mist.`,
    move: `The swordsman slides down the steep roof, loose tiles tumble over the edge and fall into the dark, he drives his sword into the tiles and screeches to a halt at the very edge with a burst of sparks.`},
  {id: 's17', refs: ['S_face', 'S_sheet'], dur: 4.5,
    key: `Close-up at night: ${'$S'} crouched at the edge of the roof, a thin line of blood at the corner of his mouth, ponytail blown across his face, cool moonlight rim, the city lanterns a soft blur far below. He looks up with a faint, defiant smile.`,
    move: `He wipes the blood from the corner of his mouth with the back of his hand, looks up and says a short defiant sentence with a faint smile, his lips moving as he speaks. Wind blows his hair. Very slow push in.`, seed: 2},
  {id: 'n09', refs: ['S_sheet', 'M_sheet', 'city'], dur: 3.5,
    key: `Wide high angle at night as rain begins to fall: from the flared eave of the tall bell tower, ${'$S'} leaps off and drops toward the dark wet roofs of the city far below, robes flying; a moment behind him ${'$M'} leaps after him, kasaya billowing; rain streaks through the frame, red lanterns glow in the narrow streets below.`,
    move: `The swordsman leaps off the tower eave and drops toward the rain-soaked roofs below, the monk leaps after him; the rain grows heavier. Camera tilts down following them.`},

  /* ── 二：雨停 ─────────────────────────────────────────── */
  {id: 's18', refs: ['bridge', 'S_sheet', 'M_sheet'], dur: 4.5, tr: {type: 'dissolve', d: 0.8},
    key: `Wide shot at night in heavy rain: the stone arch bridge over the canal from the reference image; ${'$S'} stands at one end and ${'$M'} at the top of the arch, facing each other, soaked. Red lanterns reflect in the rippling water. The bell tower silhouette above the roofs.`,
    move: `Heavy rain pours down, the canal water ripples and the lantern reflections shimmer; the two men stand still, facing each other. Slow crane down from above.`},
  {id: 's19', refs: ['S_face', 'S_sheet'], dur: 4,
    key: `Extreme close-up at night in the rain: two fingers of the swordsman (index and middle, a sword seal) slide along the flat of his steel blade; the raindrops closest to the blade hang perfectly still in mid-air, glittering like glass beads in the red lantern light, while the rain behind still falls. ${'$FX'}`,
    move: `As the two fingers slide along the blade, the falling raindrops around it stop one after another and hang motionless in mid-air, glittering. Shallow focus pulls along the blade.`},
  {id: 's20', refs: ['bridge', 'S_sheet', 'M_sheet'], dur: 5.5,
    key: `Wide shot at night: the whole rainstorm over the stone bridge is frozen in mid-air — millions of suspended raindrops glittering like crystal in the red lantern light, filling the frame. ${'$M'} stands on the top of the arch; ${'$S'} walks slowly up the bridge toward him through the frozen rain, and every drop he touches splits cleanly in two. ${'$FX'}`,
    move: `Time is frozen: the raindrops hang motionless in the air while the swordsman walks slowly forward through them, splitting the drops in his path. Very slow dolly forward through the suspended rain.`},
  {id: 's21', refs: ['M_face', 'M_sheet'], dur: 4, still: true,   // Wan keeps the rain falling; frozen time is the keyframe itself, pushed in
    key: `Extreme close-up of ${'$M'}'s face at night, soaked, rain frozen in mid-air in front of his eyes — a single drop hangs an inch from his eye, reflecting a red lantern. Utterly calm.`,
    move: `Time has stopped: every raindrop hangs perfectly motionless in the air, no rain falls at all. The monk slowly closes and opens his eyes; the single frozen raindrop in front of his eye trembles slightly but stays in place. Very slow push in.`, seed: 7},
  {id: 's22', refs: ['bridge', 'S_sheet', 'M_sheet'], dur: 3, speed: 1.3,
    key: `Medium-wide shot at night on the bridge: ${'$S'} flicks his sword forward and all the frozen raindrops around him stretch into thin glittering needles of water, a horizontal storm streaking toward ${'$M'}. ${'$FX'}`,
    move: `The suspended raindrops stretch into glittering water needles and shoot horizontally toward the monk in a dense storm. The swordsman's sword is extended. Camera pushes in fast.`},
  {id: 's23', refs: ['bridge', 'M_sheet', 'M_face'], dur: 3.5, flip: 1, ramp: [[0.5, 1.3], [1.4, 0.6], [9, 1.3]],
    key: `Medium shot at night on the bridge: ${'$M'} presses his palms together and then thrusts both palms forward; a translucent golden ripple in the shape of a bell expands from him; the flying water needles shatter against it into bright mist. ${'$FX'}`,
    move: `The monk thrusts both palms forward, a translucent golden bell-shaped ripple expands outward and the incoming water needles shatter into a burst of glowing mist. His kasaya flaps.`},
  {id: 'n10', refs: ['S_sheet', 'bridge'], dur: 1.7, speed: 1.4,
    key: `Medium shot at night in heavy rain on the stone bridge from the reference image: ${'$S'} charges forward from left to right through a drifting curtain of water spray, sword raised high in both hands, face fierce, red lantern light behind him.`,
    move: `The swordsman bursts through the drifting water spray charging from left to right, sword raised, water exploding off his robes. Fast tracking shot.`},
  {id: 's24', refs: ['bridge', 'S_sheet', 'M_sheet'], dur: 3, speed: 1.5,
    key: `Medium two-shot at night in heavy rain on the stone bridge: ${'$S'} and ${'$M'} fight at close range. There is exactly one sword in the picture, held by the swordsman; the monk is completely bare-handed and blocks the flat of the blade with his open palm and forearm. Water splashing up from their feet in sheets, wet faces, red lantern light and cool rim light.`,
    move: `A fast close-range exchange in the rain: only the swordsman holds a sword, the monk is bare-handed. The swordsman cuts, the monk parries the blade with his open palm and forearm, they trade blows, water splashes up from the stone under their feet. Handheld camera, fast and powerful.`, seed: 8},
  {id: 'n11', refs: ['S_sheet', 'M_sheet', 'bridge'], dur: 1.5, speed: 1.5,
    key: `Low angle close shot at night at ankle height on the wet stone bridge in heavy rain: the swordsman's dark boots on the LEFT and the monk's grey leg wraps and cloth shoes on the RIGHT, both mid-step, water splashing up in sheets, red lantern reflections in the puddles.`,
    move: `Fast footwork: the feet pivot, slide and stamp on the wet stone, water splashes up with every step. Camera static at ground level.`},
  {id: 'n12', refs: ['S_sheet', 'M_sheet', 'bridge'], dur: 1.8, speed: 1.4,
    key: `Medium two-shot at night in heavy rain on the stone bridge from the reference image: ${'$M'} on the RIGHT swings a heavy open-palm strike; ${'$S'} on the LEFT ducks low under it, ponytail whipping through the rain, sword held back; the rain around the palm is blasted into a fan of spray.`,
    move: `The monk's palm sweeps through the air and blasts the rain into spray, the swordsman ducks under it and springs back up. Fast. Camera static.`},
  {id: 'n13', refs: ['S_sheet', 'M_sheet', 'bridge'], dur: 1.4, speed: 1.3,
    key: `Medium close shot at night in the rain: ${'$S'} on the LEFT flicks his sword upward in a fast rising cut toward the string of prayer beads around the neck of ${'$M'} on the RIGHT; the monk leans back, the blade tip passing a hand's width in front of his chest without touching his skin.`,
    move: `The sword tip flicks upward in front of the monk's chest, the monk leans back, the tip catches the cord of the prayer beads. Very fast. Camera static.`},
  {id: 's25', refs: ['M_sheet', 'S_sheet'], dur: 3, flip: 1, speed: 0.8,
    key: `Extreme close-up at night in the rain: the tip of the steel sword slices through the cord of the monk's string of dark wooden prayer beads at his chest; the beads burst apart and scatter into the air one by one. ${'$FX'}`,
    move: `The sword tip flicks the cord and pulls straight back away from the monk, the blade never touches his body. The cord snaps, the whole string falls away from his neck and the dark wooden prayer beads burst apart, scattering through the air in extreme slow motion with raindrops. Camera static.`, seed: 9},
  {id: 's26', refs: ['bridge'], dur: 5,
    key: `Low angle right at the surface of the dark canal at night, in the rain, no people anywhere: a few single loose dark wooden prayer beads (separate beads, not a string or loop) fall from above and plop into the water, each making a ring of ripples. The real sky above is dark and empty except for rain. Only in the mirror reflection on the water surface, impossibly, there is a night sky filled with thousands of flaming arrows. The red lanterns blur above. ${'$FX'}`,
    move: `The prayer beads drop into the water one after another, rings of ripples spread across the surface, and the reflection of a sky full of flaming arrows wavers in the water. Slow push in.`},
  {id: 's27', refs: ['bridge', 'S_face', 'M_face'], dur: 4,
    key: `Medium two-shot at night on the bridge in the rain: ${'$S'} and ${'$M'} stand side by side, frozen mid-fight, both looking up at the sky over the city, faces lit by a distant orange glow, rain streaming down.`,
    move: `Both men slowly lift their heads and look up at the sky, their expressions turning grave, an orange glow growing on their faces, rain streaming down. Slow push in.`},
  {id: 's28', refs: ['city'], dur: 4.5,
    key: `Wide shot across the dark plain at night in light rain: thousands of armoured archers in rows, lit by torches, raise their longbows toward the sky; the tips of their arrows are burning. War banners hang wet. Far away across the river, the cliff city and its bell tower.`,
    move: `Rows of archers raise their bows toward the sky in a wave, burning arrow tips catching fire one after another. Torches flicker. Slow lateral tracking shot.`},

  /* ── 三：萬箭 ─────────────────────────────────────────── */
  {id: 's29', refs: ['city'], dur: 7.5, ext: 1,
    extmove: `More and more flaming arrows streak down out of the sky toward the cliff city like a meteor shower, the first ones hitting the roofs in bursts of fire and sparks. The camera slowly drifts closer to the bell tower.`,
    key: `Extreme wide shot at night: the sky above the river gorge is filled with ten thousand flaming arrows arcing from the plain toward the cliff city like a burning meteor shower, the trails lighting the low clouds orange; the city and the bell tower small on the cliff. ${'$FX'}`,
    move: `Ten thousand flaming arrows arc slowly across the sky toward the cliff city, burning trails streaking, the clouds glow orange. Slow tilt up.`},
  {id: 's30', refs: ['tower', 'M_sheet', 'M_face'], dur: 4,
    key: `Medium shot inside the top floor of the bell tower at night, orange glow from outside: ${'$M'}, soaked, his prayer beads gone, grips the ropes of the heavy wooden striking log with both hands and pulls it far back, every muscle straining, the enormous bronze bell in front of him.`,
    move: `The monk hauls the heavy striking log back with all his strength, his muscles straining, then swings it forward toward the bell. Camera holds low.`},
  {id: 's31', refs: ['tower'], dur: 3.5,
    key: `Extreme close-up at night, no person anywhere in the frame, only the bell and the log: the heavy wooden striking log hits the enormous ancient bronze bell; from the point of impact a ring of golden light ripples across the bronze surface, dust and old flakes of patina burst off the metal. ${'$FX'}`,
    move: `The log strikes the bell, the bronze shudders, a ring of golden light ripples outward across the surface and dust bursts off the metal. No person enters the frame. Camera shakes once.`},
  {id: 's32', refs: ['city'], dur: 8, ext: 1,
    extmove: `Wave after wave of flaming arrows rains down onto the giant golden dome of light and bursts into sparks across its surface, ripples of gold spreading from every impact. Slow aerial orbit.`,
    key: `Extreme wide aerial shot at night: a gigantic translucent golden dome of light, shaped like an enormous bell, rises over the entire cliff city from the bell tower; thousands of flaming arrows strike its surface and burst into sparks, ripples of gold spreading from every impact. ${'$FX'}`,
    move: `The colossal golden bell-shaped dome of light rises over the whole city; flaming arrows rain down onto it and burst into sparks, ripples spreading across its surface. Slow aerial orbit.`},
  {id: 's33', refs: ['city'], dur: 4,
    key: `Medium shot at night in a city street: ordinary townspeople in rough hemp clothes — an old woman, a young father holding a small child, a blacksmith — look up in awe, their faces lit by flickering golden light from above; burning sparks drift down. Real, weathered faces.`,
    move: `The townspeople gaze upward, the golden light flickers across their faces with each explosion above, the child reaches up toward the sparks. Slow push in.`},
  {id: 's34', refs: ['tower', 'M_face', 'M_sheet'], dur: 4,
    key: `Close-up at night of ${'$M'} at the bell, both hands pressed on the bronze, golden light pouring from the bell over his face; blood runs from his nose, veins stand out on his temples and arms, he trembles but holds. ${'$FX'}`,
    move: `The monk trembles with strain, pressing his hands against the glowing bell, golden light pulsing over his face, a drop of blood runs from his nose. Very slow push in.`},
  {id: 's35', refs: ['city'], dur: 4,
    key: `Wide shot from below the golden dome at night: a long jagged crack runs across the translucent golden dome of light over the city; burning arrows start to punch through the crack and fall toward the roofs. ${'$FX'}`,
    move: `The crack spreads across the golden dome with flashes of light, and burning arrows break through and fall toward the roofs below. Camera tilts down slowly.`},
  {id: 's36', refs: ['tower', 'S_sheet'], dur: 4.5, speed: 1.2,
    key: `Wide shot at night in the rain beside the dark wooden seven-storey bell tower from the reference image: ${'$S'} runs up the outside of the tower, leaping from one flared eave to the next, robes streaming, burning arrows falling around him. High in the sky above, the gigantic translucent golden bell-shaped dome of light that covers the whole city, hundreds of metres wide, glows faintly and ripples where arrows strike it. The tower roof itself is ordinary dark grey tile.`,
    move: `The swordsman leaps upward from eave to eave up the side of the bell tower, his robes streaming, burning arrows streak past him. Camera cranes up with him.`},
  {id: 's37', refs: ['tower', 'S_sheet', 'S_face'], dur: 4.5,
    key: `Low angle at night: ${'$S'} stands on the topmost ridge of the dark grey-tiled roof of the bell tower from the reference image, sword raised straight up at the sky; above him thousands of flaming arrows hang frozen in mid-air, stopped dead, their flames still flickering. Far beyond the arrows, high in the sky, the faint curved surface of the gigantic cracked golden dome of light over the whole city. ${'$FX'}`,
    move: `The swordsman raises his sword and the falling flaming arrows above him slow down and stop, hanging motionless in the sky, flames still flickering. His robes blow. Slow push in from below.`},
  {id: 'n14', refs: ['S_sheet', 'city'], dur: 3.2,
    key: `Low angle at night looking up past the dark eave of the bell tower roof: thousands of flaming arrows hang frozen in mid-air filling the whole sky, the nearest ones large in the foreground, orange flames flickering on their shafts; the small figure of ${'$S'} stands on the roof ridge at the bottom of frame, sword raised to the sky. ${'$FX'}`,
    move: `The frozen arrows slowly rotate in mid-air to point back up the way they came, and one after another their orange flames turn cold blue-white. Slow push in.`},
  {id: 's38', refs: ['city'], dur: 5, speed: 0.55,   // the vortex turns orange after 2.75 s: keep the blue-white part, slowed
    key: `Epic wide shot at night: above the cliff city, ten thousand stopped arrows turn around in mid-air to point back across the river; their flames have turned cold blue-white; they swirl into a colossal slow vortex over the bell tower. ${'$FX'}`,
    move: `The ten thousand arrows turn around in the sky, their flames turn blue-white, and they begin to swirl into a colossal vortex over the bell tower. Slow aerial pull back.`},
  {id: 's39', refs: ['city'], dur: 8, ext: 1,
    extmove: `The colossal dragon made of thousands of glowing blue-white arrows keeps coiling through the sky above the gorge, then rears its head high above the bell tower. Slow aerial orbit around it.`,
    key: `Epic wide shot at night: the ten thousand blue-white glowing arrows have assembled into a colossal translucent dragon in the sky over the river gorge — its long body made entirely of arrows, scales of steel and cold fire — coiling above the cliff city and the bell tower. ${'$FX'}`,
    move: `The colossal dragon made of thousands of glowing arrows coils and undulates through the sky over the gorge, its arrow scales glinting. Slow aerial orbit around it.`},
  {id: 's40', refs: ['city', 'M_sheet'], dur: 5, seed: 2,
    key: `Epic exterior wide shot at night, seen from outside and far below the cliff: the whole seven-storey bell tower from the reference image stands small at the cliff edge; behind and above it, a colossal translucent golden figure of a serene Buddhist guardian rises into the night sky, many arms spread wide like a halo, many times taller than the tower, as tall as the whole cliff, made of golden haze and light; on the tower's open top floor, a tiny figure of ${'$M'} stands with his palms pressed together. ${'$FX'}`,
    move: `The colossal translucent golden guardian rises slowly behind the tower and spreads its many arms wide, golden haze drifting from it. The tiny monk stands below. Slow tilt up.`},
  {id: 's41', refs: ['city', 's39'], dur: 6.5, speed: 1.1, ext: 1,
    extmove: `The gigantic wall of river water keeps rising and then collapses back down in slow motion, mist and spray rolling out over the gorge, thousands of arrows left standing in the water.`,
    key: `Epic wide shot at night over the river gorge: the same colossal translucent blue-white dragon made of glowing arrows as in the reference image (cold blue-white light, not orange) dives head first into the river between the army and the cliff, throwing up a towering wall of white water and spray hundreds of metres high, lit blue-white from within; a wall of arrows stands out of the water. ${'$FX'}`,
    move: `The arrow dragon plunges into the river and a gigantic wall of water explodes upward in slow motion, spray and mist rolling outward. Camera shakes.`},
  {id: 's42', refs: ['city'], dur: 4,
    key: `Medium-wide shot at night on the plain: soldiers in armour lower their bows in shock, war horses rear and panic, dropped torches sputter in the wet grass, a curtain of falling river spray in the background.`,
    move: `The soldiers slowly lower their bows and step back, a horse rears, torches fall to the ground, river spray drifts down like rain. Slow push in.`},
  {id: 's43', refs: ['city'], dur: 4.5,
    key: `Extreme wide shot at night over the whole cliff city and the bell tower from the reference image: the gigantic translucent golden dome of light that covered the entire city, hundreds of metres wide, dissolves into millions of drifting golden motes like fireflies, falling gently over the wet roofs; the rain has stopped; the clouds part and the moon returns.`,
    move: `The golden dome dissolves into drifting golden motes that float down over the roofs like fireflies, the clouds slowly part to reveal the moon. Slow crane down.`},

  /* ── 尾：鐘鳴 ─────────────────────────────────────────── */
  {id: 's44', refs: ['tower', 'S_sheet', 'M_sheet'], dur: 5.5, tr: {type: 'dissolve', d: 1.6},
    key: `Dawn, the top floor of the bell tower: the enormous bronze bell now has a long jagged crack down its side. ${'$M'} sits exhausted on the floor leaning against the bell; ${'$S'} sits beside him, back against a column, both soaked, bruised and dirty. Soft cold blue dawn light with the first warm sunlight entering from the side, mist outside.`,
    move: `The first warm rays of sunlight slowly sweep across the floor and onto their tired faces, mist drifts outside, the monk lets out a long breath. Static camera, very slow push in.`},
  {id: 's45', refs: ['tower', 'S_sheet', 'M_sheet'], dur: 4,
    key: `Close-up at dawn on the top floor of the bell tower from the reference image, the timber columns, the railing and the cracked bronze bell soft and out of focus behind: the swordsman's hand with its worn leather bracer opens palm up toward the monk; in his palm lies a single dark wooden prayer bead, wet, catching the warm sunlight.`,
    move: `The swordsman's hand slowly offers the single prayer bead; a heavy, weathered, sun-tanned hand with plain bare skin (no tattoos, no markings) and an ochre robe sleeve reaches in from the top of the frame and gently takes it. No face appears, only the two hands and the soft blurred background. Warm sunlight. Static camera.`, seed: 4},
  {id: 's46', refs: ['tower', 'S_sheet', 'M_sheet'], dur: 4.5,
    key: `Medium-wide shot at dawn on the top floor of the bell tower: ${'$S'} and ${'$M'} stand facing each other in front of the cracked bronze bell and salute each other — the swordsman with a fist-and-palm salute, the monk with one hand raised in a Buddhist salute. Warm low sun behind them, mist and the river gorge beyond.`,
    move: `The two men salute each other with quiet respect and bow slightly, warm sunlight flaring behind them, mist drifting beyond. Slow arc around them.`},
  {id: 's47', refs: ['city', 'tower'], dur: 10, ext: 1, tr: {type: 'dissolve', d: 1},
    extmove: `The aerial shot keeps rising and pulling back from the bell tower and the cliff city, the river full of standing arrows below, golden sunlight spreading over the mist and the mountains.`,
    key: `Extreme wide aerial at dawn: the cliff city in golden morning mist, the seven-storey bell tower at the cliff edge; in the river below, thousands of arrows stand up out of the water like a field of reeds; on the far plain, the enemy army is withdrawing in long columns. The sun rises over the mountains.`,
    move: `Slow, majestic aerial pull back and rise away from the bell tower and the cliff city, revealing the river full of standing arrows and the army withdrawing, sunlight spreading over the mist.`},
];

/* voice lines: shot = where it starts, at = seconds into that shot; who S | M */
export const LINES = [
  {id: 'e01', who: 'M', shot: 's03', at: 1.2, text: '三十年了。這口鐘，一次也沒有響過。', style: '低沉、緩慢、自言自語，像在跟老朋友說話，帶一點疲憊'},
  {id: 'e02', who: 'S', shot: 'n02', at: 0.8, text: '大師，借你的鐘一用。', style: '面對面、從容、帶點笑意和傲氣，聲音清亮'},
  {id: 'e03', who: 'M', shot: 'n03', at: 0.1, text: '鐘在，城在。', style: '平靜、低沉、一字一頓，不容商量'},
  {id: 'e04', who: 'M', shot: 's16', at: 1.0, text: '回去吧。這口鐘，不是你能碰的。', style: '沉穩、居高臨下但不兇，像長輩勸人'},
  {id: 'e05', who: 'S', shot: 's17', at: 0.5, tempo: 1.1, text: '那就讓我看看，它值不值得。', style: '喘著氣、嘴角帶血地笑，不服輸'},
  {id: 'e06', who: 'S', shot: 's21', at: 0.6, text: '你守了三十年，卻從來不敢敲。', style: '低聲、近距離、帶挑釁，雨聲中說'},
  {id: 'e07', who: 'M', shot: 's23', at: 0.2, text: '敲一次，我這條命就給它了！', style: '運足內力、從丹田爆發的怒吼，聲如洪鐘、震耳欲聾，三十年壓抑的情緒一次炸開，最後一個字拉長'},
  {id: 'e08', who: 'S', shot: 's27', at: 1.0, text: '……他們來了。', style: '很輕、凝重，看向天空'},
  {id: 'e09', who: 'M', shot: 's30', at: 0.1, text: '退後！', style: '用盡全身力氣的暴喝，短促、厚重、震撼，像獅子吼'},
  {id: 'e10', who: 'S', shot: 's35', at: 1.0, text: '撐住——！', style: '在狂風暴雨中拚命嘶吼，焦急、聲嘶力竭，邊奔跑邊喊，尾音拉長破音'},
  {id: 'e11', who: 'S', shot: 's37', at: 2.0, text: '這一劍，替你敲！', style: '站在屋頂對天怒吼，用盡全力、豪氣萬丈、熱血沸騰，每個字都像劈出去的劍'},
  {id: 'e12', who: 'M', shot: 's44', at: 2.0, text: '這口鐘……裂了。', style: '虛弱、喘息、帶一點苦笑'},
  {id: 'e13', who: 'S', shot: 's45', at: 1.2, text: '人沒裂就好。', style: '累極了但輕鬆地笑，像朋友開玩笑'},
  {id: 'e14', who: 'M', shot: 's46', at: 1.0, text: '阿彌陀佛。後會有期。', style: '溫和、敬重、沉穩，帶笑意'},
];

/* white impact flashes, seconds into the finished shot (edit.mjs draws them, sfx.mjs hits on them) */
export const FLASH = {s08: .62, s09: .55, n05: .12, s11: .3, s15: .5, s23: .55, s31: .5, s35: .45, s41: .55};

/* ── timing helpers shared by shoot / edit / sfx ── */
/* the speed pieces of a shot: [[from, to, speed], ...] in source seconds */
export const pieces = (s) => {
  if (!s.ramp) return [[0, 99, s.speed || 1]];
  let a = 0; return s.ramp.map(([to, sp]) => { const p = [a, to, sp]; a = to; return p; });
};
/* edit seconds -> source seconds (and back) for one shot */
export function srcAt(s, tout) {
  let o = 0;
  for (const [a, b, sp] of pieces(s)) { const len = (b - a) / sp; if (tout <= o + len) return a + (tout - o) * sp; o += len; }
  return 99;
}
export function outAt(s, tsrc) {
  let o = 0;
  for (const [a, b, sp] of pieces(s)) { if (tsrc <= b) return o + (tsrc - a) / sp; o += (b - a) / sp; }
  return o;
}
/* source seconds a shot needs for its edit length */
export const srcLen = (s) => srcAt(s, s.dur);
/* start of every shot on the edit timeline; an incoming dissolve overlaps the end of the shot before it */
/* a length rounded to whole frames at 24 fps: the edit cuts on frames, so the timeline counts in frames too or sound drifts */
export const frames = (sec) => Math.round(sec * 24) / 24;
export function timeline() {
  const T = {}; let t = HEAD;
  for (const s of SHOTS) { t -= frames(s.tr?.d || 0); T[s.id] = t; t += frames(s.dur); }
  return {T, end: t};
}
