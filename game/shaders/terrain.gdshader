shader_type spatial;
// Terrain: COLOR.rgb = sRGB ground color, COLOR.a = lava amount (glows and flickers).
render_mode cull_back, specular_disabled;

vec3 s2l(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

varying vec3 v_world;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 albedo = s2l(COLOR.rgb);
	ALBEDO = albedo;
	ROUGHNESS = 1.0;
	float lava = COLOR.a;
	float pulse = 0.75 + 0.25 * sin(TIME * 1.7 + v_world.x * 0.15 + v_world.z * 0.11);
	EMISSION = albedo * lava * 2.6 * pulse;
}
