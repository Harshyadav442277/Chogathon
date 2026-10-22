class_name Interiors
extends Node3D
## Building interiors: click an enterable building in the world to step inside a dollhouse room.
## The room is built far below the world with its own camera and environment; the world keeps running.
## Shows the Chogs who work there (wandering between spots) and a story panel from /api/v2/building/:id.

signal exited

const ROOM_ORIGIN := Vector3(0, -2000, 0)
const ATLAS_COLS := 45
const TILE := 64

var world_rig: CameraRig
var active := false
var _room: Node3D
var _camera: Camera3D
var _ui: CanvasLayer
var _title: Label
var _sub: Label
var _story: RichTextLabel
var _people: VBoxContainer
var _tokens: Array[Node3D] = []
var _token_ids: Array[int] = []
var _spots: Array[Vector3] = []
var _material: ShaderMaterial
var _atlas: Texture2D
var _building_id := -1


func _ready() -> void:
	position = ROOM_ORIGIN
	_atlas = preload("res://assets/chogs_atlas.webp")
	_material = ShaderMaterial.new()
	_material.shader = preload("res://shaders/vcol.gdshader")
	_material.set_shader_parameter("noise_tex", preload("res://textures/noise.png"))
	_material.set_shader_parameter("night", 1.0)  # interiors are lamp-lit
	_camera = Camera3D.new()
	_camera.fov = 50.0
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#120f24")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#d8c8b0")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_camera.environment = env
	add_child(_camera)
	_build_ui()
	set_process(false)
	# Fill the room when positions arrive (or refresh) while we're inside an empty room.
	GameState.positions_updated.connect(func():
		if active and _tokens.is_empty() and _room:
			_place_people(_building_id))


## Open the interior for building index `id` (from GameState.world.buildings).
func enter(id: int) -> void:
	var buildings: Array = GameState.world.get("buildings", [])
	if id < 0 or id >= buildings.size():
		return
	var b: Dictionary = buildings[id]
	var type: String = b["type"]
	if not InteriorCatalog.ENTERABLE.has(type):
		return
	_clear()
	_building_id = id
	var data := InteriorCatalog.build(type)
	var size: Vector2 = data["size"]
	_room = Node3D.new()
	add_child(_room)
	var mesh: ArrayMesh = data["mesh"]
	mesh.surface_set_material(0, _material)
	# One-instance MultiMesh: same color path as the world buildings; custom data = region tint for banners.
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = 1
	mm.set_instance_transform(0, Transform3D.IDENTITY)
	mm.set_instance_color(0, Color.WHITE)
	var roof: Color = Settlements.ROOF.get(str(b.get("region", "")), Color.WHITE)
	mm.set_instance_custom_data(0, Color(roof.r, roof.g, roof.b, 1.0))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	_room.add_child(mi)
	for l in data["lights"]:
		var omni := OmniLight3D.new()
		omni.position = l[0]
		omni.light_color = l[1]
		omni.light_energy = l[2]
		omni.omni_range = 14.0
		_room.add_child(omni)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-60, 20, 0)
	key.light_energy = 0.6
	_room.add_child(key)
	_spots = data["spots"]
	_place_people(id)
	# Dollhouse camera: above and in front of the open side.
	var dist := maxf(size.x, size.y) * 1.05
	_camera.position = Vector3(0, dist * 0.75, size.y / 2.0 + dist * 0.55)
	_camera.look_at(global_position + Vector3(0, 0.5, -size.y * 0.08), Vector3.UP)
	_camera.current = true
	if world_rig:
		world_rig.set_process_unhandled_input(false)
		world_rig.set_process(false)
	_title.text = str(b.get("name", "")) if str(b.get("name", "")) != "" else type.capitalize().replace("_", " ")
	_sub.text = "%s  ·  %s" % [type.capitalize().replace("_", " "), str(b.get("city", ""))]
	_story.text = "[i]Listening at the door...[/i]"
	_ui.visible = true
	active = true
	set_process(true)
	_load_story(id)


func exit_interior() -> void:
	if not active:
		return
	active = false
	set_process(false)
	_clear()
	_ui.visible = false
	if world_rig:
		world_rig.camera.current = true
		world_rig.set_process_unhandled_input(true)
		world_rig.set_process(true)
	exited.emit()


func _clear() -> void:
	if _room:
		_room.queue_free()
		_room = null
	_tokens.clear()
	_token_ids.clear()
	for c in _people.get_children():
		c.queue_free()


func _place_people(id: int) -> void:
	var p: Dictionary = GameState.positions
	if p.is_empty() or not p.has("building"):
		return
	var bl: Array = p["building"]
	var ids := GameState.ids
	var count := 0
	for k in bl.size():
		if int(bl[k]) != id:
			continue
		if count >= maxi(_spots.size() * 2, 12):
			break
		var cid := ids[k]
		var s := MeshInstance3D.new()
		var quad := QuadMesh.new()
		quad.size = Vector2(1.5, 1.5)
		s.mesh = quad
		var house_i := int((p["house"] as Array)[k])
		s.material_override = _portrait_material(GameState.HOUSE_COLORS[house_i], cid - 1)
		var spot: Vector3 = _spots[count % _spots.size()] + Vector3(randf_range(-0.6, 0.6), 0, randf_range(-0.6, 0.6))
		s.position = spot + Vector3(0, 0.75, 0)
		s.set_meta("phase", randf() * TAU)
		s.set_meta("goal", s.position)
		_room.add_child(s)
		_tokens.append(s)
		_token_ids.append(cid)
		count += 1


const PORTRAIT_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D atlas : source_color, filter_linear_mipmap;
uniform float slot = 0.0;
uniform vec4 ring : source_color;
void vertex() {
	// face the camera (full billboard), keep position
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}
void fragment() {
	float r = length(UV - 0.5);
	if (r > 0.5) { discard; }
	float c = mod(slot, 45.0);
	float row = floor(slot / 45.0);
	vec3 face = texture(atlas, vec2((c + UV.x) / 45.0, (row + UV.y) / 44.0)).rgb;
	ALBEDO = r > 0.42 ? ring.rgb : face;
}
"""
var _portrait_shader: Shader


func _portrait_material(ring: Color, slot: int) -> ShaderMaterial:
	if _portrait_shader == null:
		_portrait_shader = Shader.new()
		_portrait_shader.code = PORTRAIT_SHADER
	var m := ShaderMaterial.new()
	m.shader = _portrait_shader
	m.set_shader_parameter("atlas", _atlas)
	m.set_shader_parameter("slot", float(slot))
	m.set_shader_parameter("ring", ring)
	return m


func _process(delta: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for i in _tokens.size():
		var s := _tokens[i]
		var goal: Vector3 = s.get_meta("goal")
		if s.position.distance_to(goal) < 0.05 and randf() < delta * 0.25 and not _spots.is_empty():
			# wander to another spot now and then
			var sp: Vector3 = _spots[randi() % _spots.size()]
			goal = sp + Vector3(randf_range(-0.8, 0.8), 0.75, randf_range(-0.8, 0.8))
			s.set_meta("goal", goal)
		var flat := s.position.move_toward(Vector3(goal.x, s.position.y, goal.z), delta * 1.6)
		var ph: float = s.get_meta("phase")
		flat.y = goal.y + absf(sin(t * 5.0 + ph)) * 0.18
		s.position = flat


func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		exit_interior()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			var best := -1
			var best_d := 30.0 * 30.0
			for i in _tokens.size():
				var wp := _tokens[i].global_position
				if _camera.is_position_behind(wp):
					continue
				var d := _camera.unproject_position(wp).distance_squared_to(mb.position)
				if d < best_d:
					best_d = d
					best = i
			if best >= 0:
				GameState.select(_token_ids[best])
			get_viewport().set_input_as_handled()


func _load_story(id: int) -> void:
	var data = await Api.get_json("/api/v2/building/%d" % id)
	if not active or _building_id != id:
		return
	if not (data is Dictionary) or not data.has("story"):
		_story.text = "[color=#ff8080]The door is locked (server unreachable).[/color]"
		return
	var lines := PackedStringArray()
	lines.append(str(data["story"]))
	lines.append("")
	lines.append("[color=#9fd8ff]%d Chogs here[/color]" % int(data.get("count", 0)))
	var recent: Array = data.get("recent", [])
	if not recent.is_empty():
		lines.append("")
		lines.append("[color=#a49bc9]Overheard[/color]")
		for r in recent.slice(0, 3):
			lines.append("[b]%s[/b]: \"%s\"" % [str(r["name"]), str(r["text"]).replace("[", "[lb]")])
	_story.text = "\n".join(lines)
	for k in (data.get("keepers", []) as Array).slice(0, 14):
		var btn := Button.new()
		btn.text = "%s  ·  %s" % [str(k["name"]), str(k["title"]) if str(k["title"]) != "" else str(k["job"])]
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.flat = true
		var cid := int(k["id"])
		btn.pressed.connect(func(): GameState.select(cid))
		_people.add_child(btn)


func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 5
	_ui.visible = false
	add_child(_ui)
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.12, 0.9)
	sb.border_color = Color("#e8b84a")
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(14)
	panel.add_theme_stylebox_override("panel", sb)
	panel.position = Vector2(12, 90)
	panel.custom_minimum_size = Vector2(410, 0)
	_ui.add_child(panel)
	var outer := ScrollContainer.new()
	outer.custom_minimum_size = Vector2(400, 500)
	outer.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(outer)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	outer.add_child(v)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", Color("#ffe9b0"))
	v.add_child(_title)
	_sub = Label.new()
	_sub.add_theme_color_override("font_color", Color("#a49bc9"))
	v.add_child(_sub)
	_story = RichTextLabel.new()
	_story.bbcode_enabled = true
	_story.fit_content = true
	_story.custom_minimum_size = Vector2(380, 0)
	v.add_child(_story)
	var people_title := Label.new()
	people_title.text = "WHO WORKS HERE"
	people_title.add_theme_color_override("font_color", Color("#9fd8ff"))
	people_title.add_theme_font_size_override("font_size", 12)
	v.add_child(people_title)
	_people = VBoxContainer.new()
	_people.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(_people)
	var back := Button.new()
	back.text = "<  Back to Monadia   (Esc)"
	back.pressed.connect(exit_interior)
	back.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM, Control.PRESET_MODE_MINSIZE, 24)
	_ui.add_child(back)
