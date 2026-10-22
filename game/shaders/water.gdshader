shader_type spatial;
// Stylized sea: gentle color ripples, slightly transparent so the shallow sea floor shows.
render_mode cull_back, specular_schlick_ggx, depth_draw_opaque;

uniform vec3 deep : source_color = vec3(0.13, 0.36, 0.66);
uniform vec3 light : source_color = vec3(0.32, 0.62, 0.86);
uniform float alpha = 0.86;

varying vec3 v_world;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float w = sin(v_world.x * 0.08 + TIME * 0.6) * sin(v_world.z * 0.07 - TIME * 0.45);
	float w2 = sin((v_world.x + v_world.z) * 0.23 + TIME * 1.1) * 0.5;
	float t = clamp(0.5 + 0.35 * w + 0.15 * w2, 0.0, 1.0);
	ALBEDO = mix(deep, light, t * 0.55);
	ROUGHNESS = 0.35;
	SPECULAR = 0.25;
	ALPHA = alpha;
}
