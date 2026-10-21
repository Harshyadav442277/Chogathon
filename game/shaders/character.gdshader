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
uniform float head_size = 1.0;   // ChibiMesh.HEAD_SIZE
uniform float min_screen = 0.0065;  // grow with distance so Chogs stay visible zoomed out
uniform float walk_speed = 9.0;     // stride rate, rad/s

const float HIP = 0.34;
const float SHOULDER = 0.78;

// Prop shapes, 4 pieces per prop (right pole, right head, left pole, left head); a zero size hides the piece.
// Props: 0 none, 1 sword, 2 daggers, 3 shield, 4 staff, 5 book, 6 banner (adventurer roles 1..6),
// 7 hammer, 8 tray, 9 shovel, 10 spear (civilian tools: 7 + work track). Hands at rest: x = +-0.3, y ~ 0.42.
// PROP_BASE = bottom center of the box, PROP_SIZE = box size, PROP_ROT_MAT = (tilt about Z, material).
// Materials: 1 steel, 2 wood, 3 gold, 4 house color, 5 paper, 6 glowing orb.
const vec3 PROP_BASE[44] = {
	vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0),
	vec3(0.3, 0.5, 0.08), vec3(0.3, 0.44, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.3, 0.42, 0.08), vec3(0.0), vec3(-0.3, 0.42, 0.08), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(-0.55, 0.2, 0.18), vec3(-0.55, 0.52, 0.22),
	vec3(0.3, 0.0, 0.08), vec3(0.3, 1.98, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(-0.8, 0.8, 0.1), vec3(0.0),
	vec3(0.3, 0.0, 0.08), vec3(0.62, 1.85, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.3, 0.3, 0.08), vec3(0.3, 1.6, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(-0.4, 1.85, 0.05), vec3(-0.45, 1.9, 0.05),
	vec3(0.3, 0.25, 0.08), vec3(0.3, 0.0, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(-0.3, 0.0, 0.08), vec3(-0.3, 2.2, 0.08)
};
const vec3 PROP_SIZE[44] = {
	vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0),
	vec3(0.07, 1.5, 0.05), vec3(0.32, 0.06, 0.08), vec3(0.0), vec3(0.0),
	vec3(0.05, 0.85, 0.04), vec3(0.0), vec3(0.05, 0.85, 0.04), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(0.6, 0.8, 0.06), vec3(0.16, 0.16, 0.04),
	vec3(0.06, 2.05, 0.06), vec3(0.24, 0.24, 0.24), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(0.12, 0.55, 0.45), vec3(0.0),
	vec3(0.06, 2.35, 0.06), vec3(0.6, 0.45, 0.03), vec3(0.0), vec3(0.0),
	vec3(0.07, 1.35, 0.07), vec3(0.5, 0.28, 0.28), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(0.6, 0.05, 0.6), vec3(0.14, 0.2, 0.14),
	vec3(0.06, 1.75, 0.06), vec3(0.26, 0.3, 0.04), vec3(0.0), vec3(0.0),
	vec3(0.0), vec3(0.0), vec3(0.06, 2.2, 0.06), vec3(0.12, 0.32, 0.04)
};
const vec2 PROP_ROT_MAT[44] = {
	vec2(0.0), vec2(0.0), vec2(0.0), vec2(0.0),
	vec2(0.0, 1.0), vec2(0.0, 3.0), vec2(0.0), vec2(0.0),
	vec2(-0.6, 1.0), vec2(0.0), vec2(0.6, 1.0), vec2(0.0),
	vec2(0.0), vec2(0.0), vec2(0.0, 4.0), vec2(0.0, 3.0),
	vec2(0.0, 2.0), vec2(0.0, 6.0), vec2(0.0), vec2(0.0),
	vec2(0.0), vec2(0.0), vec2(0.0, 4.0), vec2(0.0),
	vec2(0.0, 2.0), vec2(0.0, 4.0), vec2(0.0), vec2(0.0),
	vec2(0.0, 2.0), vec2(0.0, 1.0), vec2(0.0), vec2(0.0),
	vec2(0.0), vec2(0.0), vec2(0.0, 1.0), vec2(0.0, 5.0),
	vec2(0.0, 2.0), vec2(0.0, 1.0), vec2(0.0), vec2(0.0),
	vec2(0.0), vec2(0.0), vec2(0.0, 2.0), vec2(0.0, 1.0)
};

varying flat float v_part;
varying flat float v_slot;
varying vec3 v_color;
varying float v_sel;
varying float v_flash;
varying flat float v_mat;

vec3 srgb_to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

// Rotates a model-space point about the X axis through height `pivot`. Negative angles swing forward (+Z).
vec3 rot_x(vec3 p, float pivot, float a) {
	float y = p.y - pivot;
	return vec3(p.x, pivot + y * cos(a) - p.z * sin(a), y * sin(a) + p.z * cos(a));
}

void vertex() {
	float part = floor(UV2.x + 0.5);
	vec3 origin = MODEL_MATRIX[3].xyz;
	float code = floor(INSTANCE_CUSTOM.g + 0.5);
	float role = mod(floor(code / 4.0), 8.0);
	float work = floor(code / 32.0);
	float piece = floor(UV2.y + 0.5);
	// Adventurers carry their role prop, everyone else the tool of their job track.
	int idx = int(role > 0.5 ? role : 7.0 + work) * 4 + int(piece) - 1;
	bool hidden = piece > 0.5 && PROP_SIZE[idx].x == 0.0;  // this prop has no such piece
	float dist = length(INV_VIEW_MATRIX[3].xyz - origin);
	float s = max(1.0, dist * min_screen) * (1.0 + INSTANCE_CUSTOM.a * 0.5);
	float state = mod(code, 4.0);
	float phase = INSTANCE_CUSTOM.b * TAU;

	// Pose for this frame: limb angles, forward bend of the upper body, and a whole-body offset.
	float leg_l = 0.0, leg_r = 0.0, arm_l = 0.0, arm_r = 0.0, bow = 0.0;
	vec3 shift = vec3(0.0);
	float flash = 0.0;
	if (state < 0.5) {
		// Walk: legs and arms swing in opposite phase, the body bobs twice per stride.
		float t = TIME * walk_speed + phase;
		float swing = sin(t) * 0.7;
		leg_l = swing; leg_r = -swing; arm_l = -swing; arm_r = swing;
		shift.y = abs(sin(t)) * 0.08;
	} else if (state < 1.5) {
		float f = fract(TIME * 0.8 + INSTANCE_CUSTOM.b);  // one work cycle every 1.25 s
		if (work < 0.5) {
			// Hammer (craft): slow lift of the right arm, fast strike, a small dip on impact.
			float lift = f < 0.75 ? smoothstep(0.0, 0.75, f) : 1.0 - (f - 0.75) / 0.25;
			arm_r = -(0.3 + 2.3 * lift);
			bow = 0.3 * (1.0 - lift);  // the head nods with each strike: arms are mostly hidden behind the portrait
		} else if (work < 1.5) {
			// Bow (service): a polite bow every other cycle, arms at the sides.
			float g = fract(TIME * 0.4 + INSTANCE_CUSTOM.b);
			bow = 0.55 * (smoothstep(0.1, 0.3, g) - smoothstep(0.55, 0.8, g));
		} else if (work < 2.5) {
			// Dig (land): both arms drive down and forward while the body leans in.
			float d = 0.5 + 0.5 * sin(f * TAU);
			arm_l = -(0.4 + 1.0 * d);
			arm_r = arm_l;
			bow = 0.1 + 0.35 * d;
		} else if (work < 3.5) {
			// Salute (civic): right hand up to the brow, held, then down.
			float g = fract(TIME * 0.3 + INSTANCE_CUSTOM.b);
			float up = smoothstep(0.05, 0.15, g) - smoothstep(0.6, 0.7, g);
			arm_r = -2.7 * up;
			bow = -0.2 * up;  // stand tall and lean back while saluting
		} else {
			// Sword drill (adventurers in town): quick forward strikes.
			float k = abs(sin(f * TAU));
			arm_r = -(0.4 + 1.6 * k);
			bow = 0.25 * k;
			shift.z = 0.15 * k;
		}
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
	vec3 m;
	if (part > 3.5) {
		m = rot_x(vec3(0.0, head_y, 0.0), HIP, bow);  // head center follows the upper body
	} else {
		m = vec3(dot(local, side), local.y, dot(local, fwd));  // model space (instances only yaw)
		if (piece > 0.5 && !hidden) {
			// Shape the unit piece into this prop's box: scale, tilt about Z at its base, place in the hand.
			float a = PROP_ROT_MAT[idx].x;
			vec3 q = m * PROP_SIZE[idx];
			m = PROP_BASE[idx] + vec3(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a), q.z);
			vec3 n = vec3(dot(NORMAL, side), NORMAL.y, dot(NORMAL, fwd));
			n = vec3(n.x * cos(a) - n.y * sin(a), n.x * sin(a) + n.y * cos(a), n.z);
			NORMAL = side * n.x + vec3(0.0, n.y, 0.0) + fwd * n.z;
		}
		if (part < 0.5) {
			m = rot_x(m, HIP, bow);
		} else if (part < 1.5) {
			m = rot_x(m, HIP, m.x < 0.0 ? leg_l : leg_r);
		} else {
			m = rot_x(rot_x(m, SHOULDER, part < 2.5 ? arm_l : arm_r), HIP, bow);
		}
	}
	m += shift;
	local = side * m.x + vec3(0.0, m.y, 0.0) + fwd * m.z;
	if (part > 3.5) {
		// Billboard the portrait around the head center, nudged toward the camera so the body never covers it.
		vec3 right = INV_VIEW_MATRIX[0].xyz;
		vec3 up = INV_VIEW_MATRIX[1].xyz;
		vec3 back = INV_VIEW_MATRIX[2].xyz;
		local += (right * (UV.x - 0.5) + up * (0.5 - UV.y)) * head_size + back * 0.25;
		NORMAL = back;
	}
	VERTEX = hidden ? origin : origin + local * s;  // a collapsed triangle draws nothing
	v_part = part;
	v_slot = INSTANCE_CUSTOM.r;
	v_sel = INSTANCE_CUSTOM.a;
	v_color = srgb_to_linear(COLOR.rgb);
	v_flash = flash;
	v_mat = piece > 0.5 ? PROP_ROT_MAT[idx].y : 0.0;
}

void fragment() {
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	vec3 flash_col = mix(vec3(1.0, 0.15, 0.1), vec3(1.0), step(0.5, fract(TIME * 12.0)));
	if (v_part > 3.5) {
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
		if (v_mat > 0.5) {
			// Prop materials: steel, wood, gold, house color, paper, glowing orb.
			ALBEDO = v_mat < 1.5 ? vec3(0.72, 0.76, 0.82) : v_mat < 2.5 ? vec3(0.42, 0.26, 0.13) : v_mat < 3.5 ? vec3(1.0, 0.76, 0.2)
				: v_mat < 4.5 ? v_color : v_mat < 5.5 ? vec3(0.95, 0.92, 0.82) : vec3(0.55, 0.95, 1.0);
			if (v_mat > 5.5) {
				EMISSION = vec3(0.4, 0.85, 1.0);
			}
		} else if (v_part > 1.5) {
			ALBEDO = mix(v_color, vec3(1.0), 0.3);
		} else if (v_part > 0.5) {
			ALBEDO = v_color * 0.3;
		} else {
			ALBEDO = v_color;
		}
		EMISSION += flash_col * v_flash * 0.8;
	}
}
