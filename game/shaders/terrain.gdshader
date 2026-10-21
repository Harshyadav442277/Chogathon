shader_type spatial;
// Terrain: COLOR.rgb = sRGB ground color, COLOR.a = lava amount (glows and flickers).
// Close to the camera it adds procedural detail (colour variation, speckle, field patches) that fades
// out with distance, and an animated foam line at the shoreline. cull_disabled so LOD skirts always draw.
render_mode cull_disabled, specular_disabled;

uniform float detail_near = 40.0;
uniform float detail_far = 230.0;

varying vec3 v_world;

vec3 s2l(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 albedo = s2l(COLOR.rgb);
	float dist = length(v_world - CAMERA_POSITION_WORLD);
	float detail = 1.0 - smoothstep(detail_near, detail_far, dist);
	// Broad patches (fields, darker grass) are visible at mid range; fine speckle only up close.
	float patches = vnoise(v_world.xz * 0.06) - 0.5;
	float speck = vnoise(v_world.xz * 1.7) - 0.5;
	float grain = hash(floor(v_world.xz * 3.0)) - 0.5;
	float near = 1.0 - smoothstep(10.0, detail_near * 2.0, dist);
	albedo *= 1.0 + patches * 0.16 * (0.4 + 0.6 * detail) + speck * 0.14 * detail + grain * 0.08 * near;
	// Shoreline foam on the beach just above the water.
	float shore = smoothstep(0.9, 0.2, v_world.y) * step(-0.25, v_world.y);
	float wave = 0.5 + 0.5 * sin(TIME * 1.6 + v_world.x * 0.35 + v_world.z * 0.27);
	albedo = mix(albedo, vec3(0.92, 0.95, 1.0), shore * (0.35 + 0.4 * wave));
	ALBEDO = albedo;
	ROUGHNESS = 1.0;
	float lava = COLOR.a;
	float pulse = 0.75 + 0.25 * sin(TIME * 1.7 + v_world.x * 0.15 + v_world.z * 0.11);
	EMISSION = albedo * lava * 2.6 * pulse;
}
