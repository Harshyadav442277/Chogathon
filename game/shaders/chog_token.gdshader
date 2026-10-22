shader_type spatial;
// One MultiMesh draws every Chog: a camera-facing disc showing its portrait from the atlas,
// ringed in its house color. INSTANCE_CUSTOM.r = atlas slot (tokenId - 1), .g = highlight (0..1).
// Instance COLOR = house color (sRGB).
render_mode unshaded, cull_disabled, depth_draw_opaque;

uniform sampler2D atlas : source_color, filter_linear_mipmap;
uniform float cols = 45.0;
uniform float rows = 44.0;
uniform float base_scale = 1.7;
uniform float min_screen = 0.011;

varying flat float v_slot;
varying vec3 v_color;
varying float v_sel;

vec3 srgb_to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void vertex() {
	vec3 center = MODEL_MATRIX[3].xyz;
	float dist = length(INV_VIEW_MATRIX[3].xyz - center);
	float s = max(base_scale, dist * min_screen) * (1.0 + INSTANCE_CUSTOM.g * 0.8);
	// Billboard: keep the instance position, take rotation from the camera.
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * s, INV_VIEW_MATRIX[1] * s, INV_VIEW_MATRIX[2] * s, MODEL_MATRIX[3]);
	VERTEX.y += 0.5;
	v_slot = INSTANCE_CUSTOM.r;
	v_sel = INSTANCE_CUSTOM.g;
	v_color = srgb_to_linear(COLOR.rgb);
}

void fragment() {
	vec2 p = UV - 0.5;
	float r = length(p);
	if (r > 0.5) {
		discard;
	}
	vec3 col;
	if (r > 0.41) {
		col = mix(v_color, vec3(1.0, 0.72, 0.1), v_sel);
	} else {
		float c = mod(v_slot, cols);
		float row = floor(v_slot / cols);
		vec4 t = texture(atlas, vec2((c + UV.x) / cols, (row + UV.y) / rows));
		col = t.a < 0.1 ? v_color * 0.7 : t.rgb;
	}
	ALBEDO = col;
}
