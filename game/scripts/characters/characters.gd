extends Node3D
## Renders all 1,969 Chogs as little chibi characters in one MultiMesh draw call.
## Contract with main.gd (docs/WORKSPLIT.md): terrain, pick(), id_at(), position_of().

const SUPPLY := 1969
const WALK_SPEED := 4.0  # units/s
const MAX_TRIP := 30.0   # s; long trips speed up so a cross-continent move still lands before the next sim tick (~45 s)
const MIN_SCREEN := 0.0065  # character.gdshader min_screen
const STATES := {"walk": 0, "work": 1, "fight": 2}
const ROLES := {"main_dps": 1, "sub_dps": 2, "tank": 3, "healer": 4, "support": 5, "buffer": 6}

var terrain: Terrain
var _mmi := MultiMeshInstance3D.new()
var _cur := PackedVector3Array()
var _tgt := PackedVector3Array()
var _yaw := PackedFloat32Array()
var _ids := PackedInt32Array()
var _code := PackedFloat32Array()  # state + 4 * role, from the server
var _speed := PackedFloat32Array()
var _walking := PackedByteArray()
var _active := PackedInt32Array()  # indices currently walking; only these are touched per frame
var _frame := 0
var _perf := OS.get_cmdline_user_args().has("--perf")
var _perf_us := 0
var _perf_max := 0
var _perf_frames := 0


func _ready() -> void:
	var mesh := ChibiMesh.build()
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/character.gdshader")
	mat.set_shader_parameter("atlas", preload("res://assets/chogs_atlas.webp"))
	mat.set_shader_parameter("min_screen", MIN_SCREEN)
	mesh.surface_set_material(0, mat)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = SUPPLY
	mm.visible_instance_count = 0
	_mmi.multimesh = mm
	_mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Characters are spread across the whole continent.
	_mmi.custom_aabb = AABB(Vector3(-500, -50, -400), Vector3(1000, 200, 800))
	_mmi.visible = not OS.get_cmdline_user_args().has("--hide-chars")
	add_child(_mmi)
	GameState.positions_updated.connect(_on_positions)
	GameState.selection_changed.connect(func(_id): _refresh_custom())


func _on_positions() -> void:
	var p: Dictionary = GameState.positions
	var ids: Array = p["ids"]
	var n := ids.size()
	var first := _cur.size() != n
	_tgt.resize(n)
	_ids.resize(n)
	_code.resize(n)
	if first:
		_cur.resize(n)
		_yaw.resize(n)
		_speed.resize(n)
		_walking.resize(n)
		_walking.fill(0)
	var mm := _mmi.multimesh
	for i in n:
		var x: float = p["x"][i]
		var z: float = p["z"][i]
		var y := maxf(terrain.height_at(x, z), 0.3) if terrain else 0.0
		_tgt[i] = Vector3(x, y, z)
		_ids[i] = int(ids[i])
		if first:
			_cur[i] = _tgt[i]
			_yaw[i] = fmod(_ids[i] * 2.39996, TAU)  # golden-angle spread so idle crowds don't all face one way
			mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, _yaw[i]), _cur[i]))
		else:
			_walk_to_target(i)
		var state: int = STATES.get(str(p["state"][i]), 1) if p.has("state") else 1
		var role: int = ROLES.get(str(p["role"][i]), 0) if p.has("role") else 0
		_code[i] = state + 4 * role
		mm.set_instance_color(i, GameState.HOUSE_COLORS[int(p["house"][i])])
	mm.visible_instance_count = n
	if first and OS.get_cmdline_user_args().has("--walk-test"):
		_scatter()
	_refresh_custom()
	if first:
		_maybe_select()


## Starts a walk when the server moved this Chog: constant speed, facing the direction of travel.
func _walk_to_target(i: int) -> void:
	var d := _tgt[i] - _cur[i]
	var dist := Vector2(d.x, d.z).length()
	if dist < 0.05:
		return
	_speed[i] = maxf(WALK_SPEED, dist / MAX_TRIP)
	_yaw[i] = atan2(d.x, d.z)
	if _walking[i] == 0:
		_walking[i] = 1
		_active.append(i)
		_set_custom(i)


func _refresh_custom() -> void:
	for i in _ids.size():
		_set_custom(i)


func _set_custom(i: int) -> void:
	var sel := 1.0 if _ids[i] == GameState.selected else 0.0
	var phase := fmod(_ids[i] * 0.618034, 1.0)
	# While walking the state is 0 (walk); the role stays so props keep showing.
	var code := floorf(_code[i] / 4.0) * 4.0 if _walking[i] == 1 else _code[i]
	_mmi.multimesh.set_instance_custom_data(i, Color(float(_ids[i] - 1), code, phase, sel))


func _process(delta: float) -> void:
	var t0 := Time.get_ticks_usec()
	_walk(delta)
	if _perf:
		_log_perf(Time.get_ticks_usec() - t0)


func _walk(delta: float) -> void:
	if _active.is_empty():
		return
	var mm := _mmi.multimesh
	var still := PackedInt32Array()
	_frame += 1
	for i in _active:
		var c := _cur[i]
		var to := _tgt[i]
		var dx := to.x - c.x
		var dz := to.z - c.z
		var dist := sqrt(dx * dx + dz * dz)
		var step := _speed[i] * delta
		if dist <= step:
			c = to
			_walking[i] = 0
			_set_custom(i)
		else:
			c.x += dx / dist * step
			c.z += dz / dist * step
			# Terrain lookups are most of the cost: each walker samples the ground every 4th frame, staggered.
			if terrain and (i + _frame) & 3 == 0:
				c.y = maxf(terrain.height_at(c.x, c.z), 0.3)
			still.append(i)
		_cur[i] = c
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, _yaw[i]), c))
	_active = still


## Index of the character whose head is nearest to a screen point (within radius px), or -1.
func pick(camera: Camera3D, screen_pos: Vector2, radius := 18.0) -> int:
	var best := -1
	var best_d := radius * radius
	var eye := camera.global_position
	for i in _cur.size():
		var s := maxf(1.0, eye.distance_to(_cur[i]) * MIN_SCREEN)
		var wp := _cur[i] + Vector3(0, ChibiMesh.HEAD_Y * s, 0)
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


## Dev helper: `-- --select=181` selects a Chog once positions arrive (the camera flies to it).
func _maybe_select() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--select="):
			GameState.select(int(arg.trim_prefix("--select=")))


## Dev helper: `-- --walk-test` moves every Chog 20-60 units off its spot so the whole crowd walks back (worst case for --perf).
func _scatter() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in _cur.size():
		var a := rng.randf() * TAU
		var r := rng.randf_range(20.0, 60.0)
		var x := _tgt[i].x + sin(a) * r
		var z := _tgt[i].z + cos(a) * r
		_cur[i] = Vector3(x, maxf(terrain.height_at(x, z), 0.3) if terrain else 0.0, z)
		_walk_to_target(i)


## Dev helper: `-- --perf` prints the character update cost and the frame's draw calls once a second.
func _log_perf(us: int) -> void:
	_perf_us += us
	_perf_max = maxi(_perf_max, us)
	_perf_frames += 1
	if _perf_frames >= 60:
		print("chars: fps %d, avg %d us, max %d us, walking %d, draw calls %d, objects %d" % [Engine.get_frames_per_second(), _perf_us / _perf_frames, _perf_max, _active.size(), Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)])
		_perf_us = 0
		_perf_max = 0
		_perf_frames = 0
