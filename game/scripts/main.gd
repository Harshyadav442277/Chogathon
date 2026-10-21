extends Node3D
## Root of the Monadia client: environment, terrain, water, settlements, Chog swarm, camera, HUD.

var terrain: Terrain
## Renders the Chogs. Default: ChogSwarm (portrait tokens). If res://scripts/characters/characters.gd
## exists it is used instead (see docs/WORKSPLIT.md for the contract: terrain, pick, id_at, position_of).
var swarm: Node3D
const CHARACTERS_SCRIPT := "res://scripts/characters/characters.gd"
var rig: CameraRig
var towns: Settlements
var interiors: Interiors


func _ready() -> void:
	_build_environment()
	terrain = Terrain.new()
	add_child(terrain)
	_build_water()
	towns = Settlements.new()
	towns.terrain = terrain
	add_child(towns)
	towns.build(GameState.world)
	if ResourceLoader.exists(CHARACTERS_SCRIPT) and not OS.get_cmdline_user_args().has("--tokens"):
		swarm = (load(CHARACTERS_SCRIPT) as GDScript).new()
	else:
		swarm = ChogSwarm.new()
	swarm.set("terrain", terrain)
	add_child(swarm)
	rig = CameraRig.new()
	add_child(rig)
	rig.clicked.connect(_on_click)
	interiors = Interiors.new()
	interiors.world_rig = rig
	add_child(interiors)
	add_child(Hud.new())
	GameState.selection_changed.connect(_on_selected)
	if not GameState.positions.is_empty():
		GameState.positions_updated.emit()
	_maybe_screenshot()


## Dev helper: `godot --path game -- --shot=out.png` renders for a few seconds, saves a screenshot, quits.
func _maybe_screenshot() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--look="):  # --look=x,z,distance[,pitch_deg,yaw_deg]
			var v := arg.trim_prefix("--look=").split(",")
			rig.position = Vector3(float(v[0]), 0, float(v[1]))
			rig.dist = float(v[2])
			if v.size() > 3:
				rig.pitch = deg_to_rad(float(v[3]))
			if v.size() > 4:
				rig.yaw = deg_to_rad(float(v[4]))
			rig._apply()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--click="):  # dev: simulate a click at screen x,y (tests the real picking path)
			await get_tree().create_timer(3.0).timeout
			var c := arg.trim_prefix("--click=").split(",")
			_on_click(Vector2(float(c[0]), float(c[1])))
		if arg.begins_with("--enter="):  # dev: open a building interior by index
			await get_tree().create_timer(2.0).timeout
			interiors.enter(int(arg.trim_prefix("--enter=")))
	if OS.get_cmdline_user_args().has("--perf"):  # dev: print frame stats after warm-up
		await get_tree().create_timer(6.0).timeout
		var rs := RenderingServer
		print("CAM pos=%s rig=%s dist=%.0f selected=%d" % [rig.camera.global_position, rig.global_position, rig.dist, GameState.selected])
		print("PERF fps=%d draw_calls=%d primitives=%d objects=%d" % [Engine.get_frames_per_second(),
			rs.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
			rs.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
			rs.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)])
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shot="):
			await get_tree().create_timer(6.0).timeout
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(arg.trim_prefix("--shot="))
			get_tree().quit()


func _build_environment() -> void:
	var hour: int = Time.get_datetime_dict_from_system(true)["hour"]
	var night: bool = hour < 5 or hour >= 20
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#1b1640") if night else Color("#5d9ce6")
	sky_mat.sky_horizon_color = Color("#3a2f6b") if night else Color("#cfe2f7")
	sky_mat.ground_horizon_color = sky_mat.sky_horizon_color
	sky_mat.ground_bottom_color = Color("#120f24")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.sky = sky
	# Fixed ambient color: the bright sky as ambient source washed the low-poly colors out to white.
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#6f78b8") if night else Color("#b9c6e6")
	env.ambient_light_energy = 0.4 if night else 0.75
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED  # no sky glare on matte low-poly
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	# Light haze only at the horizon: the continent is ~900 units wide, so dense fog washes everything out.
	env.fog_enabled = true
	env.fog_light_color = sky_mat.sky_horizon_color
	env.fog_density = 0.00012
	env.fog_sky_affect = 0.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -35, 0)
	sun.light_energy = 0.5 if night else 1.1
	sun.light_color = Color("#9fb2ff") if night else Color("#fff1dc")
	# Directional shadows over-brighten lit surfaces in the Compatibility renderer here, and cost a lot on the web: off.
	sun.shadow_enabled = false
	for arg in OS.get_cmdline_user_args():  # dev lighting overrides: --sun=0.5 --amb=0.3 --tonemap=linear --shadows=on
		if arg.begins_with("--sun="): sun.light_energy = float(arg.get_slice("=", 1))
		if arg.begins_with("--amb="): env.ambient_light_energy = float(arg.get_slice("=", 1))
		if arg == "--tonemap=linear": env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
		if arg == "--shadows=on": sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 700.0
	add_child(sun)


func _build_water() -> void:
	var water := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(3200, 2800)
	water.mesh = plane
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/water.gdshader")
	water.material_override = mat
	water.position.y = 0.05
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water)


func _on_click(screen_pos: Vector2) -> void:
	var i: int = swarm.call("pick", rig.camera, screen_pos)
	if i >= 0:
		GameState.select(swarm.call("id_at", i))
		return
	# No Chog under the cursor: step inside an enterable building (tavern, guild, smithy, castle...).
	var b := towns.pick_building(rig.camera, screen_pos)
	if b >= 0:
		interiors.enter(b)
	else:
		GameState.select(-1)


func _on_selected(chog_id: int) -> void:
	if chog_id >= 0:
		rig.fly_to(swarm.call("position_of", chog_id), 45.0)
