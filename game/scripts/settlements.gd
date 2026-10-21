class_name Settlements
extends Node3D
## Places low-poly buildings, landmarks and region labels from world.json.
## Placeholder primitives for the de-risk gate; swapped for Kenney 3D kit models later.

const WALL := {
	"capital": Color("#ece4ff"), "emberforge": Color("#8a6a5a"), "tidecry": Color("#dfe8ee"), "prism": Color("#f2e6cc"),
	"dreamveil": Color("#fff4dc"), "hollow": Color("#4a4560"), "frogsong": Color("#cfe3c0"), "rugcoast": Color("#c9a77a"), "wastes": Color("#a59d90"),
}
const ROOF := {
	"capital": Color("#7b4dff"), "emberforge": Color("#c0392b"), "tidecry": Color("#2f6f9f"), "prism": Color("#8e6cd9"),
	"dreamveil": Color("#e6a93c"), "hollow": Color("#2a2738"), "frogsong": Color("#4f8a3c"), "rugcoast": Color("#7a4b2a"), "wastes": Color("#6d675e"),
}
const HOUSES_PER_KIND := {"capital": 8, "district": 3, "town": 4, "village": 2, "tavern": 1, "dock": 1}

var terrain: Terrain
var _walls: Array[Transform3D] = []
var _wall_cols: Array[Color] = []
var _roofs: Array[Transform3D] = []
var _roof_cols: Array[Color] = []
var _towers: Array[Transform3D] = []
var _glows: Array[Transform3D] = []
var _glow_cols: Array[Color] = []


func build(world: Dictionary) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 143
	for poi in world.get("pois", []):
		var x: float = poi["x"]
		var z: float = poi["z"]
		var region: String = poi["region"]
		var kind: String = poi["kind"]
		var y := terrain.height_at(x, z)
		if kind == "capital":
			var tower_h := 30.0 if region == "capital" else 16.0
			var base_y := 0.6 if region == "capital" else y
			_towers.append(Transform3D(Basis.from_scale(Vector3(3.0, tower_h, 3.0)), Vector3(x, base_y + tower_h / 2.0, z)))
			_glows.append(Transform3D(Basis.from_scale(Vector3.ONE * 2.0), Vector3(x, base_y + tower_h + 1.5, z)))
			_glow_cols.append(ROOF.get(region, Color.WHITE).lightened(0.3))
		elif kind == "obelisk":
			_towers.append(Transform3D(Basis.from_scale(Vector3(1.2, 10.0, 1.2)), Vector3(x, y + 5.0, z)))
			_glows.append(Transform3D(Basis.from_scale(Vector3.ONE * 1.4), Vector3(x, y + 11.0, z)))
			_glow_cols.append(Color("#8ef0c4"))
		elif kind == "dungeon":
			_glows.append(Transform3D(Basis.from_scale(Vector3(2.5, 3.0, 0.4)), Vector3(x, y + 1.5, z)))
			_glow_cols.append(Color("#8ef0c4"))
		var n: int = HOUSES_PER_KIND.get(kind, 0)
		var radius := 8.0 if kind == "capital" else 3.5
		for h in n:
			var a: float = TAU * h / maxi(n, 1) + rng.randf() * 0.5
			var r := 0.0 if n == 1 else radius * rng.randf_range(0.8, 1.2)
			var hx := x + cos(a) * r
			var hz := z + sin(a) * r
			var hy := terrain.height_at(hx, hz)
			var s := (1.5 if kind == "tavern" else 1.0) * rng.randf_range(0.9, 1.2)
			var w := 2.6 * s
			var hh := 2.2 * s
			var rot := Basis(Vector3.UP, rng.randf() * PI)
			_walls.append(Transform3D(rot.scaled(Vector3(w, hh, w * 0.85)), Vector3(hx, hy + hh / 2.0, hz)))
			_wall_cols.append(WALL.get(region, Color.WHITE))
			_roofs.append(Transform3D(rot.scaled(Vector3(w * 0.8, 1.8 * s, w * 0.8)), Vector3(hx, hy + hh + 0.9 * s, hz)))
			_roof_cols.append(ROOF.get(region, Color.GRAY))
			if kind == "tavern":
				_glows.append(Transform3D(Basis.from_scale(Vector3.ONE * 0.6), Vector3(hx + w * 0.7, hy + 2.6, hz)))
				_glow_cols.append(Color("#ffb84d"))
	_add_multimesh(BoxMesh.new(), _walls, _wall_cols, false)
	var roof := CylinderMesh.new()
	roof.top_radius = 0.0
	roof.bottom_radius = 0.75
	roof.radial_segments = 4
	roof.height = 1.0
	_add_multimesh(roof, _roofs, _roof_cols, false)
	var tower := CylinderMesh.new()
	tower.top_radius = 0.5
	tower.bottom_radius = 0.55
	tower.radial_segments = 8
	tower.height = 1.0
	var tower_cols: Array[Color] = []
	tower_cols.resize(_towers.size())
	tower_cols.fill(Color("#e9e1ff"))
	_add_multimesh(tower, _towers, tower_cols, false)
	var glow := SphereMesh.new()
	glow.radius = 0.5
	glow.height = 1.0
	glow.radial_segments = 8
	glow.rings = 4
	_add_multimesh(glow, _glows, _glow_cols, true)
	_add_labels(world)


func _add_multimesh(mesh: Mesh, xforms: Array[Transform3D], cols: Array[Color], unshaded: bool) -> void:
	if xforms.is_empty():
		return
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true
	mat.roughness = 0.85
	if unshaded:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.surface_set_material(0, mat)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, cols[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if unshaded else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mmi)


func _add_labels(world: Dictionary) -> void:
	for region in world.get("regions", []):
		var l := _label(region["name"], 30, Color(region["accent"]))
		l.position = Vector3(region["x"], maxf(terrain.height_at(region["x"], region["z"]), 2.0) + 32.0, region["z"])
		add_child(l)
	for poi in world.get("pois", []):
		if poi["kind"] != "capital":
			continue
		var l := _label(str(poi["name"]), 22, Color.WHITE)
		l.position = Vector3(poi["x"], terrain.height_at(poi["x"], poi["z"]) + 24.0, poi["z"])
		add_child(l)


func _label(text: String, size: int, color: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.0012
	l.modulate = color
	l.outline_size = 10
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true  # constant on-screen size, readable at any zoom
	return l
