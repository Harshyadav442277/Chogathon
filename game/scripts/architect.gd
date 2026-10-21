class_name Architect
extends RefCounted
## Tiny procedural mesh builder for low-poly buildings and props.
## Every triangle is flat-shaded and wound so its face points away from the part's centre
## (Godot front faces are clockwise). Per-vertex data used by shaders/vcol.gdshader:
##   COLOR  = sRGB vertex color
##   UV.x   = glow: 0 none, 0.5 glows at night (windows, lanterns), 1.0 always glows (lava, crystals, magic)
##   UV.y   = 1 to take the instance's region tint (roofs, banners), 0 to keep the vertex color

var verts := PackedVector3Array()
var norms := PackedVector3Array()
var cols := PackedColorArray()
var uvs := PackedVector2Array()

const WINDOW := Color("#ffd27a")
const DARK := Color("#3a2a24")
const STONE := Color("#b9b2a6")
const WOOD := Color("#8a5a3a")
const PLASTER := Color("#efe6d2")
const TINT := Color(1, 1, 1)  # roof/banner placeholder that takes the region tint


func _tri(a: Vector3, b: Vector3, c: Vector3, col: Color, center: Vector3, glow: float, tint: float) -> void:
	var g := (b - a).cross(c - a)
	if g.length_squared() < 1e-10:
		return
	var mid := (a + b + c) / 3.0
	# For Godot's clockwise front faces, (b-a)x(c-a) points INTO the surface. Make it point inward.
	if g.dot(mid - center) > 0.0:
		var t := b
		b = c
		c = t
		g = -g
	var n := (-g).normalized()
	for v in [a, b, c]:
		verts.append(v)
		norms.append(n)
		cols.append(col)
		uvs.append(Vector2(glow, tint))


func _quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color, center: Vector3, glow := 0.0, tint := 0.0) -> void:
	_tri(a, b, c, col, center, glow, tint)
	_tri(a, c, d, col, center, glow, tint)


## Axis-aligned box standing on `base` (bottom centre).
func box(base: Vector3, size: Vector3, col: Color, glow := 0.0, tint := 0.0) -> void:
	var h := size / 2.0
	var c := base + Vector3(0, h.y, 0)
	var p := [
		c + Vector3(-h.x, -h.y, -h.z), c + Vector3(h.x, -h.y, -h.z), c + Vector3(h.x, -h.y, h.z), c + Vector3(-h.x, -h.y, h.z),
		c + Vector3(-h.x, h.y, -h.z), c + Vector3(h.x, h.y, -h.z), c + Vector3(h.x, h.y, h.z), c + Vector3(-h.x, h.y, h.z),
	]
	_quad(p[0], p[1], p[2], p[3], col, c, glow, tint)  # bottom
	_quad(p[4], p[5], p[6], p[7], col, c, glow, tint)  # top
	_quad(p[0], p[1], p[5], p[4], col, c, glow, tint)
	_quad(p[1], p[2], p[6], p[5], col, c, glow, tint)
	_quad(p[2], p[3], p[7], p[6], col, c, glow, tint)
	_quad(p[3], p[0], p[4], p[7], col, c, glow, tint)


## Gable roof whose ridge runs along X, sitting on top of a w x d footprint at height `y`.
func gable(base: Vector3, w: float, d: float, h: float, col: Color, tint := 1.0) -> void:
	var c := base + Vector3(0, h * 0.35, 0)
	var x := w / 2.0 + 0.3
	var z := d / 2.0 + 0.4
	var a := base + Vector3(-x, 0, -z)
	var b := base + Vector3(x, 0, -z)
	var e := base + Vector3(x, 0, z)
	var f := base + Vector3(-x, 0, z)
	var r1 := base + Vector3(-x, h, 0)
	var r2 := base + Vector3(x, h, 0)
	_quad(a, b, r2, r1, col, c, 0.0, tint)
	_quad(f, e, r2, r1, col, c, 0.0, tint)
	_tri(a, f, r1, col, c, 0.0, tint)
	_tri(b, e, r2, col, c, 0.0, tint)
	_quad(a, b, e, f, col, c, 0.0, tint)


## Four-sided pyramid roof.
func pyramid(base: Vector3, w: float, d: float, h: float, col: Color, tint := 1.0, glow := 0.0) -> void:
	var c := base + Vector3(0, h * 0.25, 0)
	var x := w / 2.0
	var z := d / 2.0
	var p := [base + Vector3(-x, 0, -z), base + Vector3(x, 0, -z), base + Vector3(x, 0, z), base + Vector3(-x, 0, z)]
	var top := base + Vector3(0, h, 0)
	for i in 4:
		_tri(p[i], p[(i + 1) % 4], top, col, c, glow, tint)
	_quad(p[0], p[1], p[2], p[3], col, c, glow, tint)


## Cylinder (or cone/frustum when r_top differs) standing on `base`.
func cyl(base: Vector3, r: float, h: float, col: Color, segs := 8, r_top := -1.0, glow := 0.0, tint := 0.0) -> void:
	if r_top < 0.0:
		r_top = r
	var c := base + Vector3(0, h / 2.0, 0)
	var top := base + Vector3(0, h, 0)
	for i in segs:
		var a0 := TAU * i / segs
		var a1 := TAU * (i + 1) / segs
		var b0 := base + Vector3(cos(a0) * r, 0, sin(a0) * r)
		var b1 := base + Vector3(cos(a1) * r, 0, sin(a1) * r)
		var t0 := top + Vector3(cos(a0) * r_top, 0, sin(a0) * r_top)
		var t1 := top + Vector3(cos(a1) * r_top, 0, sin(a1) * r_top)
		if r_top > 0.001:
			_quad(b0, b1, t1, t0, col, c, glow, tint)
			_tri(top, t0, t1, col, c, glow, tint)
		else:
			_tri(b0, b1, top, col, c, glow, tint)
		_tri(base, b1, b0, col, c, glow, tint)


func cone(base: Vector3, r: float, h: float, col: Color, segs := 8, glow := 0.0, tint := 0.0) -> void:
	cyl(base, r, h, col, segs, 0.0, glow, tint)


## Low-poly ball (latitude/longitude), centred at `center`.
func ball(center: Vector3, r: float, col: Color, glow := 0.0, tint := 0.0, squash := 1.0, rings := 4, segs := 7) -> void:
	for j in rings:
		var v0 := PI * j / rings
		var v1 := PI * (j + 1) / rings
		for i in segs:
			var u0 := TAU * i / segs
			var u1 := TAU * (i + 1) / segs
			var p00 := center + Vector3(sin(v0) * cos(u0) * r, cos(v0) * r * squash, sin(v0) * sin(u0) * r)
			var p01 := center + Vector3(sin(v0) * cos(u1) * r, cos(v0) * r * squash, sin(v0) * sin(u1) * r)
			var p10 := center + Vector3(sin(v1) * cos(u0) * r, cos(v1) * r * squash, sin(v1) * sin(u0) * r)
			var p11 := center + Vector3(sin(v1) * cos(u1) * r, cos(v1) * r * squash, sin(v1) * sin(u1) * r)
			if j == 0:
				_tri(p00, p11, p10, col, center, glow, tint)
			elif j == rings - 1:
				_tri(p00, p01, p10, col, center, glow, tint)
			else:
				_quad(p00, p01, p11, p10, col, center, glow, tint)


## Elongated octahedron (crystals, gems).
func crystal(base: Vector3, r: float, h: float, col: Color, glow := 1.0) -> void:
	var mid := base + Vector3(0, h * 0.4, 0)
	var top := base + Vector3(0, h, 0)
	var c := base + Vector3(0, h * 0.45, 0)
	var ring := []
	for i in 6:
		var a := TAU * i / 6
		ring.append(mid + Vector3(cos(a) * r, 0, sin(a) * r))
	for i in 6:
		_tri(ring[i], ring[(i + 1) % 6], top, col, c, glow, 0.0)
		_tri(ring[i], ring[(i + 1) % 6], base, col, c, glow, 0.0)


const BEAM := Color("#5c3b26")
const FOUND := Color("#8d867c")
const SILL := Color("#d9cdb3")


## Row of glowing windows on a wall face at local z = `z` (front) spanning width `w`.
func windows(y: float, z: float, w: float, count: int, size := 0.6) -> void:
	for i in count:
		var x := -w / 2.0 + w * (i + 0.5) / count
		box(Vector3(x, y, z), Vector3(size, size, 0.12), WINDOW, 0.5)


## A detailed window on the front (+Z) face: frame, glowing panes, cross bar, sill and tinted shutters.
func framed_window(x: float, y: float, z: float, s := 0.7, shutters := true) -> void:
	box(Vector3(x, y - 0.08, z), Vector3(s + 0.2, s + 0.16, 0.1), BEAM)
	box(Vector3(x, y, z + 0.04), Vector3(s, s, 0.08), WINDOW, 0.5)
	box(Vector3(x, y + s * 0.42, z + 0.09), Vector3(s, 0.07, 0.04), BEAM)
	box(Vector3(x, y, z + 0.09), Vector3(0.07, s, 0.04), BEAM)
	box(Vector3(x, y - 0.14, z + 0.12), Vector3(s + 0.3, 0.1, 0.25), SILL)
	if shutters:
		box(Vector3(x - s * 0.72, y - 0.04, z + 0.05), Vector3(s * 0.36, s + 0.05, 0.06), TINT, 0.0, 1.0)
		box(Vector3(x + s * 0.72, y - 0.04, z + 0.05), Vector3(s * 0.36, s + 0.05, 0.06), TINT, 0.0, 1.0)


## A window on a side face (normal along X); `side` is -1 or +1.
func side_window(side: float, w: float, y: float, z: float, s := 0.6) -> void:
	var x := side * (w / 2.0 + 0.04)
	box(Vector3(x, y - 0.06, z), Vector3(0.1, s + 0.14, s + 0.18), BEAM)
	box(Vector3(x + side * 0.04, y, z), Vector3(0.08, s, s), WINDOW, 0.5)


## A detailed timber/plaster house body: stone foundation, corner posts and floor beams, framed door
## with step and lamp, framed windows with shutters on the front and windows on the sides, gable roof
## with trim and ridge beam. Front (door) faces +Z. Returns the roof top height.
func house(w: float, d: float, h: float, wall: Color, roof_h := 2.2, floors := 1) -> float:
	box(Vector3(0, -0.4, 0), Vector3(w + 0.4, 0.75, d + 0.4), FOUND)
	box(Vector3.ZERO, Vector3(w, h, d), wall)
	for cx in [-w / 2.0, w / 2.0]:
		for cz in [-d / 2.0, d / 2.0]:
			box(Vector3(cx, 0, cz), Vector3(0.28, h, 0.28), BEAM)
	for f in range(1, floors + 1):
		var fy := h * f / floors - 0.18
		box(Vector3(0, fy, d / 2.0 + 0.02), Vector3(w + 0.1, 0.26, 0.14), BEAM)
		box(Vector3(0, fy, -d / 2.0 - 0.02), Vector3(w + 0.1, 0.26, 0.14), BEAM)
	# door: frame, door, step, lamp
	box(Vector3(0, 0, d / 2.0 + 0.03), Vector3(1.4, 2.15, 0.12), BEAM)
	box(Vector3(0, 0, d / 2.0 + 0.08), Vector3(1.0, 1.9, 0.1), DARK)
	box(Vector3(0.32, 0.9, d / 2.0 + 0.15), Vector3(0.08, 0.08, 0.06), Color("#e8b84a"))
	box(Vector3(0, -0.3, d / 2.0 + 0.55), Vector3(1.7, 0.35, 0.8), FOUND)
	box(Vector3(0.95, 2.0, d / 2.0 + 0.25), Vector3(0.25, 0.32, 0.25), Color("#ffb84d"), 0.5)
	# front windows (skip the door column on the ground floor)
	var per := maxi(2, int(w / 1.7))
	for f in floors:
		var wy := h * (f + 0.5) / floors - 0.1
		for i in per:
			var x := -w / 2.0 + w * (i + 0.5) / per
			if f == 0 and absf(x) < 1.0:
				continue
			framed_window(x, wy, d / 2.0, 0.62)
		for side in [-1.0, 1.0]:
			side_window(side, w, wy, 0.0)
	# roof with trim and ridge
	gable(Vector3(0, h, 0), w, d, roof_h, TINT, 1.0)
	box(Vector3(0, h + roof_h - 0.05, 0), Vector3(w + 0.8, 0.18, 0.22), BEAM)
	box(Vector3(0, h - 0.05, d / 2.0 + 0.42), Vector3(w + 0.7, 0.14, 0.14), BEAM)
	box(Vector3(0, h - 0.05, -d / 2.0 - 0.42), Vector3(w + 0.7, 0.14, 0.14), BEAM)
	return h + roof_h


## Small set dressing beside a front door.
func dressing(x: float, z: float, kind := 0) -> void:
	match kind:
		0:
			cyl(Vector3(x, 0, z), 0.38, 0.9, Color("#8a5a3a"), 7)
			box(Vector3(x, 0.45, z), Vector3(0.8, 0.06, 0.8), BEAM)
		1:
			box(Vector3(x, 0, z), Vector3(0.75, 0.7, 0.75), Color("#b98a5a"))
			box(Vector3(x + 0.1, 0.7, z - 0.05), Vector3(0.55, 0.5, 0.55), Color("#a77a4a"))
		2:
			box(Vector3(x, 0, z), Vector3(0.9, 0.35, 0.5), BEAM)
			ball(Vector3(x - 0.2, 0.55, z), 0.25, Color("#ff7aa8"))
			ball(Vector3(x + 0.2, 0.55, z), 0.25, Color("#ffd43b"))


func commit() -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = norms
	arrays[Mesh.ARRAY_COLOR] = cols
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	var m := ArrayMesh.new()
	if not verts.is_empty():
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m
