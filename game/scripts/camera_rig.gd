class_name CameraRig
extends Node3D
## God's-eye camera: left-drag pan, right-drag orbit, wheel/pinch zoom, WASD pan, smooth fly-to.
## The look-at point follows the ground height (smoothly), and the camera never dips below the terrain.

signal clicked(screen_pos: Vector2)

@export var min_dist := 14.0
@export var max_dist := 640.0
@export var min_pitch := deg_to_rad(25.0)
@export var max_pitch := deg_to_rad(70.0)
@export var bounds := Vector2(460, 400)

var camera: Camera3D
var dist := 520.0
var yaw := 0.0
var pitch := deg_to_rad(52.0)
var _goal: Variant = null  # Vector3 target while flying
var _goal_dist := 0.0
var _drag_button := 0
var _press_pos := Vector2.ZERO
var terrain: Terrain  # set by main; optional
var _ground := 0.0    # smoothed ground height under the look-at point


func _ready() -> void:
	camera = Camera3D.new()
	camera.fov = 45.0
	camera.near = 1.0
	camera.far = 2500.0
	add_child(camera)
	position = Vector3(0, 0, 20)
	_apply()


func fly_to(target: Vector3, to_dist := 70.0) -> void:
	_goal = Vector3(target.x, 0.0, target.z)
	_goal_dist = to_dist


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom(0.88)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom(1.0 / 0.88)
		elif mb.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
			if mb.pressed:
				_drag_button = mb.button_index
				_press_pos = mb.position
			else:
				if mb.button_index == MOUSE_BUTTON_LEFT and mb.position.distance_to(_press_pos) < 5.0:
					clicked.emit(mb.position)
				_drag_button = 0
	elif event is InputEventMouseMotion and _drag_button != 0:
		var mm := event as InputEventMouseMotion
		_goal = null
		if _drag_button == MOUSE_BUTTON_LEFT:
			_pan(mm.relative)
		else:
			yaw -= mm.relative.x * 0.006
			pitch = clampf(pitch + mm.relative.y * 0.004, min_pitch, max_pitch)
			_apply()
	elif event is InputEventMagnifyGesture:
		_zoom(1.0 / (event as InputEventMagnifyGesture).factor)
	elif event is InputEventPanGesture:
		_pan((event as InputEventPanGesture).delta * 8.0)


func _pan(relative: Vector2) -> void:
	var s := dist * 0.0016
	var right := Vector3(cos(yaw), 0, -sin(yaw))
	var fwd := Vector3(sin(yaw), 0, cos(yaw))
	position -= (right * relative.x + fwd * relative.y) * s
	position.x = clampf(position.x, -bounds.x, bounds.x)
	position.z = clampf(position.z, -bounds.y, bounds.y)
	_apply()


func _zoom(f: float) -> void:
	_goal = null
	dist = clampf(dist * f, min_dist, max_dist)
	_apply()


func _process(delta: float) -> void:
	var move := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up"))
	if move != Vector2.ZERO:
		_goal = null
		_pan(-move * delta * 600.0)
	if terrain:
		var g := maxf(terrain.height_at(position.x, position.z), 0.0)
		if absf(g - _ground) > 0.01:
			_ground = lerpf(_ground, g, 1.0 - exp(-delta * 5.0))
			_apply()
	if _goal != null:
		var k := 1.0 - exp(-delta * 3.0)
		position = position.lerp(_goal, k)
		dist = lerpf(dist, _goal_dist, k)
		_apply()
		if position.distance_to(_goal) < 0.3 and absf(dist - _goal_dist) < 0.5:
			_goal = null


func _apply() -> void:
	if camera == null:
		return
	var target := Vector3(global_position.x, _ground, global_position.z)
	var offset := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	var cam_pos := target + offset
	if terrain:
		cam_pos.y = maxf(cam_pos.y, terrain.height_at(cam_pos.x, cam_pos.z) + 3.0)
	camera.global_position = cam_pos
	camera.look_at(target, Vector3.UP)


## Jump the look-at height to the ground right away (no smoothing), e.g. after a teleport.
func snap_ground() -> void:
	if terrain:
		_ground = maxf(terrain.height_at(position.x, position.z), 0.0)
	_apply()
