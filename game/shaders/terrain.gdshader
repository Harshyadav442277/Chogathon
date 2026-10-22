shader_type spatial;
// Terrain: COLOR.rgb = sRGB ground color, COLOR.a = lava amount (glows and flickers).
// Procedural ground textures picked from the color, height and slope: grass blades with lush/dry patches
// and tiny wildflowers, dirt with pebbles, sand ripples, rock strata on steep slopes. Fine detail
// and bump lighting fade out with distance (so nothing shimmers far away); broad patches stay at mid range.
// Animated foam at the shoreline. cull_disabled so LOD skirts always draw.
render_mode cull_disabled, specular_disabled;

#include "res://shaders/noise.gdshaderinc"

uniform float detail_near = 40.0;
uniform float detail_far = 260.0;

varying vec3 v_world;
varying vec3 v_wnormal;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_wnormal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}

void fragment() {
	vec3 col = COLOR.rgb;
	vec3 albedo = s2l(col);
	float lava = COLOR.a;
	float dist = length(v_world - CAMERA_POSITION_WORLD);
	float detail = 1.0 - smoothstep(detail_near, detail_far, dist);
	float fine = 1.0 - smoothstep(20.0, 120.0, dist);
	float close = 1.0 - smoothstep(10.0, 70.0, dist);
	vec3 wn = normalize(v_wnormal);
	vec2 p = v_world.xz;

	// what kind of ground is this?
	float green = smoothstep(0.015, 0.08, col.g - max(col.r, col.b));
	float sand = (1.0 - smoothstep(1.7, 2.4, v_world.y)) * smoothstep(0.2, 0.5, v_world.y);
	float rock = smoothstep(0.22, 0.45, 1.0 - wn.y) * (1.0 - lava);

	// one broad and one mid-scale noise read, reused by several layers (r, g = fbm, b)
	vec4 broad = texture(noise_tex, p * 0.0011);
	vec4 mid = texture(noise_tex, p * 0.044);
	albedo *= 1.0 + (broad.g - 0.5) * 0.3 * (0.4 + 0.6 * detail);

	// grass: crossing streaks of blades (close only), mottling, lush/dry patches
	float blades = 0.5;
	if (fine > 0.0) {
		blades = (vnoise(p * vec2(9.0, 2.2)) + vnoise(p.yx * vec2(8.0, 2.6) + 3.0)) * 0.5;
	}
	float grass_mul = 1.0 + (blades - 0.5) * 0.5 * fine + (mid.r - 0.5) * 0.2 * detail;
	vec3 grass_tint = mix(vec3(0.9, 1.02, 0.86), vec3(1.1, 1.04, 0.78), smoothstep(0.35, 0.7, broad.b));
	// dirt: mottled earth with pebbles
	float peb = 0.0;
	float grain = 0.0;
	if (fine > 0.0) {  // per-pixel hashes only where they can be seen
		vec2 pc = floor(p * 2.2);
		vec2 pf = fract(p * 2.2) - 0.5 + (vec2(hash(pc), hash(pc + 2.0)) - 0.5) * 0.4;
		peb = step(0.72, hash(pc + 1.3)) * (1.0 - smoothstep(0.1, 0.2, length(pf)));
		grain = hash(floor(p * 20.0)) - 0.5;
	}
	float dirt_n = mid.g;
	float dirt_mul = 1.0 + (dirt_n - 0.5) * 0.45 * detail + peb * 0.22 * fine;
	// sand: gentle wind ripples and grain
	float rip = sin(dot(p, vec2(0.8, 0.6)) * 4.0 + mid.b * 2.5);
	float sand_mul = 1.0 + (rip * 0.05 + grain * 0.08) * fine;

	float mul = mix(dirt_mul, grass_mul, green);
	mul = mix(mul, sand_mul, sand);
	albedo *= mix(vec3(1.0), grass_tint, green * (1.0 - sand) * detail) * mul;
	// rock on steep slopes: strata and lumps (noise isolines read as map contours, so no cracks here)
	float rockn = 0.5;
	float strata = 0.5;
	if (rock > 0.001) {
		vec4 rn = texture(noise_tex, (p * 0.8 + v_world.y * 0.3) * 0.03125);
		rockn = rn.g;
		strata = vnoise(vec2(v_world.y * 2.2, (p.x + p.y) * 0.15));
		float rock_mul = 1.0 + ((0.7 + 0.4 * rockn) * (0.85 + 0.25 * strata) - 1.0) * detail;
		vec3 rock_col = mix(albedo, vec3(dot(albedo, vec3(0.3, 0.5, 0.2))) * vec3(1.06, 1.0, 0.9), 0.6) * rock_mul;
		albedo = mix(albedo, rock_col, rock);
	}

	// tiny wildflowers in the grass, only up close
	if (close > 0.0) {
		vec2 fcell = floor(p * 1.6);
		float fl = step(0.982, hash(fcell)) * (1.0 - smoothstep(0.07, 0.13, length(fract(p * 1.6) - 0.5)));
		vec3 flower = mix(vec3(1.0, 0.8, 0.15), vec3(1.0, 0.35, 0.6), hash(fcell + 5.0));
		flower = mix(flower, vec3(0.95), step(0.75, hash(fcell + 9.0)));
		albedo = mix(albedo, flower, fl * green * close * (1.0 - rock) * (1.0 - sand));
	}

	// shoreline foam on the beach just above the water
	float shore = smoothstep(0.9, 0.2, v_world.y) * step(-0.25, v_world.y) * smoothstep(0.55, 0.8, wn.y);  // not on cliffs
	float wave = 0.5 + 0.5 * sin(TIME * 1.6 + v_world.x * 0.35 + v_world.z * 0.27);
	albedo = mix(albedo, vec3(0.92, 0.95, 1.0), shore * (0.35 + 0.4 * wave));
	ALBEDO = albedo;
	ROUGHNESS = 1.0;

	// bump from the same patterns (Mikkelsen surface gradient, view space), close range only. The branch
	// edge is where `fine` reaches 0, so the height there is ~0 and derivative edge effects can't show.
	if (fine > 0.0) {
		float h = mix(mix(dirt_n * 0.03 + peb * 0.05, blades * 0.035, green), rip * 0.006, sand);
		h = mix(h, rockn * 0.3 + strata * 0.08, rock) * fine;
		vec3 dpx = dFdx(VERTEX);
		vec3 dpy = dFdy(VERTEX);
		float dhx = dFdx(h);
		float dhy = dFdy(h);
		vec3 r1 = cross(dpy, NORMAL);
		vec3 r2 = cross(NORMAL, dpx);
		float det = dot(dpx, r1);
		vec3 bumped = abs(det) * NORMAL - sign(det) * (dhx * r1 + dhy * r2);
		NORMAL = length(bumped) > 1e-8 ? normalize(bumped) : NORMAL;
	}

	if (lava > 0.0) {
		float pulse = 0.75 + 0.25 * sin(TIME * 1.7 + v_world.x * 0.15 + v_world.z * 0.11);
		EMISSION = albedo * lava * 2.6 * pulse;
	}
}
