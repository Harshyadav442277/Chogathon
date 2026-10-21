class_name ChogSwarm
extends MultiMeshInstance3D
## All Chogs in one draw call. Tokens walk smoothly toward the latest server positions.

const SUPPLY := 1969
const WALK_RATE := 1.2

var terrain: Terrain
var _cur := PackedVector3Array()
var _tgt := PackedVector3Array()
var _ids := PackedInt32Array()
var _moving := false


func _ready() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/chog_token.gdshader")
	mat.set_shader_parameter("atlas", preload("res://assets/chogs_atlas.webp"))
	quad.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = quad
	mm.instance_count = SUPPLY
	mm.visible_instance_count = 0
	multimesh = mm
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Tokens are spread across the whole continent.
	custom_aabb = AABB(Vector3(-500, -50, -400), Vector3(1000, 200, 800))
	GameState.positions_updated.connect(_on_positions)
	GameState.selection_changed.connect(func(_id): _refresh_highlight())


func _on_positions() -> void:
	var p: Dictionary = GameState.positions
	var ids: Array = p["ids"]
	var n := ids.size()
	var first := _cur.size() != n
	_tgt.resize(n)
	if first:
		_cur.resize(n)
	_ids.resize(n)
	for i in n:
		var x: float = p["x"][i]
		var z: float = p["z"][i]
		var y := maxf(terrain.height_at(x, z), 0.3) if terrain else 0.0
		_tgt[i] = Vector3(x, y, z)
		if first:
			_cur[i] = _tgt[i]
		_ids[i] = int(ids[i])
		multimesh.set_instance_color(i, GameState.HOUSE_COLORS[int(p["house"][i])])
	multimesh.visible_instance_count = n
	_moving = true
	_refresh_highlight()


func _refresh_highlight() -> void:
	for i in _ids.size():
		var sel := 1.0 if _ids[i] == GameState.selected else 0.0
		multimesh.set_instance_custom_data(i, Color(float(_ids[i] - 1), sel, 0, 0))


func _process(delta: float) -> void:
	var n := _cur.size()
	if n == 0 or not _moving:
		return
	var k := 1.0 - exp(-delta * WALK_RATE)
	var still_moving := false
	for i in n:
		var to := _tgt[i]
		if _cur[i].distance_squared_to(to) > 0.0004:
			_cur[i] = _cur[i].lerp(to, k)
			still_moving = true
		else:
			_cur[i] = to
		multimesh.set_instance_transform(i, Transform3D(Basis.IDENTITY, _cur[i]))
	_moving = still_moving


## Index of the token nearest to a screen point (within radius px), or -1.
func pick(camera: Camera3D, screen_pos: Vector2, radius := 18.0) -> int:
	var best := -1
	var best_d := radius * radius
	for i in _cur.size():
		var wp := _cur[i] + Vector3(0, 1.3, 0)
		if camera.is_position_behind(wp):
			continue
		var d := camera.unproject_position(wp).distance_squared_to(screen_pos)
		if d < best_d:
			best_d = d
			best = i
	return best


func id_at(index: int) -> int:
	return _ids[index] if index >= 0 and index < _ids.size() else -1


func position_of(chog_id: int) -> Vector3:
	var i := _ids.find(chog_id)
	return _cur[i] if i >= 0 else Vector3.ZERO
