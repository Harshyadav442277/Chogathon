shader_type spatial;
// Shared material for every procedural building and prop (see scripts/architect.gd).
// COLOR = sRGB vertex color; UV.x = glow (0.5 night-only, 1 always); UV.y = take region tint.
// INSTANCE_CUSTOM.rgb = region tint (sRGB), .a = 1 when the instance has a tint.
render_mode cull_back, specular_disabled;

uniform float night = 0.0;   // 0 day .. 1 night; makes windows and lanterns glow
uniform float time_scale = 1.0;

varying vec3 v_tint;
varying float v_has_tint;
varying float v_flicker;

vec3 s2l(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void vertex() {
	v_tint = INSTANCE_CUSTOM.rgb;
	v_has_tint = INSTANCE_CUSTOM.a;
	// per-instance flicker phase from its world position
	vec3 wp = MODEL_MATRIX[3].xyz;
	v_flicker = 0.85 + 0.15 * sin(TIME * time_scale * 3.0 + wp.x * 0.37 + wp.z * 0.21);
}

void fragment() {
	vec3 base = s2l(COLOR.rgb);
	vec3 albedo = mix(base, base * s2l(v_tint), UV.y * v_has_tint);
	ALBEDO = albedo;
	ROUGHNESS = 0.9;
	float always = step(0.75, UV.x);
	float nightly = step(0.25, UV.x) * (1.0 - always) * night;
	EMISSION = albedo * (always * 1.6 * v_flicker + nightly * 2.2);
}
