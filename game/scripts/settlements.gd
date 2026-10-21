class_name Settlements
extends Node3D
## Places every building, prop, road and label from world.json (v2) using procedural meshes from
## catalog.gd. One MultiMeshInstance3D per building/prop type, all sharing shaders/vcol.gdshader.

const ROOF := {
	"capital": Color("#8d74d6"), "emberforge": Color("#c0392b"), "tidecry": Color("#2f6f9f"), "prism": Color("#8e6cd9"),
	"dreamveil": Color("#e6a93c"), "hollow": Color("#4a4560"), "frogsong": Color("#4f8a3c"), "rugcoast": Color("#7a4b2a"),
	"wastes": Color("#6d675e"), "demon": Color("#5a1f6a"),
}

const FOOTPRINT := {
	"castle": 9.0, "keep": 6.0, "colosseum": 11.0, "spire": 10.0, "demon_castle": 11.0, "guild_hall": 5.0,
	"temple": 4.5, "library": 4.5, "barracks": 5.0, "academy": 4.5, "market": 6.0, "dungeon": 3.5, "tavern": 3.5,
}

var terrain: Terrain
var material: ShaderMaterial
var _buildings: Array = []
var _detail_nodes: Array[Node3D] = []   # detailed buildings + small props (near view)
var _simple_nodes: Array[Node3D] = []   # stand-ins (far view)
var _far := false
var _lod_tick := 0.0
const SMALL_PROPS := ["flowers", "reeds", "lily", "rock", "mushroom", "bonespike", "lavarock"]
const FAR_HEIGHT := 250.0  # camera height above which the far LOD is used
var _building_pos := PackedVector3Array()


func build(world: Dictionary) -> void:
	material = ShaderMaterial.new()
	material.shader = preload("res://shaders/vcol.gdshader")
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
		var basis := Basis(Vector3.UP, float(b["rot"])).scaled(Vector3.ONE * s)
		(by_type[t]["x"] as Array[Transform3D]).append(Transform3D(basis, Vector3(x, y, z)))
		var roof: Color = ROOF.get(str(b["region"]), Color.WHITE)
		(by_type[t]["c"] as Array[Color]).append(Color(roof.r, roof.g, roof.b, 1.0))
	for t in by_type:
		var near_mmi := _instances(Catalog.building(t), by_type[t]["x"], by_type[t]["c"])
		var far_mmi := _instances(Catalog.building_simple(t), by_type[t]["x"], by_type[t]["c"])
		if near_mmi:
			_detail_nodes.append(near_mmi)
		if far_mmi:
			far_mmi.visible = false
			_simple_nodes.append(far_mmi)


## Swap detailed buildings/small props for stand-ins when the camera is high above the map.
func _process(delta: float) -> void:
	_lod_tick -= delta
	if _lod_tick > 0.0:
		return
	_lod_tick = 0.25
	var cam := get_viewport().get_camera_3d()
	if cam == null or cam.global_position.y < -500.0:  # inside an interior
		return
	var h := cam.global_position.y
	var far := h > FAR_HEIGHT + (15.0 if not _far else -15.0)  # hysteresis
	if far == _far:
		return
	_far = far
	for n in _detail_nodes:
		n.visible = not far
	for n in _simple_nodes:
		n.visible = far


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
	for ti in groups:
		var mmi := _instances(Catalog.prop(str(types[ti])), groups[ti]["x"], groups[ti]["c"])
		if mmi and SMALL_PROPS.has(str(types[ti])):
			_detail_nodes.append(mmi)  # tiny props only when zoomed in


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
