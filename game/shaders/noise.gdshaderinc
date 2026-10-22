// Shared hashes and value noise for the procedural surface shaders (terrain, buildings, props).
// Fract-based hashes keep precision on WebGL for large world coordinates.

vec3 s2l(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float hash3(vec3 p3) {
	p3 = fract(p3 * 0.1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}

// Noise comes from textures/noise.png (made by tools/make_noise.py): one mipmapped texture read instead
// of many hashes per pixel, and mipmaps keep distant patterns from shimmering. Each material that uses
// these shaders must set `noise_tex` (see Terrain/Settlements/Interiors).
uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;

float vnoise(vec2 p) {
	return texture(noise_tex, p * 0.03125).r;
}

float fbm(vec2 p) {
	return texture(noise_tex, p * 0.03125).g;
}

// cheap 3D noise: average of three axis-plane lookups
float vnoise3(vec3 p) {
	return (texture(noise_tex, p.xy * 0.03125).r + texture(noise_tex, p.yz * 0.03125 + 0.37).b + texture(noise_tex, p.zx * 0.03125 + 0.71).r) / 3.0 * 1.5 - 0.25;
}

float fbm3(vec3 p) {
	return (texture(noise_tex, p.xy * 0.03125).g + texture(noise_tex, p.yz * 0.03125 + 0.37).g + texture(noise_tex, p.zx * 0.03125 + 0.71).g) / 3.0 * 1.5 - 0.25;
}

// Running-bond brick or block pattern. Returns (shade multiplier, height for bump).
vec2 bricks(vec2 uv, vec2 size, float seed) {
	vec2 b = uv / size;
	b.x += 0.5 * mod(floor(b.y), 2.0);
	vec2 id = floor(b);
	vec2 f = fract(b);
	float e = min(min(f.x, 1.0 - f.x) * size.x, min(f.y, 1.0 - f.y) * size.y);
	float mortar = 1.0 - smoothstep(0.02, 0.055, e);
	float shade = (0.84 + 0.3 * hash(id + seed)) * (0.9 + 0.2 * vnoise(uv * 7.0));
	return vec2(mix(shade, 0.6, mortar), smoothstep(0.0, 0.07, e) * 0.04 + vnoise(uv * 11.0) * 0.006);
}
