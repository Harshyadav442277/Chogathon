class_name ChibiMesh
## Builds the one low-poly chibi mesh shared by every Chog instance.
## UV2.x tags each vertex with its body part so the shader can color and animate parts separately.
## Feet at y = 0, facing +Z. The head is a portrait disc that the shader turns toward the camera.

enum Part { TORSO, LEGS, ARM_L, ARM_R, FACE }

const HEAD_Y := 1.2      # center of the portrait disc (character.gdshader uses the same value)
const HEAD_SIZE := 1.0   # disc diameter

var _v := PackedVector3Array()
var _n := PackedVector3Array()
var _uv := PackedVector2Array()
var _uv2 := PackedVector2Array()


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
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = b._v
	arrays[Mesh.ARRAY_NORMAL] = b._n
	arrays[Mesh.ARRAY_TEX_UV] = b._uv
	arrays[Mesh.ARRAY_TEX_UV2] = b._uv2
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m


## Axis-aligned box with its base centered on `base`.
func _box(part: int, base: Vector3, size: Vector3) -> void:
	var x := size.x / 2.0
	var z := size.z / 2.0
	var y0 := base.y
	var y1 := base.y + size.y
	var p := func(sx: float, y: float, sz: float) -> Vector3: return Vector3(base.x + sx * x, y, base.z + sz * z)
	_quad(part, p.call(-1, y1, 1), p.call(1, y1, 1), p.call(1, y0, 1), p.call(-1, y0, 1), Vector3.BACK)
	_quad(part, p.call(1, y1, -1), p.call(-1, y1, -1), p.call(-1, y0, -1), p.call(1, y0, -1), Vector3.FORWARD)
	_quad(part, p.call(1, y1, 1), p.call(1, y1, -1), p.call(1, y0, -1), p.call(1, y0, 1), Vector3.RIGHT)
	_quad(part, p.call(-1, y1, -1), p.call(-1, y1, 1), p.call(-1, y0, 1), p.call(-1, y0, -1), Vector3.LEFT)
	_quad(part, p.call(-1, y1, -1), p.call(1, y1, -1), p.call(1, y1, 1), p.call(-1, y1, 1), Vector3.UP)
	_quad(part, p.call(-1, y0, 1), p.call(1, y0, 1), p.call(1, y0, -1), p.call(-1, y0, -1), Vector3.DOWN)


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
	var u := uvs if not uvs.is_empty() else [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO]
	if (c - a).cross(b - a).dot(n) < 0.0:
		t = [a, c, b]
		u = [u[0], u[2], u[1]]
	for k in 3:
		_v.append(t[k])
		_n.append(n)
		_uv.append(u[k])
		_uv2.append(Vector2(part, 0))
