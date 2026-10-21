shader_type spatial;
// Ground cover (grass tufts, flower clumps) from scripts/terrain.gd. Double-sided blades that sway in
// the wind and shrink away smoothly towards fade_end, so cover never pops in. COLOR = vertex color times
// the MultiMesh instance color (the ground color under the tuft), both sRGB.
render_mode cull_disabled, specular_disabled;

#include "res://shaders/noise.gdshaderinc"

uniform float fade_start = 55.0;
uniform float fade_end = 95.0;

varying float v_y;
varying float v_rand;

void vertex() {
	vec3 wp = MODEL_MATRIX[3].xyz;
	v_rand = hash(wp.xz + 0.71);
	v_y = VERTEX.y;
	float shrink = 1.0 - smoothstep(fade_start, fade_end, distance(wp, CAMERA_POSITION_WORLD));
	float ph = TIME * 2.1 + wp.x * 0.13 + wp.z * 0.17;
	float gust = 0.6 + 0.4 * sin(TIME * 0.5 + wp.x * 0.02);
	VERTEX.x += sin(ph) * 0.18 * gust * VERTEX.y;
	VERTEX.z += cos(ph * 0.8 + 1.3) * 0.1 * gust * VERTEX.y;
	VERTEX *= shrink;
	// soft, mostly-up normals so tufts light like the ground they grow from
	NORMAL = normalize(mix(NORMAL, vec3(0.0, 1.0, 0.0), 0.7));
}

void fragment() {
	vec3 albedo = s2l(COLOR.rgb);
	albedo *= mix(0.45, 1.18, clamp(v_y / 0.7, 0.0, 1.0)) * (0.88 + 0.24 * v_rand);
	ALBEDO = albedo;
	ROUGHNESS = 1.0;
	// light passing through thin blades
	BACKLIGHT = albedo * 0.35;
}
