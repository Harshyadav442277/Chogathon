class_name Settlements
extends Node3D
## Places every building, prop, road and label from world.json (v2) using procedural meshes from
## catalog.gd. One MultiMeshInstance3D per building/prop type, all sharing shaders/vcol.gdshader.

const ROOF := {
	"capital": Color("#8d74d6"), "emberforge": Color("#c0392b"), "tidecry": Color("#2f6f9f"), "prism": Color("#8e6cd9"),
	"dreamveil": Color("#e6a93c"), "hollow": Color("#4a4560"), "frogsong": Color("#4f8a3c"), "rugcoast": Color("#7a4b2a"),
	"wastes": Color("#6d675e"), "demon": Color("#5a1f6a"),
}

## Footprint radius per building type for is_open() (same values as the server's FOOT in src/world/data.ts).
const OPEN_FOOT := {
	"castle": 10.0, "keep": 6.5, "colosseum": 12.0, "spire": 10.0, "demon_castle": 11.0, "guild_hall": 5.5, "temple": 5.0,
	"library": 5.0, "barracks": 5.5, "academy": 5.0, "market": 6.0, "dungeon": 3.5, "tavern": 3.8, "fountain": 3.6,
	"wall": 3.2, "gate": 3.5, "tower": 2.5, "house_large": 3.6,
}

const FOOTPRINT := {
	"castle": 9.0, "keep": 6.0, "colosseum": 11.0, "spire": 10.0, "demon_castle": 11.0, "guild_hall": 5.0,
	"temple": 4.5, "library": 4.5, "barracks": 5.0, "academy": 4.5, "market": 6.0, "dungeon": 3.5, "tavern": 3.5,
}

var terrain: Terrain
var material: ShaderMaterial
var _buildings: Array = []
var _lod_tick := 0.0
const SMALL_PROPS := ["flowers", "reeds", "lily", "rock", "mushroom", "bonespike", "lavarock"]
const PROP_NEAR := 150.0      # props within this distance of the camera use their detailed mesh
const BUILDING_NEAR := 190.0  # ... buildings
var _lod_sets: Array = []
const LOD_CELL := 64.0
const PROP_CELL := 128.0   # far trees are split into cells of this size for frustum culling
const DISTANT := 380.0     # cells farther than this (camera to cell centre) draw their merged distant mesh
var _lod_grid := {}     # Vector2i cell -> PackedInt32Array of (set << 16 | instance)
var _lod_active := {}   # set index -> true while it has near instances
var _lod_cam := Vector3(1e9, 0, 0)
var _building_pos := PackedVector3Array()


func build(world: Dictionary) -> void:
	material = ShaderMaterial.new()
	material.shader = preload("res://shaders/vcol.gdshader")
	material.set_shader_parameter("noise_tex", preload("res://textures/noise.png"))
	var hour: int = Time.get_datetime_dict_from_system(true)["hour"]
	material.set_shader_parameter("night", 1.0 if (hour < 6 or hour >= 19) else 0.0)
	_build_buildings(world.get("buildings", []))
	_build_props(world.get("props", {}))
	_build_roads(world.get("roads", []))
	_build_labels(world)
	_build_volcano(world.get("landmarks", {}))


func _instances(mesh: Mesh, xforms: Array[Transform3D], tints: Array[Color]) -> MultiMeshInstance3D:
	if xforms.is_empty() or mesh.get_surface_count() == 0:
		return null
	mesh.surface_set_material(0, material)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	# Compatibility renderer: with use_colors off, COLOR reaches the shader as zero for MultiMesh
	# instances (everything rendered black). Keep instance colors on, set to white.
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, Color.WHITE)
		mm.set_instance_custom_data(i, tints[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	if OS.get_cmdline_user_args().has("--perf"):
		var tris: int = (mesh.surface_get_array_len(0) / 3) if mesh.get_surface_count() > 0 else 0
		print("TRIS %s x%d = %d" % [mesh.resource_name if mesh.resource_name != "" else str(tris) + "/inst", xforms.size(), tris * xforms.size()])
	return mmi


func _build_buildings(list: Array) -> void:
	_buildings = list
	_building_pos.resize(list.size())
	var by_type := {}
	for b in list:
		var t: String = b["type"]
		if not by_type.has(t):
			by_type[t] = {"x": [] as Array[Transform3D], "c": [] as Array[Color]}
		var x: float = b["x"]
		var z: float = b["z"]
		var s: float = b["s"]
		# Sit on the lowest nearby point so buildings never float on slopes; sink a little into the ground.
		var y := minf(terrain.height_at(x, z), minf(terrain.height_at(x + 3.0 * s, z), terrain.height_at(x, z + 3.0 * s))) - 0.3
		if t == "dock":
			y = 0.0
		if t == "spire":
			y = maxf(y, 0.0)
		_building_pos[int(b["id"])] = Vector3(x, y + 3.0 * s, z)
		var fr: float = OPEN_FOOT.get(t, 3.0) * s
		var cell := Vector2i(floori(x / OPEN_CELL), floori(z / OPEN_CELL))
		if not _foot_grid.has(cell):
			_foot_grid[cell] = []
		(_foot_grid[cell] as Array).append(Vector3(x, z, fr))
		var basis := Basis(Vector3.UP, float(b["rot"])).scaled(Vector3.ONE * s)
		(by_type[t]["x"] as Array[Transform3D]).append(Transform3D(basis, Vector3(x, y, z)))
		var roof: Color = ROOF.get(str(b["region"]), Color.WHITE)
		(by_type[t]["c"] as Array[Color]).append(Color(roof.r, roof.g, roof.b, 1.0))
	for t in by_type:
		_add_lod_set(Catalog.building(t), Catalog.building_simple(t), by_type[t]["x"], by_type[t]["c"], BUILDING_NEAR)


## Every 0.25 s: when the camera has moved, re-pick which buildings and props get their detailed mesh
## (as a FrameJobs job, so it shares the per-frame work budget).
func _process(delta: float) -> void:
	_lod_tick -= delta
	if _lod_tick > 0.0:
		return
	_lod_tick = 0.25
	var cam := get_viewport().get_camera_3d()
	if cam == null or cam.global_position.y < -500.0:  # inside an interior
		return
	if cam.global_position.distance_to(_lod_cam) > 8.0:
		_lod_cam = cam.global_position
		FrameJobs.add(func() -> void: _refresh_lod(_lod_cam), FrameJobs.PRIO_HIGH, "settlements-lod")


const OPEN_CELL := 16.0
var _foot_grid := {}  # Vector2i cell -> Array of Vector3(x, z, radius)


## True when (x, z) is outside every building footprint (fountains and walls included). Used by wandering Chogs.
func is_open(x: float, z: float) -> bool:
	var c := Vector2i(floori(x / OPEN_CELL), floori(z / OPEN_CELL))
	for dx in range(-1, 2):
		for dz in range(-1, 2):
			var list = _foot_grid.get(Vector2i(c.x + dx, c.y + dz))
			if list == null:
				continue
			for f in list:
				var v: Vector3 = f
				if (v.x - x) * (v.x - x) + (v.y - z) * (v.y - z) < v.z * v.z:
					return false
	return true


## Index of the enterable building under the cursor (screen space), or -1. Only when zoomed in enough.
func pick_building(camera: Camera3D, screen_pos: Vector2) -> int:
	var best := -1
	var best_d := INF
	for i in _buildings.size():
		if not InteriorCatalog.ENTERABLE.has(str(_buildings[i]["type"])):
			continue
		var wp := _building_pos[i]
		if camera.is_position_behind(wp):
			continue
		var dist := camera.global_position.distance_to(wp)
		if dist > 320.0:
			continue
		# Hit radius = the building's half-width projected on screen, so big castles are easy to click.
		var foot: float = FOOTPRINT.get(str(_buildings[i]["type"]), 3.0) * float(_buildings[i]["s"])
		var sp := camera.unproject_position(wp)
		var edge := camera.unproject_position(wp + camera.global_transform.basis.x * foot)
		var radius := clampf(sp.distance_to(edge), 12.0, 220.0)
		var d := sp.distance_to(screen_pos)
		if d < radius and d < best_d:
			best_d = d
			best = i
	return best


func _build_props(props: Dictionary) -> void:
	if props.is_empty():
		return
	var types: Array = props["types"]
	var groups := {}
	var tt: Array = props["t"]
	for i in tt.size():
		var ti := int(tt[i])
		if not groups.has(ti):
			groups[ti] = {"x": [] as Array[Transform3D], "c": [] as Array[Color]}
		var x: float = props["x"][i]
		var z: float = props["z"][i]
		var s: float = props["s"][i]
		var y := terrain.height_at(x, z)
		var name: String = types[ti]
		if name == "lily":
			y = 0.06
		(groups[ti]["x"] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, float(props["r"][i])).scaled(Vector3.ONE * s), Vector3(x, y - 0.1, z)))
		(groups[ti]["c"] as Array[Color]).append(Color(1, 1, 1, 0))
	var distant := {}  # cell -> merged ultra-low trees {v, n, c, u, u2}
	for ti in groups:
		var name: String = types[ti]
		var far_mesh: ArrayMesh = null if SMALL_PROPS.has(name) else Catalog.prop_simple(name)
		_add_lod_set(Catalog.prop(name), far_mesh, groups[ti]["x"], groups[ti]["c"], PROP_NEAR, far_mesh != null)
		if far_mesh:
			_merge_distant(distant, Catalog.prop_distant(name), groups[ti]["x"])
	for cell in distant:
		var d: Dictionary = distant[cell]
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = d["v"]
		arrays[Mesh.ARRAY_NORMAL] = d["n"]
		arrays[Mesh.ARRAY_COLOR] = d["c"]
		arrays[Mesh.ARRAY_TEX_UV] = d["u"]
		arrays[Mesh.ARRAY_TEX_UV2] = d["u2"]
		var m := ArrayMesh.new()
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		m.surface_set_material(0, material)
		var mi := MeshInstance3D.new()
		mi.mesh = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.set_meta("group", "props")
		mi.visibility_range_begin = DISTANT
		mi.visibility_range_begin_margin = 20.0
		add_child(mi)


## Bakes `mesh` at every transform into the per-cell distant meshes (static batching: one draw per cell).
func _merge_distant(distant: Dictionary, mesh: ArrayMesh, xf: Array[Transform3D]) -> void:
	var src := mesh.surface_get_arrays(0)
	var sv: PackedVector3Array = src[Mesh.ARRAY_VERTEX]
	var sn: PackedVector3Array = src[Mesh.ARRAY_NORMAL]
	var sc: PackedColorArray = src[Mesh.ARRAY_COLOR]
	var su: PackedVector2Array = src[Mesh.ARRAY_TEX_UV]
	var su2: PackedVector2Array = src[Mesh.ARRAY_TEX_UV2]
	for t in xf:
		var cell := Vector2i(floori(t.origin.x / PROP_CELL), floori(t.origin.z / PROP_CELL))
		if not distant.has(cell):
			distant[cell] = {"v": PackedVector3Array(), "n": PackedVector3Array(), "c": PackedColorArray(), "u": PackedVector2Array(), "u2": PackedVector2Array()}
		var d: Dictionary = distant[cell]
		var v: PackedVector3Array = d["v"]
		var n: PackedVector3Array = d["n"]
		for k in sv.size():
			v.append(t * sv[k])
			n.append((t.basis * sn[k]).normalized())
		d["v"] = v
		d["n"] = n
		d["c"] = (d["c"] as PackedColorArray) + sc
		d["u"] = (d["u"] as PackedVector2Array) + su
		d["u2"] = (d["u2"] as PackedVector2Array) + su2


## A detailed MultiMesh for instances near the camera plus a cheap one (or nothing) for the rest.
## With `per_cell`, the far copies are split into one MultiMesh per map cell (so the renderer's frustum
## culling skips cells out of view), each handing over to the merged distant mesh past DISTANT.
func _add_lod_set(near_mesh: ArrayMesh, far_mesh: ArrayMesh, xf: Array[Transform3D], tints: Array[Color], radius: float, per_cell := false) -> void:
	var near_mmi := _instances(near_mesh, xf, tints)
	if near_mmi == null:
		return
	var group := "buildings" if radius == BUILDING_NEAR else "props"  # dev profiler: --hide=<group>
	near_mmi.set_meta("group", group)
	var far_mm: Array = []           # per instance: the MultiMesh holding its cheap copy (or null)
	var far_i := PackedInt32Array()  # ... and its index there
	far_mm.resize(xf.size())
	far_i.resize(xf.size())
	if far_mesh and not per_cell:
		var mmi := _instances(far_mesh, xf, tints)
		mmi.set_meta("group", group)
		for i in xf.size():
			far_mm[i] = mmi.multimesh
			far_i[i] = i
	elif far_mesh:
		var cells := {}
		for i in xf.size():
			var cell := Vector2i(floori(xf[i].origin.x / PROP_CELL), floori(xf[i].origin.z / PROP_CELL))
			if not cells.has(cell):
				cells[cell] = PackedInt32Array()
			var l: PackedInt32Array = cells[cell]
			l.append(i)
			cells[cell] = l
		for cell in cells:
			var members: PackedInt32Array = cells[cell]
			var cx: Array[Transform3D] = []
			var cc: Array[Color] = []
			for i in members:
				cx.append(xf[i])
				cc.append(tints[i])
			var mmi := _instances(far_mesh, cx, cc)
			mmi.set_meta("group", group)
			mmi.visibility_range_end = DISTANT
			mmi.visibility_range_end_margin = 20.0
			for k in members.size():
				far_mm[members[k]] = mmi.multimesh
				far_i[members[k]] = k
	near_mmi.multimesh.visible_instance_count = 0
	var pos := PackedVector3Array()
	for t in xf:
		pos.append(t.origin)
	near_mmi.visible = false
	var si := _lod_sets.size()
	_lod_sets.append({"near": near_mmi.multimesh, "far_mm": far_mm, "far_i": far_i, "r": radius,
		"near_node": near_mmi, "pos": pos, "xf": xf, "c": tints,
		"near_idx": PackedInt32Array(), "flag": _zeros(xf.size())})
	# spatial hash: cell -> packed (set index << 16 | instance index)
	for i in pos.size():
		var cell := Vector2i(floori(pos[i].x / LOD_CELL), floori(pos[i].z / LOD_CELL))
		if not _lod_grid.has(cell):
			_lod_grid[cell] = PackedInt32Array()
		var list: PackedInt32Array = _lod_grid[cell]
		list.append((si << 16) | i)
		_lod_grid[cell] = list


func _zeros(n: int) -> PackedByteArray:
	var b := PackedByteArray()
	b.resize(n)
	return b


## Detailed buildings/props near the camera, cheap ones (or nothing, for tiny props) everywhere else.
## Only grid cells within reach of the camera are scanned, and only instances that enter or leave the
## near set are touched in the far MultiMesh (hidden there by a zero-scale transform), so the cost
## follows what changed, not the size of the world. Each type keeps one near and one far MultiMesh.
func _refresh_lod(cam_pos: Vector3) -> void:
	var reach := maxf(BUILDING_NEAR, PROP_NEAR)
	var c0 := Vector2i(floori((cam_pos.x - reach) / LOD_CELL), floori((cam_pos.z - reach) / LOD_CELL))
	var c1 := Vector2i(floori((cam_pos.x + reach) / LOD_CELL), floori((cam_pos.z + reach) / LOD_CELL))
	var want := {}
	for cx in range(c0.x, c1.x + 1):
		for cz in range(c0.y, c1.y + 1):
			var cell = _lod_grid.get(Vector2i(cx, cz))
			if cell == null:
				continue
			for code in (cell as PackedInt32Array):
				var si := code >> 16
				var i := code & 0xFFFF
				var ps: Dictionary = _lod_sets[si]
				var r: float = ps["r"]
				if (ps["pos"] as PackedVector3Array)[i].distance_squared_to(cam_pos) <= r * r:
					if not want.has(si):
						want[si] = PackedInt32Array()
					var w: PackedInt32Array = want[si]
					w.append(i)
					want[si] = w
	var touched := _lod_active.duplicate()
	for si in want:
		touched[si] = true
	_lod_active.clear()
	for si in touched:
		var list: PackedInt32Array = want.get(si, PackedInt32Array())
		_apply_lod_set(si, list)
		if not list.is_empty():
			_lod_active[si] = true


func _apply_lod_set(si: int, list: PackedInt32Array) -> void:
	var ps: Dictionary = _lod_sets[si]
	var xf: Array[Transform3D] = ps["xf"]
	var tints: Array[Color] = ps["c"]
	var flag: PackedByteArray = ps["flag"]
	var old: PackedInt32Array = ps["near_idx"]
	var far_mm: Array = ps["far_mm"]
	var far_i: PackedInt32Array = ps["far_i"]
	var near: MultiMesh = ps["near"]
	for i in old:
		flag[i] = 2  # was near
	for i in list:
		if flag[i] == 2:
			flag[i] = 3  # stays near
		else:
			flag[i] = 1  # enters: hide its cheap copy
			if far_mm[i] != null:
				(far_mm[i] as MultiMesh).set_instance_transform(far_i[i], Transform3D(Basis.from_scale(Vector3.ZERO), xf[i].origin))
	for i in old:
		if flag[i] == 2:
			flag[i] = 0  # leaves: show its cheap copy again
			if far_mm[i] != null:
				(far_mm[i] as MultiMesh).set_instance_transform(far_i[i], xf[i])
		else:
			flag[i] = 1
	for n in list.size():
		near.set_instance_transform(n, xf[list[n]])
		near.set_instance_custom_data(n, tints[list[n]])
	near.visible_instance_count = list.size()
	(ps["near_node"] as Node3D).visible = not list.is_empty()  # skip empty draws
	ps["near_idx"] = list
	ps["flag"] = flag


func _build_roads(roads: Array) -> void:
	var a := Architect.new()
	var dirt := Color("#b89a6a")
	for r in roads:
		var pts: Array = r["pts"]
		var width := 1.6
		for i in pts.size() - 1:
			var p0 := Vector3(pts[i][0], 0, pts[i][1])
			var p1 := Vector3(pts[i + 1][0], 0, pts[i + 1][1])
			var dir := (p1 - p0).normalized()
			var side := Vector3(-dir.z, 0, dir.x) * width
			var q: Array[Vector3] = [p0 + side, p0 - side, p1 - side, p1 + side]
			for k in 4:
				var v: Vector3 = q[k]
				v.y = maxf(terrain.height_at(v.x, v.z), 0.15) + 0.18
				q[k] = v
			var center: Vector3 = (q[0] + q[1] + q[2] + q[3]) / 4.0 - Vector3(0, 5, 0)  # makes the face point up
			a._quad(q[0], q[1], q[2], q[3], dirt, center)
	var mesh := a.commit()
	if mesh.get_surface_count() == 0:
		return
	mesh.surface_set_material(0, material)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _build_labels(world: Dictionary) -> void:
	for region in world.get("regions", []):
		var l := _label(str(region["name"]), 30, Color(region["accent"]), true)
		l.position = Vector3(region["x"], maxf(terrain.height_at(region["x"], region["z"]), 2.0) + 40.0, region["z"])
		l.visibility_range_begin = 160.0  # region names only from afar
		add_child(l)
	for poi in world.get("pois", []):
		var kind: String = poi["kind"]
		var x: float = poi["x"]
		var z: float = poi["z"]
		var y := terrain.height_at(x, z)
		if kind == "capital":
			var l := _label(str(poi["name"]), 22, Color.WHITE, true)
			l.position = Vector3(x, y + 28.0, z)
			add_child(l)
		elif kind != "district":
			var l2 := _label(str(poi["name"]), 26, Color("#ffe9b0") if kind != "dungeon" else Color("#8ef0c4"), false)
			l2.position = Vector3(x, y + 11.0, z)
			l2.visibility_range_end = 230.0  # small places only when you get closer
			add_child(l2)
	for b in world.get("buildings", []):
		var nm: String = b["name"]
		if nm == "":
			continue
		var l3 := _label(nm, 22, Color("#fff3d6"), false)
		l3.pixel_size = 0.04
		var bx: float = b["x"]
		var bz: float = b["z"]
		l3.position = Vector3(bx, terrain.height_at(bx, bz) + 9.5 * float(b["s"]), bz)
		l3.visibility_range_end = 110.0  # shop signs only up close
		add_child(l3)


func _label(text: String, size: int, color: Color, fixed: bool) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.modulate = color
	l.outline_size = 10
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = fixed
	l.fixed_size = fixed
	l.pixel_size = 0.0012 if fixed else 0.05
	return l


func _build_volcano(landmarks: Dictionary) -> void:
	if not landmarks.has("volcano"):
		return
	var v: Dictionary = landmarks["volcano"]
	var top := Vector3(v["x"], float(v["h"]) - 6.0, v["z"])
	var glow := OmniLight3D.new()
	glow.light_color = Color("#ff7a2a")
	glow.light_energy = 3.0
	glow.omni_range = 70.0
	glow.position = top + Vector3(0, 6, 0)
	add_child(glow)
	var smoke := CPUParticles3D.new()
	smoke.amount = 40
	smoke.lifetime = 9.0
	smoke.preprocess = 9.0
	smoke.position = top + Vector3(0, 4, 0)
	smoke.direction = Vector3(0.2, 1, 0)
	smoke.spread = 12.0
	smoke.initial_velocity_min = 3.0
	smoke.initial_velocity_max = 5.0
	smoke.gravity = Vector3(0.6, 0.4, 0)
	smoke.scale_amount_min = 3.0
	smoke.scale_amount_max = 6.0
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.4))
	curve.add_point(Vector2(1, 2.2))
	smoke.scale_amount_curve = curve
	var puff := SphereMesh.new()
	puff.radius = 1.0
	puff.height = 2.0
	puff.radial_segments = 8
	puff.rings = 4
	var pm := StandardMaterial3D.new()
	pm.albedo_color = Color(0.25, 0.22, 0.22, 0.55)
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	puff.material = pm
	smoke.mesh = puff
	add_child(smoke)
