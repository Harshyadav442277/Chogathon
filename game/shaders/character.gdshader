shader_type spatial;
// One MultiMesh draws every Chog as a little chibi (mesh from scripts/characters/chibi_mesh.gd).
// UV2.x = body part (0 torso, 1 legs, 2 left arm, 3 right arm, 4 face).
// The face is the Chog's NFT portrait from the atlas, turned toward the camera and ringed in its house color.
// Instance COLOR = house color (sRGB). INSTANCE_CUSTOM: r = atlas slot (tokenId - 1),
// g = state + 4 * role (state 0 walk, 1 work, 2 fight; role 0 civilian, 1..6 adventurer roles),
// b = phase offset 0..1, a = highlight 0..1.
render_mode world_vertex_coords, cull_back, depth_draw_opaque;

uniform sampler2D atlas : source_color, filter_linear_mipmap;
uniform float cols = 45.0;
uniform float rows = 44.0;
uniform float head_y = 1.2;      // ChibiMesh.HEAD_Y
uniform float head_size = 1.0;   // ChibiMesh.HEAD_SIZE
uniform float min_screen = 0.0065;  // grow with distance so Chogs stay visible zoomed out
uniform float walk_speed = 9.0;     // stride rate, rad/s

varying flat float v_part;
varying flat float v_slot;
varying vec3 v_color;
varying float v_sel;

vec3 srgb_to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void vertex() {
	float part = floor(UV2.x + 0.5);
	vec3 origin = MODEL_MATRIX[3].xyz;
	float dist = length(INV_VIEW_MATRIX[3].xyz - origin);
	float s = max(1.0, dist * min_screen) * (1.0 + INSTANCE_CUSTOM.a * 0.5);
	vec3 local = VERTEX - origin;
	float state = mod(floor(INSTANCE_CUSTOM.g + 0.5), 4.0);
	float bob = 0.0;
	if (state < 0.5) {
		// Walk: legs and arms swing in opposite phase around hip and shoulder, the body bobs twice per stride.
		vec3 side = MODEL_MATRIX[0].xyz;
		vec3 fwd = MODEL_MATRIX[2].xyz;
		vec3 m = vec3(dot(local, side), local.y, dot(local, fwd));  // model-space position (instances only yaw)
		float t = TIME * walk_speed + INSTANCE_CUSTOM.b * 6.2832;
		float swing = sin(t) * 0.7;
		float angle = 0.0;
		float pivot = 0.0;
		if (part > 0.5 && part < 1.5) {
			angle = m.x < 0.0 ? swing : -swing;
			pivot = 0.34;
		} else if (part > 1.5 && part < 3.5) {
			angle = part < 2.5 ? -swing : swing;
			pivot = 0.78;
		}
		float y = m.y - pivot;
		m = vec3(m.x, pivot + y * cos(angle) - m.z * sin(angle), y * sin(angle) + m.z * cos(angle));
		bob = abs(sin(t)) * 0.08;
		m.y += bob;
		local = side * m.x + vec3(0.0, m.y, 0.0) + fwd * m.z;
	}
	if (part > 3.5) {
		// Billboard the portrait around the head center, nudged toward the camera so the body never covers it.
		vec3 right = INV_VIEW_MATRIX[0].xyz;
		vec3 up = INV_VIEW_MATRIX[1].xyz;
		vec3 back = INV_VIEW_MATRIX[2].xyz;
		local = vec3(0.0, head_y + bob, 0.0) + (right * (UV.x - 0.5) + up * (0.5 - UV.y)) * head_size + back * 0.25;
		NORMAL = back;
	}
	VERTEX = origin + local * s;
	v_part = part;
	v_slot = INSTANCE_CUSTOM.r;
	v_sel = INSTANCE_CUSTOM.a;
	v_color = srgb_to_linear(COLOR.rgb);
}

void fragment() {
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	if (v_part > 3.5) {
		vec2 p = UV - 0.5;
		float r = length(p);
		if (r > 0.5) {
			discard;
		}
		vec3 col;
		if (r > 0.42) {
			col = mix(v_color, vec3(1.0, 0.72, 0.1), v_sel);
		} else {
			float c = mod(v_slot, cols);
			float row = floor(v_slot / cols);
			vec4 t = texture(atlas, vec2((c + UV.x) / cols, (row + UV.y) / rows));
			col = t.a < 0.1 ? v_color * 0.7 : t.rgb;
		}
		// The portrait is shown unlit, like the old tokens, so the NFT reads the same everywhere.
		ALBEDO = vec3(0.0);
		EMISSION = col;
	} else if (v_part > 1.5) {
		ALBEDO = mix(v_color, vec3(1.0), 0.3);
	} else if (v_part > 0.5) {
		ALBEDO = v_color * 0.3;
	} else {
		ALBEDO = v_color;
	}
}
