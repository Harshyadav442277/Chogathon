shader_type spatial;
// One MultiMesh draws every Chog as a little chibi (mesh from scripts/characters/chibi_mesh.gd).
// UV2.x = body part (0 torso, 1 legs, 2 left arm, 3 right arm, 4 face). UV2.y = prop piece (ChibiMesh.Piece:
// 1 right pole, 2 right head, 3 left pole, 4 left head; 0 not a prop), unit boxes shaped here by PROP_* below.
// The face is the Chog's NFT portrait from the atlas, turned toward the camera and ringed in its house color.
// Instance COLOR = house color (sRGB). INSTANCE_CUSTOM: r = atlas slot (tokenId - 1),
// g = state + 4 * role + 32 * work (state 0 walk, 1 work, 2 fight; role 0 civilian, 1..6 adventurer roles;
// work 0 hammer, 1 bow, 2 dig, 3 salute, 4 sword drill), b = phase offset 0..1, a = highlight 0..1.
// Each Chog shows one prop: its role prop if it is an adventurer (prop = role), else its job tool (prop = 7 + work).
// All animation is rigid rotation of parts around hip and shoulder pivots: no skeletons.
render_mode world_vertex_coords, cull_back, depth_draw_opaque;

uniform sampler2D atlas : source_color, filter_linear_mipmap;
uniform float cols = 45.0;
uniform float rows = 44.0;
uniform float head_y = 1.2;      // ChibiMesh.HEAD_Y
uniform float head_size = 0.82;  // ChibiMesh.HEAD_SIZE: portrait disc diameter
uniform float min_screen = 0.0065;  // grow with distance so Chogs stay visible zoomed out
uniform float walk_speed = 9.0;     // stride rate, rad/s

const float HIP = 0.34;
const float SHOULDER = 0.78;

// Per-job looks, tool shapes and material colors live in a lookup texture (scripts/characters/outfits.gd):
// rows 0..39 jobs (39 = none), rows 40.. tool pieces (4 per tool), row 164 materials. texelFetch keeps the shader fast.
const int JOB_NONE = 39;
const int PROP_ROW = 40;
const int MAT_ROW = 164;
uniform sampler2D looks : filter_nearest;

vec4 look(int x, int y) {
	return texelFetch(looks, ivec2(x, y), 0);
}

varying flat float v_part;
varying flat float v_slot;
varying vec3 v_color;      // house color (linear)
varying vec3 v_base;       // this part's outfit color (linear)
varying vec3 v_alt;        // second pattern color (linear)
varying flat float v_pat;
varying vec3 v_m;          // model-space position before animation, for patterns
varying float v_sel;
varying float v_flash;
varying flat float v_mat;

vec3 srgb_to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 job_col(vec3 c, vec3 house) {
	return c.x < 0.0 ? house : srgb_to_linear(c);
}

// Rotates a model-space point about the X axis through height `pivot`. Negative angles swing forward (+Z).
vec3 rot_x(vec3 p, float pivot, float a) {
	float y = p.y - pivot;
	return vec3(p.x, pivot + y * cos(a) - p.z * sin(a), y * sin(a) + p.z * cos(a));
}

// Rotates about the Z axis through `pivot` (x, y): positive angles lift a right arm outward.
vec3 rot_z(vec3 p, vec2 pivot, float a) {
	vec2 d = p.xy - pivot;
	return vec3(pivot.x + d.x * cos(a) - d.y * sin(a), pivot.y + d.x * sin(a) + d.y * cos(a), p.z);
}

vec3 rot_y(vec3 p, float a) {
	return vec3(p.x * cos(a) + p.z * sin(a), p.y, -p.x * sin(a) + p.z * cos(a));
}

// Hat shapes for the unit prism pieces: crown = (radius, height, top taper, y offset), brim = (radius, height, z offset).
void hat_shape(float h, out vec4 crown, out vec3 brim) {
	crown = vec4(0.3, 0.2, 1.0, 0.0);
	brim = vec3(0.0);
	if (h < 1.5) { crown = vec4(0.36, 0.3, 0.7, -0.12); brim = vec3(0.39, 0.04, 0.0); }          // helmet
	else if (h < 2.5) { crown = vec4(0.28, 0.2, 1.2, 0.0); }                                      // crown
	else if (h < 3.5) { crown = vec4(0.25, 0.42, 1.35, 0.0); brim = vec3(0.27, 0.07, 0.0); }      // chef toque
	else if (h < 4.5) { crown = vec4(0.24, 0.2, 0.85, 0.0); brim = vec3(0.6, 0.03, 0.0); }        // straw hat
	else if (h < 5.5) { crown = vec4(0.32, 0.75, 0.02, 0.0); brim = vec3(0.52, 0.03, 0.0); }      // wizard
	else if (h < 6.5) { crown = vec4(0.31, 0.16, 0.8, -0.04); brim = vec3(0.24, 0.03, 0.2); }     // cap with visor
	else if (h < 7.5) { crown = vec4(0.4, 0.5, 0.35, -0.38); }                                   // hood
	else if (h < 8.5) { crown = vec4(0.37, 0.1, 1.0, -0.05); }                                    // bandana
	else if (h < 9.5) { crown = vec4(0.25, 0.55, 0.3, 0.0); brim = vec3(0.27, 0.05, 0.0); }       // mitre
	else if (h < 10.5) { crown = vec4(0.23, 0.5, 1.05, 0.0); brim = vec3(0.4, 0.03, 0.0); }       // top hat
	else if (h < 11.5) { crown = vec4(0.38, 0.28, 0.8, -0.05); brim = vec3(0.4, 0.1, 0.0); }      // turban
	else if (h < 12.5) { crown = vec4(0.4, 0.1, 0.85, 0.0); }                                     // beret
	else { crown = vec4(0.3, 0.14, 1.0, -0.02); }                                                  // horns (spikes added below)
}

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	int part = int(floor(UV2.x + 0.5));
	float piece = floor(UV2.y + 0.5);
	float code = floor(INSTANCE_CUSTOM.g + 0.5);
	float state = mod(code, 4.0);
	float role = mod(floor(code / 4.0), 8.0);
	float work = mod(floor(code / 32.0), 8.0);
	int job = int(floor(code / 256.0)) - 1;
	if (job < 0 || job > 35) {
		job = JOB_NONE;
	}
	// Each job has its own tool; without a season job, adventurers carry their role prop, others their track's tool.
	vec4 j0 = look(0, job);  // shirt, hat
	vec4 j1 = look(1, job);  // pants, front
	vec4 j2 = look(2, job);  // hat color, back
	vec4 j3 = look(3, job);  // front color, pattern
	vec4 j4 = look(4, job);  // back color, tool
	int prop = int(floor(j4.w + 0.5));
	if (prop < 0) {
		prop = int(role > 0.5 ? role : 7.0 + work);
	}
	int idx = prop * 4 + int(piece) - 1;
	vec4 pbase = piece > 0.5 ? look(0, PROP_ROW + idx) : vec4(0.0);  // base.xyz, tilt
	vec4 psize = piece > 0.5 ? look(1, PROP_ROW + idx) : vec4(0.0);  // size.xyz, material
	bool hidden = piece > 0.5 && psize.x == 0.0;  // this prop has no such piece
	float dist = length(INV_VIEW_MATRIX[3].xyz - origin);
	float s = max(1.0, dist * min_screen) * (1.0 + INSTANCE_CUSTOM.a * 0.5) * max(0.5, COLOR.a * 3.0);  // COLOR.a = size / 3
	float phase = INSTANCE_CUSTOM.b * TAU;
	float t = TIME + INSTANCE_CUSTOM.b * 7.0;

	// Pose for this frame: limb swings (forward), arm lifts (sideways), upper-body bend, body twist and offset.
	float leg_l = 0.0, leg_r = 0.0, arm_l = 0.0, arm_r = 0.0, out_l = 0.0, out_r = 0.0, bow = 0.0, twist = 0.0;
	vec3 shift = vec3(0.0);
	float flash = 0.0;
	if (state < 0.5) {
		// Walk: legs and arms swing in opposite phase, the body bobs twice per stride.
		float w = TIME * walk_speed + phase;
		float swing = sin(w) * 0.7;
		leg_l = swing; leg_r = -swing; arm_l = -swing; arm_r = swing;
		shift.y = abs(sin(w)) * 0.08;
	} else if (state < 1.5) {
		// Work: every job has its own action.
		float f = fract(TIME * 0.8 + INSTANCE_CUSTOM.b);  // one work cycle every 1.25 s
		if (job == 0) {  // administrator: lift the stamp, slam it on the papers
			float lift = smoothstep(0.0, 0.55, f) * (1.0 - smoothstep(0.62, 0.7, f));
			arm_r = -(0.35 + 1.5 * lift); arm_l = -0.7;
			bow = 0.15 + 0.2 * smoothstep(0.66, 0.72, f) * (1.0 - smoothstep(0.8, 1.0, f));
		} else if (job == 1) {  // soldier: march on the spot, spear upright
			float k = sin(t * 5.0);
			leg_l = 0.6 * k; leg_r = -0.6 * k; arm_l = -0.6 * k; arm_r = -0.15;
			shift.y = abs(k) * 0.06;
		} else if (job == 2 || (job == JOB_NONE && work < 0.5)) {  // blacksmith: slow lift, fast strike, dip on impact
			float lift = f < 0.75 ? smoothstep(0.0, 0.75, f) : 1.0 - (f - 0.75) / 0.25;
			arm_r = -(0.3 + 2.3 * lift);
			bow = 0.3 * (1.0 - lift);
		} else if (job == 3) {  // weaponsmith: grind a blade back and forth
			float k = sin(t * 7.0);
			arm_r = -1.1 + 0.25 * k; arm_l = -1.0 + 0.25 * k; bow = 0.3; shift.z = 0.05 * k;
		} else if (job == 4) {  // armorsmith: quick rivet taps, shield held up
			arm_r = -(0.8 + 0.35 * abs(sin(t * 11.0))); arm_l = -1.0; bow = 0.2;
		} else if (job == 5) {  // alchemist: raise the flask and shake it
			float up = smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.75, 0.95, f));
			arm_r = -(0.4 + 1.6 * up) + 0.12 * sin(t * 30.0) * up; bow = -0.15 * up;
		} else if (job == 6) {  // tailor: pull the thread up and out
			float pull = smoothstep(0.1, 0.45, f) * (1.0 - smoothstep(0.55, 0.9, f));
			arm_r = -(0.7 + 0.9 * pull); out_r = 0.7 * pull; arm_l = -0.9; bow = 0.15;
		} else if (job == 7) {  // jeweler: hold the gem to the eye and turn it
			arm_r = -1.65; bow = 0.22; twist = 0.25 * sin(t * 1.3);
		} else if (job == 8) {  // carpenter: saw strokes, leaning in
			float k = sin(t * 7.0);
			arm_r = -0.95 - 0.35 * k; arm_l = -0.5; bow = 0.35; shift.z = 0.05 * k;
		} else if (job == 9) {  // toymaker: juggle
			float k = sin(t * 7.0);
			arm_r = -1.0 - 0.7 * max(0.0, k); arm_l = -1.0 - 0.7 * max(0.0, -k); out_r = 0.2; out_l = 0.2;
		} else if (job == 10) {  // shopkeeper: lift a crate onto the shelf
			float up = smoothstep(0.1, 0.5, f) * (1.0 - smoothstep(0.65, 0.95, f));
			arm_r = -(0.6 + 1.3 * up); arm_l = arm_r; bow = 0.35 * (1.0 - up) - 0.1 * up;
		} else if (job == 11) {  // librarian: read, turning a page now and then
			float flip = smoothstep(0.85, 0.92, f) * (1.0 - smoothstep(0.92, 1.0, f));
			arm_r = -1.15; arm_l = -1.15; bow = 0.22; out_l = 0.8 * flip;
		} else if (job == 12) {  // mage teacher: staff raised, floating
			arm_r = -2.5 + 0.25 * sin(t * 2.0); arm_l = -1.4; out_l = 0.3 + 0.2 * sin(t * 2.0);
			shift.y = 0.08 + 0.06 * sin(t * 2.0);
		} else if (job == 13) {  // priest: arms up to the sky, then a bow in prayer
			float g = fract(t * 0.3);
			float up = smoothstep(0.05, 0.25, g) * (1.0 - smoothstep(0.45, 0.6, g));
			float pray = smoothstep(0.6, 0.7, g) * (1.0 - smoothstep(0.9, 1.0, g));
			arm_r = -2.5 * up - 1.0 * pray; arm_l = arm_r; out_r = 0.5 * up; out_l = 0.5 * up;
			bow = -0.2 * up + 0.4 * pray;
		} else if (job == 14) {  // innkeeper: polish a mug in small circles
			arm_r = -1.0 + 0.12 * cos(t * 6.0); arm_l = -0.9 + 0.15 * sin(t * 6.0); out_l = 0.2 * sin(t * 6.0); bow = 0.12;
		} else if (job == 15) {  // cook: shake the pan, then flip
			float flip = smoothstep(0.4, 0.46, f) * (1.0 - smoothstep(0.5, 0.65, f));
			arm_r = -0.95 - 0.8 * flip + 0.08 * sin(t * 20.0); shift.y = 0.05 * flip;
		} else if (job == 16) {  // baker: roll the dough, pushing down and forward
			float k = sin(t * 5.0);
			arm_r = -0.9 - 0.25 * k; arm_l = arm_r; bow = 0.45 + 0.1 * k; shift.z = 0.05 * k;
		} else if (job == 17) {  // florist: smell the flower and sway
			arm_r = -1.7; bow = -0.12; twist = 0.2 * sin(t * 1.5); shift.x = 0.04 * sin(t * 1.5);
		} else if (job == 18) {  // bard: strum and tap a foot
			arm_r = -0.7 + 0.28 * sin(t * 14.0); arm_l = -1.1; twist = 0.18 * sin(t * 2.0);
			leg_r = 0.25 * max(0.0, sin(t * 4.0));
		} else if (job == 19) {  // courier: jog on the spot
			float k = sin(t * 9.0);
			leg_l = 0.8 * k; leg_r = -0.8 * k; arm_l = -0.7 * k; arm_r = -0.9 + 0.3 * k; shift.y = abs(k) * 0.12; bow = 0.12;
		} else if (job == 20 || (job == JOB_NONE && work > 1.5 && work < 2.5)) {  // farmer: both arms drive the shovel down
			float d = 0.5 + 0.5 * sin(f * TAU);
			arm_l = -(0.4 + 1.0 * d); arm_r = arm_l; bow = 0.1 + 0.35 * d;
		} else if (job == 21) {  // fisher: cast, wait, reel in
			float g = fract(t * 0.25);
			float back = smoothstep(0.0, 0.1, g) * (1.0 - smoothstep(0.12, 0.18, g));
			arm_r = 0.7 * back - 1.2 * smoothstep(0.12, 0.2, g) + 0.1 * sin(t * 8.0) * step(0.7, g);
			arm_l = -0.8; bow = 0.1 - 0.2 * back;
		} else if (job == 22) {  // miner: pickaxe over the head, then down
			float up = smoothstep(0.0, 0.6, f) * (1.0 - smoothstep(0.66, 0.74, f));
			arm_r = -(0.3 + 2.6 * up); arm_l = arm_r; bow = 0.4 * (1.0 - up) - 0.15 * up;
		} else if (job == 23) {  // merchant: haggle with wide gestures
			float k = sin(t * 3.0);
			arm_r = -0.6; arm_l = -0.7 - 0.4 * max(0.0, -k); out_r = 0.7 * max(0.0, k); out_l = 0.4 * max(0.0, -k);
			twist = 0.15 * sin(t * 1.5);
		} else if (job == 24) {  // stablehand: scoop hay, toss it over the shoulder
			float toss = smoothstep(0.45, 0.6, f) * (1.0 - smoothstep(0.75, 0.95, f));
			arm_r = -0.5 - 1.9 * toss; arm_l = arm_r; bow = 0.5 * (1.0 - toss) - 0.2 * toss; twist = 0.6 * toss;
		} else if (job == 25 || (job == JOB_NONE && work > 3.5)) {  // main dps: quick forward sword strikes
			float k = abs(sin(f * TAU));
			arm_r = -(0.4 + 1.6 * k); bow = 0.25 * k; shift.z = 0.15 * k;
		} else if (job == 26) {  // sub dps: alternating dagger stabs from a crouch
			float k = sin(t * 9.0);
			arm_r = -(0.5 + 1.2 * max(0.0, k)); arm_l = -(0.5 + 1.2 * max(0.0, -k));
			shift.y = -0.06; shift.x = 0.06 * sin(t * 2.0); bow = 0.2;
		} else if (job == 27) {  // tank: shield up, wide stance, bash
			float bash = smoothstep(0.7, 0.78, f) * (1.0 - smoothstep(0.8, 0.95, f));
			arm_l = -1.45; arm_r = -0.6; leg_l = 0.3; leg_r = -0.3; shift.z = 0.2 * bash; bow = 0.1 + 0.15 * bash;
		} else if (job == 28) {  // healer: staff raised, palm out, gentle float
			arm_r = -2.0 + 0.2 * sin(t * 1.6); arm_l = -1.35; shift.y = 0.05 + 0.05 * sin(t * 1.6);
		} else if (job == 29) {  // support: chant from the book, free hand waving
			arm_r = -1.15; arm_l = -1.4 + 0.3 * sin(t * 4.0); out_l = 0.5 + 0.3 * sin(t * 4.0);
			shift.y = 0.03 * abs(sin(t * 4.0));
		} else if (job == 30) {  // buffer: wave the banner
			arm_r = -2.3 + 0.45 * sin(t * 3.0); out_r = 0.4 * sin(t * 3.0); twist = 0.12 * sin(t * 3.0);
		} else if (job == 31) {  // Demon King: arms spread wide, hovering, menacing
			arm_r = -1.5; arm_l = -1.5; out_r = 0.9 + 0.2 * sin(t * 1.2); out_l = out_r;
			shift.y = 0.12 + 0.08 * sin(t * 1.2); bow = -0.15;
		} else if (job == 32) {  // Demon General: brandish the blade overhead
			arm_r = -2.4 + 0.5 * sin(t * 2.0); out_r = 0.3 * sin(t * 2.0); arm_l = -0.6; bow = -0.1;
		} else if (job == 33) {  // Dark Knight: slow patrol step, spear and guard up
			float k = sin(t * 2.5);
			leg_l = 0.3 * k; leg_r = -0.3 * k; arm_r = -0.3; arm_l = -0.8;
		} else if (job == 34) {  // Imp: hop and flail
			float k = sin(t * 12.0);
			shift.y = abs(sin(t * 6.0)) * 0.25; arm_r = -1.5 + 0.8 * k; arm_l = -1.5 - 0.8 * k; twist = 0.3 * sin(t * 3.0);
		} else if (job == 35) {  // Cultist: chant with raised arms
			arm_r = -1.9 + 0.2 * sin(t * 3.0); arm_l = arm_r; bow = 0.15 + 0.1 * sin(t * 3.0);
		} else if (work < 1.5) {  // no job, service track: a polite bow every other cycle
			float g = fract(TIME * 0.4 + INSTANCE_CUSTOM.b);
			bow = 0.55 * (smoothstep(0.1, 0.3, g) - smoothstep(0.55, 0.8, g));
		} else {  // no job, civic track: salute
			float g = fract(TIME * 0.3 + INSTANCE_CUSTOM.b);
			float up = smoothstep(0.05, 0.15, g) - smoothstep(0.6, 0.7, g);
			arm_r = -2.7 * up; bow = -0.2 * up;
		}
	} else if (state > 2.5) {
		// Idle: breathe, shift weight, glance around now and then.
		float g = fract(TIME * 0.15 + INSTANCE_CUSTOM.b);
		shift.y = 0.015 * sin(t * 2.0);
		twist = 0.5 * (smoothstep(0.6, 0.7, g) - smoothstep(0.8, 0.9, g));
		arm_l = 0.05 * sin(t * 2.0); arm_r = -0.05 * sin(t * 2.0);
	} else {
		// Fight: lunge forward and strike, recoil with a shake and a red/white flash as the hit lands.
		float f = fract(TIME * 0.9 + INSTANCE_CUSTOM.b);
		float lunge = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.35, 0.6, f));
		float hit = smoothstep(0.55, 0.6, f) * (1.0 - smoothstep(0.6, 0.85, f));
		shift.z = 0.45 * lunge - 0.15 * hit;
		shift.x = sin(TIME * 60.0) * 0.05 * hit;
		arm_r = -(0.6 + 1.8 * lunge);
		arm_l = -0.5 * lunge;
		leg_l = -0.4 * lunge;
		leg_r = 0.3 * lunge;
		bow = 0.25 * lunge - 0.15 * hit;
		flash = hit;
	}

	vec3 side = MODEL_MATRIX[0].xyz;
	vec3 fwd = MODEL_MATRIX[2].xyz;
	vec3 local = VERTEX - origin;
	vec3 m = vec3(dot(local, side), local.y, dot(local, fwd));  // model space (instances only yaw)
	v_m = m;
	vec3 house = srgb_to_linear(COLOR.rgb);
	float pat = j3.w;
	vec3 base = job_col(j0.rgb, house);
	vec3 alt = job_col(j1.rgb, house);
	if (part == 4) {
		m = rot_x(vec3(0.0, head_y, 0.0), HIP, bow);  // head center follows the upper body
	} else if (part == 5 || part == 6) {
		// Hat: unit prism pieces (radius 0.5, height 1) shaped per job, sitting on the portrait.
		float hat = j0.w;
		vec4 crown;
		vec3 brim;
		hat_shape(hat, crown, brim);
		float hy = head_y + head_size * 0.3 + crown.w;
		if (part == 5) {
			if (hat > 12.5 && m.y > 0.5 && abs(m.x) > 0.4) {
				m.y += 2.4;   // horns: the two side corners of the band shoot up and out
				m.x *= 1.6;
			}
			float k = mix(1.0, crown.z, min(m.y, 1.0));
			m = vec3(m.x * 2.0 * crown.x * k, hy + m.y * crown.y, m.z * 2.0 * crown.x * k);
			if (hat > 6.5 && hat < 7.5) {
				m.z -= 0.24;  // the hood frames the portrait from behind instead of covering it
			}
		} else {
			m = vec3(m.x * 2.0 * brim.x, hy + (m.y - 0.5) * brim.y, m.z * 2.0 * brim.x + brim.z);
		}
		hidden = hat < 0.5 || (part == 6 && brim.x <= 0.0);
		m = rot_x(m, HIP, bow);
		base = job_col(j2.rgb, house);
		pat = 0.0;
	} else if (part == 7 || part == 8) {
		// Front (apron, tabard, bib, stole) and back (cape, satchel, quiver, backpack, mantle): unit boxes.
		float kind = part == 7 ? j1.w : j2.w;
		vec3 b0 = vec3(0.0);
		vec3 sz = vec3(0.0);
		if (part == 7) {
			if (kind < 1.5) { b0 = vec3(0.0, 0.16, 0.2); sz = vec3(0.38, 0.52, 0.03); }
			else if (kind < 2.5) { b0 = vec3(0.0, 0.12, 0.21); sz = vec3(0.3, 0.62, 0.03); }
			else if (kind < 3.5) { b0 = vec3(0.0, 0.18, 0.21); sz = vec3(0.42, 0.26, 0.04); }
			else if (kind < 4.5) { b0 = vec3(0.0, 0.42, 0.19); sz = vec3(0.26, 0.3, 0.03); }
			else { b0 = vec3(0.0, 0.2, 0.21); sz = vec3(0.2, 0.6, 0.03); }
		} else {
			if (kind < 1.5) { b0 = vec3(0.0, 0.12, -0.22); sz = vec3(0.46, 0.62, 0.04); }
			else if (kind < 2.5) { b0 = vec3(-0.27, 0.28, 0.0); sz = vec3(0.08, 0.22, 0.24); }
			else if (kind < 3.5) { b0 = vec3(0.12, 0.45, -0.24); sz = vec3(0.1, 0.5, 0.1); }
			else if (kind < 4.5) { b0 = vec3(0.0, 0.36, -0.3); sz = vec3(0.32, 0.36, 0.16); }
			else { b0 = vec3(0.0, 0.45, -0.22); sz = vec3(0.5, 0.35, 0.04); }
		}
		hidden = kind < 0.5;
		m = rot_x(b0 + m * sz, HIP, bow);
		base = job_col(part == 7 ? j3.rgb : j4.rgb, house);
		if (part == 7 && kind > 1.5 && kind < 2.5) {
			base = house;  // tabards show the house
		}
		pat = 0.0;
	} else {
		if (piece > 0.5 && !hidden) {
			// Shape the unit piece into this prop's box: scale, tilt about Z at its base, place in the hand.
			float a = pbase.w;
			vec3 q = m * psize.xyz;
			m = pbase.xyz + vec3(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a), q.z);
			vec3 n = vec3(dot(NORMAL, side), NORMAL.y, dot(NORMAL, fwd));
			n = vec3(n.x * cos(a) - n.y * sin(a), n.x * sin(a) + n.y * cos(a), n.z);
			NORMAL = side * n.x + vec3(0.0, n.y, 0.0) + fwd * n.z;
		}
		if (part == 0) {
			m = rot_x(m, HIP, bow);
		} else if (part == 1) {
			m = rot_x(m, HIP, m.x < 0.0 ? leg_l : leg_r);
			base = pat > 3.5 ? base * 0.85 : alt;  // robes reach the ground
		} else {
			bool right = part == 3;
			m = rot_x(m, SHOULDER, right ? arm_r : arm_l);
			m = rot_z(m, vec2(right ? 0.22 : -0.22, SHOULDER), right ? out_r : -out_l);
			m = rot_x(m, HIP, bow);
		}
	}
	m = rot_y(m, twist) + shift;
	local = side * m.x + vec3(0.0, m.y, 0.0) + fwd * m.z;
	if (part == 4) {
		// Billboard the portrait around the head center, nudged toward the camera so the body never covers it.
		vec3 right_v = INV_VIEW_MATRIX[0].xyz;
		vec3 up_v = INV_VIEW_MATRIX[1].xyz;
		vec3 back = INV_VIEW_MATRIX[2].xyz;
		local += (right_v * (UV.x - 0.5) + up_v * (0.5 - UV.y)) * head_size + back * 0.25;
		NORMAL = back;
	}
	VERTEX = hidden ? origin : origin + local * s;  // a collapsed triangle draws nothing
	v_part = float(part);
	v_slot = INSTANCE_CUSTOM.r;
	v_sel = INSTANCE_CUSTOM.a;
	v_color = house;
	v_base = base;
	v_alt = alt;
	v_pat = pat;
	v_flash = flash;
	v_mat = piece > 0.5 ? psize.w : 0.0;
}

void fragment() {
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	vec3 flash_col = mix(vec3(1.0, 0.15, 0.1), vec3(1.0), step(0.5, fract(TIME * 12.0)));
	if (v_part > 3.5 && v_part < 4.5) {
		vec2 p = UV - 0.5;
		float r = length(p);
		if (r > 0.5) {
			discard;
		}
		vec3 col;
		if (r > 0.42) {
			col = mix(mix(v_color, vec3(1.0, 0.72, 0.1), v_sel), flash_col, v_flash);
		} else {
			float c = mod(v_slot, cols);
			float row = floor(v_slot / cols);
			vec4 t = texture(atlas, vec2((c + UV.x) / cols, (row + UV.y) / rows));
			col = t.a < 0.1 ? v_color * 0.7 : t.rgb;
		}
		// The portrait is shown unlit, like the old tokens, so the NFT reads the same everywhere.
		ALBEDO = vec3(0.0);
		EMISSION = col;
	} else {
		vec3 alb = v_base;
		if (v_mat > 0.5) {
			int mi = int(v_mat + 0.5);
			alb = mi == 4 ? v_color : look(mi, MAT_ROW).rgb;
			if (mi == 6) {
				EMISSION = vec3(0.4, 0.85, 1.0);
			} else if (mi == 11) {
				EMISSION = vec3(1.0, 0.55, 0.1) * 1.5;
			}
		} else if (v_part < 0.5) {
			// Shirt patterns, then a belt in the house color at the waist.
			if (v_pat > 0.5 && v_pat < 1.5) {
				alb = mix(alb, v_alt, step(0.5, fract(v_m.y * 9.0)));
			} else if (v_pat > 1.5 && v_pat < 2.5) {
				float a = step(0.5, fract(v_m.y * 7.0));
				float b = step(0.5, fract((v_m.x + v_m.z) * 7.0));
				alb = alb * (0.78 + 0.22 * (a + b)) + v_alt * 0.15 * a * b;
			} else if (v_pat > 2.5 && v_pat < 3.5) {
				alb *= 0.8 + 0.35 * step(0.6, fract(v_m.y * 6.0));
			}
			alb = mix(alb, v_color, step(0.34, v_m.y) * step(v_m.y, 0.4));
		} else if (v_part > 1.5 && v_part < 3.5) {
			alb = mix(alb, vec3(0.92, 0.9, 0.88), 0.55 * step(v_m.y, 0.5));  // hands
		}
		ALBEDO = alb;
		EMISSION += flash_col * v_flash * 0.8;
	}
}
