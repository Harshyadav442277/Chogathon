class_name Terrain
extends MeshInstance3D
## Builds the Monadia continent from the exported height and color grids (same generator as the server).

var grid_x := 0
var grid_z := 0
var size_x := 0.0
var size_z := 0.0
var heights := PackedFloat32Array()


func _ready() -> void:
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/terrain_meta.json"))
	grid_x = int(meta["grid_x"])
	grid_z = int(meta["grid_z"])
	size_x = float(meta["size_x"])
	size_z = float(meta["size_z"])
	heights = FileAccess.get_file_as_bytes("res://data/terrain_height.bin").to_float32_array()
	var colors := FileAccess.get_file_as_bytes("res://data/terrain_color.bin")
	mesh = _build_mesh(colors)
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true
	mat.roughness = 1.0
	mat.metallic_specular = 0.0
	if OS.get_cmdline_user_args().has("--unshaded"):
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _vertex(i: int, j: int) -> Vector3:
	return Vector3(-size_x / 2.0 + float(i) / (grid_x - 1) * size_x, heights[j * grid_x + i], -size_z / 2.0 + float(j) / (grid_z - 1) * size_z)


func _build_mesh(colors: PackedByteArray) -> ArrayMesh:
	# Flat shading: every triangle gets its own vertices and face normal (low-poly look).
	# Packed arrays are preallocated; this runs once at startup.
	var quads := (grid_x - 1) * (grid_z - 1)
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()
	verts.resize(quads * 6)
	norms.resize(quads * 6)
	cols.resize(quads * 6)
	var p := 0
	for j in range(grid_z - 1):
		for i in range(grid_x - 1):
			var a := _vertex(i, j)
			var b := _vertex(i + 1, j)
			var c := _vertex(i, j + 1)
			var d := _vertex(i + 1, j + 1)
			var k := (j * grid_x + i) * 3
			var col := Color8(colors[k], colors[k + 1], colors[k + 2])
			var n1 := (c - a).cross(b - a).normalized()
			var n2 := (c - b).cross(d - b).normalized()
			# Godot treats clockwise triangles (seen from the front) as front faces: a,b,c and b,d,c face up.
			verts[p] = a; verts[p + 1] = b; verts[p + 2] = c
			verts[p + 3] = b; verts[p + 4] = d; verts[p + 5] = c
			for q in 3:
				norms[p + q] = n1
				norms[p + 3 + q] = n2
			for q in 6:
				cols[p + q] = col
			p += 6
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = norms
	arrays[Mesh.ARRAY_COLOR] = cols
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m


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
