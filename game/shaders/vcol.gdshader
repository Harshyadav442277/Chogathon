shader_type spatial;
// Shared material for every procedural building and prop (see scripts/architect.gd).
// COLOR = sRGB vertex color; UV.x = glow (0.5 night-only, 1 always); UV.y = take region tint.
// UV2.x = surface material (Architect.M_*): procedural brick, plaster, wood planks, roof shingles, leaves,
// bark, rock, grass and cloth, with bump lighting from screen-space derivatives. All of it fades out
// with distance, so far away the flat colors stay clean and cheap. Leaves and grass sway in the wind.
// INSTANCE_CUSTOM.rgb = region tint (sRGB), .a = 1 when the instance has a tint.
render_mode cull_back, specular_disabled;

#include "res://shaders/noise.gdshaderinc"

uniform float night = 0.0;   // 0 day .. 1 night; makes windows and lanterns glow
uniform float time_scale = 1.0;
uniform float detail_far = 150.0;

varying vec3 v_tint;
varying float v_has_tint;
varying float v_flicker;
varying vec3 v_obj;
varying vec3 v_onorm;
varying float v_mat;
varying float v_rand;

void vertex() {
	v_tint = INSTANCE_CUSTOM.rgb;
	v_has_tint = INSTANCE_CUSTOM.a;
	// per-instance flicker phase and random value from its world position
	vec3 wp = MODEL_MATRIX[3].xyz;
	v_flicker = 0.85 + 0.15 * sin(TIME * time_scale * 3.0 + wp.x * 0.37 + wp.z * 0.21);
	v_rand = hash(wp.xz + 0.37);
	v_obj = VERTEX;
	v_onorm = NORMAL;
	v_mat = UV2.x;
	int m = int(UV2.x + 0.5);
	if (m == 5 || m == 8) {
		// wind: leaves sway gently above the trunk, grass bends from the root
		bool grass = m == 8;
		float lift = max(VERTEX.y - (grass ? 0.0 : 1.5), 0.0);
		float amp = grass ? 0.16 : 0.03;
		float ph = TIME * time_scale * (grass ? 2.1 : 1.0) + wp.x * 0.13 + wp.z * 0.17 + VERTEX.x * 0.3;
		VERTEX.x += sin(ph) * amp * lift;
		VERTEX.z += cos(ph * 0.8 + 1.3) * amp * 0.6 * lift;
	}
}

void fragment() {
	vec3 base = s2l(COLOR.rgb);
	vec3 albedo = mix(base, base * s2l(v_tint), UV.y * v_has_tint);
	int m = int(v_mat + 0.5);
	float detail = 1.0 - smoothstep(detail_far * 0.35, detail_far, length(VERTEX));
	vec3 n = normalize(v_onorm);
	// 2D surface coordinates: top/bottom faces use XZ, walls use (along-wall, height)
	vec3 tang = length(n.xz) > 0.01 ? normalize(vec3(-n.z, 0.0, n.x)) : vec3(1.0, 0.0, 0.0);
	vec2 wall_uv = vec2(dot(v_obj, tang), v_obj.y);
	vec2 uv = abs(n.y) > 0.7 ? v_obj.xz : wall_uv;
	float mul = 1.0;
	float h = 0.0;
	float bump = 1.0;
	if (m == 1) {
		// stone blocks with recessed mortar
		vec2 b = bricks(uv, vec2(0.95, 0.45), 3.1);
		mul = b.x;
		h = b.y;
	} else if (m == 2) {
		// plaster: soft blotches, grime at the base, the odd patch of exposed brick
		mul = 0.9 + 0.18 * fbm(uv * 1.3) + 0.06 * (vnoise(uv * 14.0) - 0.5);
		mul *= mix(0.8, 1.0, smoothstep(0.0, 1.1, v_obj.y));
		h = vnoise(uv * 9.0) * 0.012;
		float patch = vnoise(uv * 0.8 + 17.0);
		if (abs(n.y) < 0.7 && patch > 0.76) {
			vec2 b = bricks(uv, vec2(0.5, 0.24), 8.0);
			float k = smoothstep(0.76, 0.8, patch);
			mul = mix(mul, b.x * 0.62, k);
			h = mix(h, b.y - 0.02, k);
		}
	} else if (m == 3) {
		// wood planks (vertical on walls), grain and knots
		float px = uv.x / 0.32;
		float pid = floor(px);
		float pf = fract(px);
		float gap = 1.0 - smoothstep(0.0, 0.09, min(pf, 1.0 - pf));
		float grain = vnoise(vec2(uv.x * 34.0, uv.y * 1.6 + pid * 7.0));
		float knot = smoothstep(0.86, 0.96, vnoise(uv * vec2(3.0, 1.2) + pid * 3.7));
		mul = (0.84 + 0.26 * hash(vec2(pid, 1.7))) * (0.84 + 0.3 * grain) * mix(1.0, 0.5, gap) * (1.0 - knot * 0.35);
		h = (1.0 - gap) * 0.02 + grain * 0.006;
	} else if (m == 4) {
		// overlapping roof shingles: rows by height, dark lower lip, per-tile variation, moss
		vec2 r = vec2(wall_uv.x / 0.5, v_obj.y / 0.3);
		r.x += 0.5 * mod(floor(r.y), 2.0);
		vec2 id = floor(r);
		vec2 f = fract(r);
		float side = 1.0 - smoothstep(0.0, 0.06, min(f.x, 1.0 - f.x));
		mul = (0.8 + 0.32 * hash(id + 0.7)) * mix(0.6, 1.06, smoothstep(0.0, 0.5, f.y)) * mix(1.0, 0.72, side);
		mul *= 0.92 + 0.16 * vnoise(wall_uv * 8.0);
		float moss = smoothstep(0.62, 0.8, vnoise(wall_uv * 0.7 + v_rand * 20.0));
		albedo = mix(albedo, vec3(0.12, 0.2, 0.07), moss * 0.45 * detail);
		h = f.y * 0.05 - side * 0.01;
	} else if (m == 5) {
		// clumps of leaves; each tree a slightly different hue
		vec3 q = v_obj * 2.6 + v_rand * 10.0;
		float leaf = vnoise3(q) * 0.6 + vnoise(wall_uv * 6.0 + v_rand * 13.0) * 0.4;
		mul = 0.68 + 0.6 * leaf;
		albedo *= mix(vec3(0.9, 1.0, 1.08), vec3(1.12, 1.03, 0.82), v_rand);
		h = leaf * 0.14;
		bump = 1.6;
	} else if (m == 6) {
		// bark: vertical ridges
		float ridge = vnoise(vec2(wall_uv.x * 7.0, wall_uv.y * 0.9));
		float fine = vnoise(vec2(wall_uv.x * 22.0, wall_uv.y * 3.0));
		mul = 0.62 + 0.5 * ridge * (0.7 + 0.3 * fine);
		h = ridge * 0.05;
	} else if (m == 7) {
		// rock: lumpy fbm, dark cracks, faint strata, moss on top
		vec3 q = v_obj * 1.6 + v_rand * 7.0;
		float f1 = fbm3(q);
		float crack = 1.0 - smoothstep(0.0, 0.035, abs(vnoise(uv * 2.7 + 3.0) - 0.5));
		float strata = 0.5 + 0.5 * sin(v_obj.y * 9.0 + f1 * 4.0);
		mul = (0.74 + 0.42 * f1) * (0.92 + 0.12 * strata) * mix(1.0, 0.55, crack);
		float moss = smoothstep(0.5, 0.9, n.y) * smoothstep(0.5, 0.7, f1);
		albedo = mix(albedo, vec3(0.1, 0.18, 0.05), moss * 0.7 * detail);
		h = f1 * 0.15 - crack * 0.04;
	} else if (m == 8) {
		// grass blades: dark roots, bright tips
		mul = mix(0.45, 1.15, clamp(v_obj.y / 0.6, 0.0, 1.0)) * (0.9 + 0.2 * v_rand);
		bump = 0.0;
	} else if (m == 9) {
		// cloth: weave and soft folds
		mul = (0.93 + 0.07 * sin(uv.x * 60.0) * sin(uv.y * 60.0)) * (0.9 + 0.1 * sin(uv.x * 9.0)) + 0.1 * (vnoise(uv * 3.0) - 0.5);
		h = sin(uv.x * 9.0) * 0.02;
	} else {
		mul = 0.95 + 0.1 * vnoise(uv * 4.0);
		bump = 0.0;
	}
	albedo *= mix(1.0, mul, detail);
	// contact shadow near the ground and darker undersides (cheap ambient occlusion)
	float ao = mix(0.62, 1.0, smoothstep(-0.2, 1.3, v_obj.y)) * mix(0.72, 1.0, n.y * 0.5 + 0.5);
	if (m != 8) {
		albedo *= ao;
	}
	ALBEDO = albedo;
	ROUGHNESS = 0.9;
	// bump mapping from the procedural height (Mikkelsen surface gradient, view space); derivatives
	// are taken outside any branch so they stay defined on every GPU
	float hb = h * bump * detail;
	vec3 dpx = dFdx(VERTEX);
	vec3 dpy = dFdy(VERTEX);
	float dhx = dFdx(hb);
	float dhy = dFdy(hb);
	vec3 r1 = cross(dpy, NORMAL);
	vec3 r2 = cross(NORMAL, dpx);
	float det = dot(dpx, r1);
	vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
	vec3 bumped = abs(det) * NORMAL - grad;
	NORMAL = length(bumped) > 1e-8 ? normalize(bumped) : NORMAL;
	float always = step(0.75, UV.x);
	float nightly = step(0.25, UV.x) * (1.0 - always) * night;
	EMISSION = albedo * (always * 1.6 * v_flicker + nightly * 2.2);
}
