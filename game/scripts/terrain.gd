class_name Terrain
extends Node3D
## The Monadia continent with level of detail.
## Data: a 641 x 561 height/color grid (~1.4 units per cell) exported from the server's generator.
## The map is split into chunks of 64 x 64 cells. Every chunk always has a coarse mesh (step 4);
## chunks near the camera get a mid (step 2) or full (step 1) mesh. Meshes are indexed and built in
## time slices through FrameJobs (never a whole chunk in one frame), and the next finer level is
## pre-built in idle time while the camera approaches.
## Skirts hide cracks between neighbouring LODs. Shading is smooth (per-vertex normals and colors).
## Full-detail chunks also get ground cover (grass tufts, flower clumps, pebbles) drawn close to the camera. Public API: height_at(x, z), size_x/size_z.

const CHUNK := 64
const NOISE := preload("res://textures/noise.png")
const LOD_STEPS := [1, 2, 4]
const LOD_NEAR := 120.0   # camera distance (to chunk) for full detail
const LOD_MID := 300.0    # ... for mid detail; beyond this the coarse mesh
const SLICE_US := 1500       # max time one build slice may take before yielding to the next frame
const PREFETCH := 1.4        # pre-build the next finer LOD within this multiple of its radius (idle time)
const SKIRT := 3.0
const COVER_SAMPLES := 1200  # ground-cover attempts per full-detail chunk
const COVER_DIST := 150.0    # chunks farther than this hide their cover (blades have shrunk away by then)

var grid_x := 0
var grid_z := 0
var size_x := 0.0
var size_z := 0.0
var heights := PackedFloat32Array()
var colors := PackedByteArray()

var _material: ShaderMaterial
var _cover_material: ShaderMaterial
var _grass_material: ShaderMaterial
var _chunks: Array = []  # [{mi: MeshInstance3D, meshes: [m0, m1, m2], lod: int, center: Vector3, cover: Node}]
var _tick := 0.0
## 0.6..1 scale on LOD/cover distances; AdaptiveQuality lowers it on slow devices.
var quality := 1.0


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
	_material.set_shader_parameter("noise_tex", NOISE)
	_cover_material = ShaderMaterial.new()
	_cover_material.shader = preload("res://shaders/vcol.gdshader")
	_cover_material.set_shader_parameter("noise_tex", NOISE)
	_grass_material = ShaderMaterial.new()
	_grass_material.shader = preload("res://shaders/grass.gdshader")
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
			var c := {"mi": mi, "meshes": [null, null, null], "lod": -1, "want": 2, "i0": i0, "j0": j0, "i1": i1, "j1": j1, "center": center, "cover": null}
			var b := ChunkBuild.new(self, i0, j0, i1, j1, LOD_STEPS[2])
			b.build_rows(1 << 62)
			c["meshes"][2] = b.mesh()
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
	for k in _chunks.size():
		var c: Dictionary = _chunks[k]
		var center: Vector3 = c["center"]
		var d := cp.distance_to(center)
		var want := 0 if d < LOD_NEAR * quality else (1 if d < LOD_MID * quality else 2)
		c["want"] = want
		var meshes: Array = c["meshes"]
		if want != c["lod"]:
			if meshes[want] != null:
				_show_lod(c, want)
			else:
				_queue_build(k, want, FrameJobs.PRIO_HIGH)
		elif want > 0 and meshes[want - 1] == null and d < (LOD_NEAR if want == 1 else LOD_MID) * quality * PREFETCH:
			_queue_build(k, want - 1, FrameJobs.PRIO_IDLE)  # the camera is approaching: build ahead of time
		if want == 0 and c["cover"] == null:
			_queue_cover(k)
		if c["cover"] != null:
			(c["cover"] as Node3D).visible = d < COVER_DIST * quality


func _show_lod(c: Dictionary, lod: int) -> void:
	(c["mi"] as MeshInstance3D).mesh = c["meshes"][lod]
	c["lod"] = lod


## Build chunk `k` at `lod` in slices through FrameJobs; shown once ready if still wanted.
func _queue_build(k: int, lod: int, prio: int) -> void:
	var key := "terrain:%d:%d" % [k, lod]
	if FrameJobs.pending(key):
		return
	var c: Dictionary = _chunks[k]
	var st := {"b": null}  # lambdas capture locals by value; keep progress in a shared dictionary
	FrameJobs.add(func() -> bool:
		if st["b"] == null:
			st["b"] = ChunkBuild.new(self, c["i0"], c["j0"], c["i1"], c["j1"], LOD_STEPS[lod])
		var b: ChunkBuild = st["b"]
		if not b.build_rows(Time.get_ticks_usec() + SLICE_US):
			return true
		c["meshes"][lod] = b.mesh()
		if c["want"] == lod:
			_show_lod(c, lod)
		return false, prio, key)


func _vertex(i: int, j: int) -> Vector3:
	return Vector3(-size_x / 2.0 + float(i) / (grid_x - 1) * size_x, heights[j * grid_x + i], -size_z / 2.0 + float(j) / (grid_z - 1) * size_z)


func _color(i: int, j: int) -> Color:
	var k := (j * grid_x + i) * 4
	return Color8(colors[k], colors[k + 1], colors[k + 2], colors[k + 3])


## Incremental, indexed chunk mesh: grid points are computed a few rows per call (so one build never
## blocks a frame), then assembled with an index pattern shared by every chunk of the same size.
## Smooth shading (per-vertex normals and colors) plus skirts on the four edges hide LOD cracks.
class ChunkBuild:
	var t: Terrain
	var i0: int
	var j0: int
	var i1: int
	var j1: int
	var step: int
	var nx: int
	var nz: int
	var row := 0
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()

	func _init(terrain: Terrain, a0: int, b0: int, a1: int, b1: int, s: int) -> void:
		t = terrain
		i0 = a0
		j0 = b0
		i1 = a1
		j1 = b1
		step = s
		nx = ceili(float(i1 - i0) / step)
		nz = ceili(float(j1 - j0) / step)
		var n := (nx + 1) * (nz + 1) + 2 * (nx + nz)
		verts.resize(n)
		norms.resize(n)
		cols.resize(n)

	## Fills grid rows until `deadline_us`; true when every row is done.
	func build_rows(deadline_us: int) -> bool:
		while row <= nz:
			var j := mini(j0 + row * step, j1)
			var base := row * (nx + 1)
			for xx in nx + 1:
				var i := mini(i0 + xx * step, i1)
				verts[base + xx] = t._vertex(i, j)
				norms[base + xx] = t._normal(i, j, step)
				cols[base + xx] = t._color(i, j)
			row += 1
			if Time.get_ticks_usec() > deadline_us:
				break
		return row > nz

	func mesh() -> ArrayMesh:
		var per := t._perimeter(nx, nz)
		var g := (nx + 1) * (nz + 1)
		for k in per.size():
			verts[g + k] = verts[per[k]] - Vector3(0, Terrain.SKIRT, 0)
			norms[g + k] = norms[per[k]]
			cols[g + k] = cols[per[k]]
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = verts
		arrays[Mesh.ARRAY_NORMAL] = norms
		arrays[Mesh.ARRAY_COLOR] = cols
		arrays[Mesh.ARRAY_INDEX] = t._indices(nx, nz)
		var m := ArrayMesh.new()
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		return m


var _index_cache := {}
var _perimeter_cache := {}


## Grid indices walked once around the border (top, right, bottom, left), for the skirts.
func _perimeter(nx: int, nz: int) -> PackedInt32Array:
	var key := Vector2i(nx, nz)
	if _perimeter_cache.has(key):
		return _perimeter_cache[key]
	var row := nx + 1
	var per := PackedInt32Array()
	for xx in nx:
		per.append(xx)
	for zz in nz:
		per.append(zz * row + nx)
	for xx in range(nx, 0, -1):
		per.append(nz * row + xx)
	for zz in range(nz, 0, -1):
		per.append(zz * row)
	_perimeter_cache[key] = per
	return per


## Triangle indices for an (nx x nz)-cell grid plus its skirt strip; identical for every chunk of that size.
func _indices(nx: int, nz: int) -> PackedInt32Array:
	var key := Vector2i(nx, nz)
	if _index_cache.has(key):
		return _index_cache[key]
	var row := nx + 1
	var idx := PackedInt32Array()
	idx.resize(nx * nz * 6 + 2 * (nx + nz) * 6)
	var p := 0
	for zz in nz:
		for xx in nx:
			var ka := zz * row + xx
			var kc := ka + row
			# Godot treats clockwise triangles (seen from the front) as front faces.
			idx[p] = ka; idx[p + 1] = ka + 1; idx[p + 2] = kc
			idx[p + 3] = ka + 1; idx[p + 4] = kc + 1; idx[p + 5] = kc
			p += 6
	var per := _perimeter(nx, nz)
	var g := (nx + 1) * (nz + 1)
	var n := per.size()
	for k in n:
		var k1 := (k + 1) % n
		idx[p] = per[k]; idx[p + 1] = per[k1]; idx[p + 2] = g + k1
		idx[p + 3] = per[k]; idx[p + 4] = g + k1; idx[p + 5] = g + k
		p += 6
	_index_cache[key] = idx
	return idx


## Ground normal at grid point (i, j) from central differences `s` cells apart.
func _normal(i: int, j: int, s: int) -> Vector3:
	var il := maxi(i - s, 0)
	var ir := mini(i + s, grid_x - 1)
	var jd := maxi(j - s, 0)
	var ju := mini(j + s, grid_z - 1)
	var dx := float(ir - il) * size_x / (grid_x - 1)
	var dz := float(ju - jd) * size_z / (grid_z - 1)
	var hx := heights[j * grid_x + ir] - heights[j * grid_x + il]
	var hz := heights[ju * grid_x + i] - heights[jd * grid_x + i]
	return Vector3(-hx / dx, 1.0, -hz / dz).normalized()


## Ground cover for full-detail chunks: dense grass tufts on green ground (with the odd flower clump),
## pebbles on sand, dirt and rock. Grass uses shaders/grass.gdshader (wind, smooth distance fade).
func _queue_cover(k: int) -> void:
	var key := "cover:%d" % k
	if FrameJobs.pending(key):
		return
	var c: Dictionary = _chunks[k]
	var rng := RandomNumberGenerator.new()
	rng.seed = int(c["i0"]) * 7919 + int(c["j0"]) * 104729
	var st := {"done": 0, "rng": rng, "tufts": [] as Array[Transform3D], "tuft_cols": [] as Array[Color], "blooms": [] as Array[Transform3D],
		"bloom_cols": [] as Array[Color], "stones": [] as Array[Transform3D], "stone_cols": [] as Array[Color]}
	FrameJobs.add(func() -> bool:
		if c["cover"] != null:
			return false
		var deadline := Time.get_ticks_usec() + SLICE_US
		while st["done"] < COVER_SAMPLES:
			_cover_samples(c, st, 100)
			st["done"] += 100
			if Time.get_ticks_usec() > deadline:
				return true
		c["cover"] = _cover_nodes(st)
		return false, FrameJobs.PRIO_NORMAL, key)


## `count` cover placement attempts for chunk `c`, appended to the lists in `st`.
func _cover_samples(c: Dictionary, st: Dictionary, count: int) -> void:
	var rng: RandomNumberGenerator = st["rng"]
	var tufts: Array[Transform3D] = st["tufts"]
	var tuft_cols: Array[Color] = st["tuft_cols"]
	var blooms: Array[Transform3D] = st["blooms"]
	var bloom_cols: Array[Color] = st["bloom_cols"]
	var stones: Array[Transform3D] = st["stones"]
	var stone_cols: Array[Color] = st["stone_cols"]
	var i0: int = c["i0"]
	var j0: int = c["j0"]
	var i1: int = c["i1"]
	var j1: int = c["j1"]
	for k in count:
		var fi := rng.randf_range(i0, i1)
		var fj := rng.randf_range(j0, j1)
		var col := _color(int(fi), int(fj))
		if col.a > 0.02:
			continue  # lava
		var x := -size_x / 2.0 + fi / (grid_x - 1) * size_x
		var z := -size_z / 2.0 + fj / (grid_z - 1) * size_z
		var h := height_at(x, z)
		if h < 1.4:
			continue
		var steep := _normal(int(fi), int(fj), 1).y < 0.8
		var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.7, 1.35))
		if col.g > col.r * 0.95 and col.g > col.b and not steep:
			if rng.randf() < 0.04:
				blooms.append(Transform3D(basis, Vector3(x, h - 0.05, z)))
				bloom_cols.append(Color.WHITE)
			else:
				tufts.append(Transform3D(basis, Vector3(x, h - 0.05, z)))
				tuft_cols.append(col.lightened(rng.randf_range(0.0, 0.18)))
		elif rng.randf() < 0.3:
			stones.append(Transform3D(basis, Vector3(x, h - 0.1, z)))
			stone_cols.append(col.darkened(rng.randf_range(0.05, 0.3)))


func _cover_nodes(st: Dictionary) -> Node3D:
	var tufts: Array[Transform3D] = st["tufts"]
	var tuft_cols: Array[Color] = st["tuft_cols"]
	var blooms: Array[Transform3D] = st["blooms"]
	var bloom_cols: Array[Color] = st["bloom_cols"]
	var stones: Array[Transform3D] = st["stones"]
	var stone_cols: Array[Color] = st["stone_cols"]
	var root := Node3D.new()
	add_child(root)
	if not tufts.is_empty():
		root.add_child(_cover_mm(_tuft_mesh(), tufts, tuft_cols, _grass_material))
	if not blooms.is_empty():
		root.add_child(_cover_mm(_bloom_mesh(), blooms, bloom_cols, _grass_material))
	if not stones.is_empty():
		root.add_child(_cover_mm(_pebble_mesh(), stones, stone_cols, _cover_material))
	return root


func _cover_mm(mesh: Mesh, xforms: Array[Transform3D], cols: Array[Color], material: Material) -> MultiMeshInstance3D:
	mesh.surface_set_material(0, material)
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
var _bloom_cache: ArrayMesh
var _pebble_cache: ArrayMesh


## A tuft of 5 bent, tapering blades (3 triangles each), white so the instance color shows the ground.
func _tuft_mesh() -> ArrayMesh:
	if _tuft_cache == null:
		_tuft_cache = _blades(5, 0.45, 0.85, Color.WHITE, 1)
	return _tuft_cache


## A clump of grass with three flowers on stems.
func _bloom_mesh() -> ArrayMesh:
	if _bloom_cache == null:
		var arrays := _blades(5, 0.35, 0.6, Color("#5d9a4c"), 2).surface_get_arrays(0)
		var a := Architect.new()
		var fc := [Color("#ff7aa8"), Color("#ffd43b"), Color("#b197fc"), Color("#ffffff")]
		for k in 3:
			var ang := TAU * k / 3.0 + 0.5
			var tip := Vector3(cos(ang) * 0.18, 0.7 + 0.12 * k, sin(ang) * 0.18)
			a.beam(Vector3(cos(ang) * 0.05, 0, sin(ang) * 0.05), tip, 0.035, Color("#4f8a3c"))
			a.ball(tip, 0.1, fc[k % fc.size()], 0.0, 0.0, 0.6, 2, 5)
			a.ball(tip + Vector3(0, 0.04, 0), 0.04, Color("#ffd43b"), 0.0, 0.0, 1.0, 2, 3)
		var v: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var n: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var c: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
		v.append_array(a.verts)
		n.append_array(a.norms)
		c.append_array(a.cols)
		var out := []
		out.resize(Mesh.ARRAY_MAX)
		out[Mesh.ARRAY_VERTEX] = v
		out[Mesh.ARRAY_NORMAL] = n
		out[Mesh.ARRAY_COLOR] = c
		_bloom_cache = ArrayMesh.new()
		_bloom_cache.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, out)
	return _bloom_cache


## `count` blades fanned around the origin, each a bent strip: base quad + tip triangle.
func _blades(count: int, h_min: float, h_max: float, col: Color, seed_v: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var c := PackedColorArray()
	for k in count:
		var ang := TAU * k / count + rng.randf_range(-0.3, 0.3)
		var out := Vector3(cos(ang), 0, sin(ang))
		var side := Vector3(-out.z, 0, out.x)
		var root := out * rng.randf_range(0.02, 0.16)
		var hh := rng.randf_range(h_min, h_max)
		var lean := rng.randf_range(0.15, 0.4)
		var w := rng.randf_range(0.05, 0.08)
		var mid := root + out * lean * hh * 0.4 + Vector3(0, hh * 0.55, 0)
		var tip := root + out * lean * hh + Vector3(0, hh, 0)
		var normal := (out + Vector3(0, 0.6, 0)).normalized()
		var pts := [root - side * w, root + side * w, mid + side * w * 0.6, mid - side * w * 0.6]
		for q in [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3], pts[3], pts[2], tip]:
			v.append(q)
			n.append(normal)
			c.append(col)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v
	arrays[Mesh.ARRAY_NORMAL] = n
	arrays[Mesh.ARRAY_COLOR] = c
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m


func _pebble_mesh() -> ArrayMesh:
	if _pebble_cache == null:
		var a := Architect.new()
		a.mat = Architect.M_ROCK
		a.ball(Vector3(0, 0.08, 0), 0.25, Color.WHITE, 0.0, 0.0, 0.6, 3, 5)
		a.ball(Vector3(0.28, 0.04, 0.1), 0.13, Color.WHITE, 0.0, 0.0, 0.6, 2, 4)
		a.jitter(0, 0.08, 5)
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
