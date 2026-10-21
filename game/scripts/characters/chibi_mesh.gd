class_name ChibiMesh
## Builds the one low-poly chibi mesh shared by every Chog instance.
## UV2.x tags each vertex with its body part so the shader can color and animate parts separately.
## UV2.y tags prop vertices (0 = not a prop): every prop is in the mesh, the shader keeps the one a Chog
## carries and collapses the rest. Props are tagged with the arm that holds them, so they swing with it.
## UV.x on props and limbs is a material (Mat). Feet at y = 0, facing +Z. The head is a portrait disc that
## the shader turns toward the camera; props are tall so they poke out past it at mid zoom.

enum Part { TORSO, LEGS, ARM_L, ARM_R, FACE }
## Role props (adventurers, 1..6 = role) and job tools (civilians, 7 + work track). character.gdshader matches these.
enum Prop { NONE, SWORD, DAGGERS, SHIELD, STAFF, BOOK, BANNER, HAMMER, TRAY, SHOVEL, SPEAR }
enum Mat { BODY, STEEL, WOOD, GOLD, HOUSE, PAPER, GLOW }

const HEAD_Y := 1.2      # center of the portrait disc (character.gdshader uses the same value)
const HEAD_SIZE := 1.0   # disc diameter

var _v := PackedVector3Array()
var _n := PackedVector3Array()
var _uv := PackedVector2Array()
var _uv2 := PackedVector2Array()
var _prop := 0
var _mat := 0


static func build() -> ArrayMesh:
	var b := ChibiMesh.new()
	b._prism(Part.TORSO, Vector3(0, 0.32, 0), 0.25, 0.19, 0.48, 8)
	b._box(Part.LEGS, Vector3(-0.11, 0.0, 0.0), Vector3(0.14, 0.34, 0.16))
	b._box(Part.LEGS, Vector3(0.11, 0.0, 0.0), Vector3(0.14, 0.34, 0.16))
	b._box(Part.ARM_L, Vector3(-0.3, 0.4, 0.0), Vector3(0.11, 0.38, 0.11))
	b._box(Part.ARM_R, Vector3(0.3, 0.4, 0.0), Vector3(0.11, 0.38, 0.11))
	# Face: a unit quad around the head center; the shader billboards it and samples the atlas.
	var h := HEAD_SIZE / 2.0
	var c := Vector3(0, HEAD_Y, 0)
	b._quad(Part.FACE, c + Vector3(-h, h, 0), c + Vector3(h, h, 0), c + Vector3(h, -h, 0), c + Vector3(-h, -h, 0), Vector3.BACK, true)
	b._props()
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = b._v
	arrays[Mesh.ARRAY_NORMAL] = b._n
	arrays[Mesh.ARRAY_TEX_UV] = b._uv
	arrays[Mesh.ARRAY_TEX_UV2] = b._uv2
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m


## Hand positions at rest (arms hang): right x = 0.3, left x = -0.3, about y = 0.42.
func _props() -> void:
	var r := Part.ARM_R
	var l := Part.ARM_L
	_prop = Prop.SWORD
	_piece(r, Mat.STEEL, Vector3(0.3, 0.5, 0.08), Vector3(0.07, 1.5, 0.05))
	_piece(r, Mat.GOLD, Vector3(0.3, 0.44, 0.08), Vector3(0.32, 0.06, 0.08))
	_prop = Prop.DAGGERS  # one per hand, splayed outward
	_piece(r, Mat.STEEL, Vector3(0.3, 0.42, 0.08), Vector3(0.05, 0.85, 0.04), Basis(Vector3.BACK, -0.6))
	_piece(l, Mat.STEEL, Vector3(-0.3, 0.42, 0.08), Vector3(0.05, 0.85, 0.04), Basis(Vector3.BACK, 0.6))
	_prop = Prop.SHIELD
	_piece(l, Mat.HOUSE, Vector3(-0.55, 0.2, 0.18), Vector3(0.6, 0.8, 0.06))
	_piece(l, Mat.GOLD, Vector3(-0.55, 0.52, 0.22), Vector3(0.16, 0.16, 0.04))
	_prop = Prop.STAFF
	_piece(r, Mat.WOOD, Vector3(0.3, 0.0, 0.08), Vector3(0.06, 2.05, 0.06))
	_piece(r, Mat.GLOW, Vector3(0.3, 1.98, 0.08), Vector3(0.24, 0.24, 0.24))
	_prop = Prop.BOOK  # floats open beside the head
	_piece(l, Mat.HOUSE, Vector3(-0.8, 0.8, 0.1), Vector3(0.12, 0.55, 0.45))
	_prop = Prop.BANNER
	_piece(r, Mat.WOOD, Vector3(0.3, 0.0, 0.08), Vector3(0.06, 2.35, 0.06))
	_piece(r, Mat.HOUSE, Vector3(0.62, 1.85, 0.08), Vector3(0.6, 0.45, 0.03))
	_prop = Prop.HAMMER
	_piece(r, Mat.WOOD, Vector3(0.3, 0.3, 0.08), Vector3(0.07, 1.35, 0.07))
	_piece(r, Mat.STEEL, Vector3(0.3, 1.6, 0.08), Vector3(0.5, 0.28, 0.28))
	_prop = Prop.TRAY  # balanced high over the head
	_piece(l, Mat.STEEL, Vector3(-0.4, 1.85, 0.05), Vector3(0.6, 0.05, 0.6))
	_piece(l, Mat.PAPER, Vector3(-0.45, 1.9, 0.05), Vector3(0.14, 0.2, 0.14))
	_prop = Prop.SHOVEL
	_piece(r, Mat.WOOD, Vector3(0.3, 0.25, 0.08), Vector3(0.06, 1.75, 0.06))
	_piece(r, Mat.STEEL, Vector3(0.3, 0.0, 0.08), Vector3(0.26, 0.3, 0.04))
	_prop = Prop.SPEAR
	_piece(l, Mat.WOOD, Vector3(-0.3, 0.0, 0.08), Vector3(0.06, 2.2, 0.06))
	_piece(l, Mat.STEEL, Vector3(-0.3, 2.2, 0.08), Vector3(0.12, 0.32, 0.04))
	_prop = Prop.NONE


## A prop box: no bottom face (it is rarely seen) to keep the shared mesh small.
func _piece(arm: int, mat: int, base: Vector3, size: Vector3, rot := Basis.IDENTITY) -> void:
	_mat = mat
	_box(arm, base, size, rot, false)
	_mat = Mat.BODY


## Box with its base centered on `base`, optionally rotated about that point.
func _box(part: int, base: Vector3, size: Vector3, rot := Basis.IDENTITY, bottom := true) -> void:
	var x := size.x / 2.0
	var z := size.z / 2.0
	var p := func(sx: float, y: float, sz: float) -> Vector3: return base + rot * Vector3(sx * x, y * size.y, sz * z)
	_quad(part, p.call(-1, 1, 1), p.call(1, 1, 1), p.call(1, 0, 1), p.call(-1, 0, 1), rot * Vector3.BACK)
	_quad(part, p.call(1, 1, -1), p.call(-1, 1, -1), p.call(-1, 0, -1), p.call(1, 0, -1), rot * Vector3.FORWARD)
	_quad(part, p.call(1, 1, 1), p.call(1, 1, -1), p.call(1, 0, -1), p.call(1, 0, 1), rot * Vector3.RIGHT)
	_quad(part, p.call(-1, 1, -1), p.call(-1, 1, 1), p.call(-1, 0, 1), p.call(-1, 0, -1), rot * Vector3.LEFT)
	_quad(part, p.call(-1, 1, -1), p.call(1, 1, -1), p.call(1, 1, 1), p.call(-1, 1, 1), rot * Vector3.UP)
	if bottom:
		_quad(part, p.call(-1, 0, 1), p.call(1, 0, 1), p.call(1, 0, -1), p.call(-1, 0, -1), rot * Vector3.DOWN)


## Tapered n-sided prism (flat shaded) with a top cap, base centered on `base`.
func _prism(part: int, base: Vector3, r0: float, r1: float, height: float, sides: int) -> void:
	var top := base + Vector3(0, height, 0)
	for s in sides:
		var a0 := TAU * s / sides
		var a1 := TAU * (s + 1) / sides
		var d0 := Vector3(sin(a0), 0, cos(a0))
		var d1 := Vector3(sin(a1), 0, cos(a1))
		var mid := (d0 + d1).normalized()
		_quad(part, top + d0 * r1, top + d1 * r1, base + d1 * r0, base + d0 * r0, mid)
		_tri(part, top, top + d1 * r1, top + d0 * r1, Vector3.UP)


func _quad(part: int, a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3, uv := false) -> void:
	_tri(part, a, b, c, n, [Vector2(0, 0), Vector2(1, 0), Vector2(1, 1)] if uv else [])
	_tri(part, a, c, d, n, [Vector2(0, 0), Vector2(1, 1), Vector2(0, 1)] if uv else [])


## Adds one triangle facing `n`. Godot front faces are clockwise seen from the front, so the
## winding is flipped whenever the geometric normal disagrees with `n`.
func _tri(part: int, a: Vector3, b: Vector3, c: Vector3, n: Vector3, uvs: Array = []) -> void:
	var t := [a, b, c]
	var m := Vector2(_mat, 0)
	var u := uvs if not uvs.is_empty() else [m, m, m]
	if (c - a).cross(b - a).dot(n) < 0.0:
		t = [a, c, b]
		u = [u[0], u[2], u[1]]
	for k in 3:
		_v.append(t[k])
		_n.append(n)
		_uv.append(u[k])
		_uv2.append(Vector2(part, _prop))
