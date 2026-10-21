class_name Terrain
extends Node3D
## The Monadia continent with level of detail.
## Data: a 641 x 561 height/color grid (~1.4 units per cell) exported from the server's generator.
## The map is split into chunks of 64 x 64 cells. Every chunk always has a coarse mesh (step 4);
## chunks near the camera get a mid (step 2) or full (step 1) mesh, built on demand a couple per frame.
## Skirts hide cracks between neighbouring LODs. Full-detail chunks also get ground cover (grass tufts,
## pebbles) that is only drawn close to the camera. Public API: height_at(x, z), size_x/size_z.

const CHUNK := 64
const LOD_STEPS := [1, 2, 4]
const LOD_NEAR := 170.0   # camera distance (to chunk) for full detail
const LOD_MID := 360.0    # ... for mid detail; beyond this the coarse mesh
const BUILDS_PER_FRAME := 2
const SKIRT := 3.0

var grid_x := 0
var grid_z := 0
var size_x := 0.0
var size_z := 0.0
var heights := PackedFloat32Array()
var colors := PackedByteArray()

var _material: ShaderMaterial
var _cover_material: ShaderMaterial
var _chunks: Array = []  # [{mi: MeshInstance3D, meshes: [m0, m1, m2], lod: int, center: Vector3, cover: Node}]
var _tick := 0.0


func _ready() -> void:
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/terrain_meta.json"))
	grid_x = int(meta["grid_x"])
	grid_z = int(meta["grid_z"])
	size_x = float(meta["size_x"])
	size_z = float(meta["size_z"])
	heights = FileAccess.get_file_as_bytes("res://data/terrain_height.bin").to_float32_array()
	colors = FileAccess.get_file_as_bytes("res://data/terrain_color.bin")
	_material = ShaderMaterial.new()
	_material.shader = preload("res://shaders/terrain.gdshader")
	_cover_material = ShaderMaterial.new()
	_cover_material.shader = preload("res://shaders/vcol.gdshader")
	var ncx := ceili(float(grid_x - 1) / CHUNK)
	var ncz := ceili(float(grid_z - 1) / CHUNK)
	for cz in ncz:
		for cx in ncx:
			var i0 := cx * CHUNK
			var j0 := cz * CHUNK
			var i1 := mini(i0 + CHUNK, grid_x - 1)
			var j1 := mini(j0 + CHUNK, grid_z - 1)
			var mi := MeshInstance3D.new()
			mi.material_override = _material
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(mi)
			var center := _vertex((i0 + i1) / 2, (j0 + j1) / 2)
			var c := {"mi": mi, "meshes": [null, null, null], "lod": -1, "i0": i0, "j0": j0, "i1": i1, "j1": j1, "center": center, "cover": null}
			c["meshes"][2] = _build_chunk(i0, j0, i1, j1, LOD_STEPS[2])
			mi.mesh = c["meshes"][2]
			c["lod"] = 2
			_chunks.append(c)


func _process(delta: float) -> void:
	_tick -= delta
	if _tick > 0.0:
		return
	_tick = 0.15
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var cp := cam.global_position
	var builds := 0
	for c in _chunks:
		var center: Vector3 = c["center"]
		var d := cp.distance_to(center)
		var want := 0 if d < LOD_NEAR else (1 if d < LOD_MID else 2)
		if want != c["lod"]:
			var meshes: Array = c["meshes"]
			if meshes[want] == null:
				if builds >= BUILDS_PER_FRAME:
					continue
				meshes[want] = _build_chunk(c["i0"], c["j0"], c["i1"], c["j1"], LOD_STEPS[want])
				builds += 1
			(c["mi"] as MeshInstance3D).mesh = meshes[want]
			c["lod"] = want
		if want == 0 and c["cover"] == null and builds < BUILDS_PER_FRAME:
			c["cover"] = _build_cover(c)
			builds += 1
		if c["cover"] != null:
			(c["cover"] as Node3D).visible = d < LOD_NEAR + 40.0


func _vertex(i: int, j: int) -> Vector3:
	return Vector3(-size_x / 2.0 + float(i) / (grid_x - 1) * size_x, heights[j * grid_x + i], -size_z / 2.0 + float(j) / (grid_z - 1) * size_z)


func _color(i: int, j: int) -> Color:
	var k := (j * grid_x + i) * 4
	return Color8(colors[k], colors[k + 1], colors[k + 2], colors[k + 3])


## Flat-shaded chunk mesh at the given step, plus skirts on its four edges.
func _build_chunk(i0: int, j0: int, i1: int, j1: int, step: int) -> ArrayMesh:
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()
	var nx := ceili(float(i1 - i0) / step)
	var nz := ceili(float(j1 - j0) / step)
	verts.resize(nx * nz * 6)
	norms.resize(nx * nz * 6)
	cols.resize(nx * nz * 6)
	var p := 0
	for zz in nz:
		var j := j0 + zz * step
		var jn := mini(j + step, j1)
		for xx in nx:
			var i := i0 + xx * step
			var inx := mini(i + step, i1)
			var a := _vertex(i, j)
			var b := _vertex(inx, j)
			var c := _vertex(i, jn)
			var d := _vertex(inx, jn)
			var col := _color(i, j)
			var n1 := (c - a).cross(b - a).normalized()
			var n2 := (c - b).cross(d - b).normalized()
			# Godot treats clockwise triangles (seen from the front) as front faces.
			verts[p] = a; verts[p + 1] = b; verts[p + 2] = c
			verts[p + 3] = b; verts[p + 4] = d; verts[p + 5] = c
			for q in 3:
				norms[p + q] = n1
				norms[p + 3 + q] = n2
			for q in 6:
				cols[p + q] = col
			p += 6
	# Skirts: hang a strip below every border edge so LOD seams never show sky.
	var edges := [[i0, j0, i1, j0], [i1, j0, i1, j1], [i1, j1, i0, j1], [i0, j1, i0, j0]]
	for e in edges:
		var ia: int = e[0]
		var ja: int = e[1]
		var ib: int = e[2]
		var jb: int = e[3]
		var count := maxi(absi(ib - ia), absi(jb - ja)) / step
		for s in count:
			var t0 := float(s) / count
			var t1 := float(s + 1) / count
			var u0 := _vertex(int(round(lerpf(ia, ib, t0))), int(round(lerpf(ja, jb, t0))))
			var u1 := _vertex(int(round(lerpf(ia, ib, t1))), int(round(lerpf(ja, jb, t1))))
			var l0 := u0 - Vector3(0, SKIRT, 0)
			var l1 := u1 - Vector3(0, SKIRT, 0)
			var col := _color(int(round(lerpf(ia, ib, t0))), int(round(lerpf(ja, jb, t0))))
			var n := (u1 - u0).cross(Vector3.DOWN).normalized()
			for v in [u0, u1, l1, u0, l1, l0]:
				verts.append(v)
				norms.append(n)
				cols.append(col)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = norms
	arrays[Mesh.ARRAY_COLOR] = cols
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m


## Grass tufts on green ground and pebbles on sand/rock, only for full-detail chunks.
func _build_cover(c: Dictionary) -> Node3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(c["i0"]) * 7919 + int(c["j0"]) * 104729
	var tufts: Array[Transform3D] = []
	var tuft_cols: Array[Color] = []
	var stones: Array[Transform3D] = []
	var stone_cols: Array[Color] = []
	var i0: int = c["i0"]
	var j0: int = c["j0"]
	var i1: int = c["i1"]
	var j1: int = c["j1"]
	for k in 900:
		var fi := rng.randf_range(i0, i1)
		var fj := rng.randf_range(j0, j1)
		var i := int(fi)
		var j := int(fj)
		var col := _color(i, j)
		if col.a > 0.02:
			continue  # lava
		var x := -size_x / 2.0 + fi / (grid_x - 1) * size_x
		var z := -size_z / 2.0 + fj / (grid_z - 1) * size_z
		var h := height_at(x, z)
		if h < 1.4:
			continue
		var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.6, 1.3))
		if col.g > col.r * 0.95 and col.g > col.b:
			tufts.append(Transform3D(basis, Vector3(x, h - 0.05, z)))
			tuft_cols.append(col.lightened(rng.randf_range(0.05, 0.25)))
		elif rng.randf() < 0.35:
			stones.append(Transform3D(basis, Vector3(x, h - 0.1, z)))
			stone_cols.append(col.darkened(rng.randf_range(0.1, 0.3)))
	var root := Node3D.new()
	add_child(root)
	if not tufts.is_empty():
		root.add_child(_cover_mm(_tuft_mesh(), tufts, tuft_cols))
	if not stones.is_empty():
		root.add_child(_cover_mm(_pebble_mesh(), stones, stone_cols))
	return root


func _cover_mm(mesh: Mesh, xforms: Array[Transform3D], cols: Array[Color]) -> MultiMeshInstance3D:
	mesh.surface_set_material(0, _cover_material)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, cols[i])
		mm.set_instance_custom_data(i, Color(1, 1, 1, 0))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mmi


var _tuft_cache: ArrayMesh
var _pebble_cache: ArrayMesh


func _tuft_mesh() -> ArrayMesh:
	if _tuft_cache == null:
		var a := Architect.new()
		for k in 4:
			var ang := TAU * k / 4.0 + 0.3
			var off := Vector3(cos(ang), 0, sin(ang)) * 0.18
			a.cone(off, 0.09, 0.55 + 0.15 * (k % 2), Color.WHITE, 3)
		_tuft_cache = a.commit()
	return _tuft_cache


func _pebble_mesh() -> ArrayMesh:
	if _pebble_cache == null:
		var a := Architect.new()
		a.ball(Vector3(0, 0.08, 0), 0.25, Color.WHITE, 0.0, 0.0, 0.6, 2, 5)
		_pebble_cache = a.commit()
	return _pebble_cache


## Bilinear height lookup in world coordinates (used to stand Chogs and buildings on the ground).
func height_at(x: float, z: float) -> float:
	if heights.is_empty():
		return 0.0
	var fx := clampf((x + size_x / 2.0) / size_x * (grid_x - 1), 0.0, grid_x - 1.001)
	var fz := clampf((z + size_z / 2.0) / size_z * (grid_z - 1), 0.0, grid_z - 1.001)
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	var h00 := heights[j * grid_x + i]
	var h10 := heights[j * grid_x + i + 1]
	var h01 := heights[(j + 1) * grid_x + i]
	var h11 := heights[(j + 1) * grid_x + i + 1]
	return lerpf(lerpf(h00, h10, tx), lerpf(h01, h11, tx), tz)
