extends Node
## Dev frame profiler: `-- --profile[=seconds]`. Turns vsync off (so fps isn't snapped to 60/30), warms up,
## then records every frame and prints one report: frame time avg/p95/max, CPU (process) and GPU render time,
## draw calls, primitives, and frames over budget (hitches). Optional `--profile-pan` moves the camera
## during the run to exercise LOD streaming. Prints lines prefixed "PROF".

const WARMUP := 8.0

var _secs := 10.0
var _frames := PackedFloat32Array()
var _cpu := PackedFloat32Array()
var _gpu := PackedFloat32Array()
var _proc := PackedFloat32Array()
var _draws := 0
var _prims := 0
var _t := 0.0
var _recording := false
var _pan := false
var _vp: RID
var _spikes: Array[String] = []
var _hide := PackedStringArray()  # --hide=terrain,cover,buildings,props,labels,roads,water,chogs (subtractive profiling)
var _hide_tick := 0.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--profile="):
			_secs = float(a.trim_prefix("--profile="))
		if a.begins_with("--hide="):
			_hide = a.trim_prefix("--hide=").split(",")
		if a.begins_with("--scale3d="):  # dev: test a fixed 3D render scale
			get_viewport().scaling_3d_scale = float(a.trim_prefix("--scale3d="))
	_pan = OS.get_cmdline_user_args().has("--profile-pan")
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	_vp = get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(_vp, true)
	process_priority = 1000  # run after everything else


func _process(delta: float) -> void:
	_t += delta
	_hide_tick -= delta
	if not _hide.is_empty() and _hide_tick <= 0.0:
		_hide_tick = 0.5
		_apply_hide()
	if not _recording:
		if _t >= WARMUP:
			_recording = true
			_t = 0.0
		return
	_frames.append(delta * 1000.0)
	var js := FrameJobs.instance.take_stats() if FrameJobs.instance else Vector2i.ZERO
	if delta * 1000.0 > 33.4 and _spikes.size() < 12:
		_spikes.append("%.0fms(jobs %d/%.1fms gpu %.1f)" % [delta * 1000.0, js.x, js.y / 1000.0, RenderingServer.viewport_get_measured_render_time_gpu(_vp)])
	_cpu.append(RenderingServer.viewport_get_measured_render_time_cpu(_vp) + RenderingServer.get_frame_setup_time_cpu())
	_gpu.append(RenderingServer.viewport_get_measured_render_time_gpu(_vp))
	_proc.append(Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0)
	_draws = maxi(_draws, int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
	_prims = maxi(_prims, int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)))
	if _pan:
		var rig := get_parent().get("rig") as Node3D
		if rig:
			rig.position += Vector3(60.0, 0, 25.0) * delta
			rig.call("_apply")
	if _t >= _secs:
		_report()
		get_tree().quit()


func _report() -> void:
	var f := _sorted(_frames)
	var n := f.size()
	var over := 0
	for v in _frames:
		if v > 33.4:
			over += 1
	print("PROF frames=%d avg=%.2fms p95=%.2fms max=%.2fms fps=%.1f hitches(>33ms)=%d" % [n, _avg(_frames), f[int(n * 0.95)], f[n - 1], 1000.0 / _avg(_frames), over])
	if not _spikes.is_empty():
		print("PROF spikes: ", ", ".join(_spikes))
	print("PROF process(scripts)=%.2fms render_cpu=%.2fms gpu=%.2fms draws<=%d prims<=%d" % [_avg(_proc), _avg(_cpu), _avg(_gpu), _draws, _prims])


func _avg(a: PackedFloat32Array) -> float:
	var s := 0.0
	for v in a:
		s += v
	return s / maxf(1.0, a.size())


func _sorted(a: PackedFloat32Array) -> PackedFloat32Array:
	var b := a.duplicate()
	b.sort()
	return b


## Takes whole systems out of rendering (visual layers = 0, which the LOD code never touches).
func _apply_hide() -> void:
	var main := get_parent()
	var groups := {}
	var terrain := main.get("terrain") as Node
	var towns := main.get("towns") as Node
	if terrain:
		for c in terrain.get_children():
			groups[c] = "terrain" if c is MeshInstance3D else "cover"
	if towns:
		for c in towns.get_children():
			groups[c] = c.get_meta("group") if c.has_meta("group") else ("labels" if c is Label3D else ("roads" if c is MeshInstance3D else "other"))
	for c in main.get_children():
		if c is MeshInstance3D and (c as MeshInstance3D).mesh is PlaneMesh:
			groups[c] = "water"
	var sw := main.get("swarm") as Node
	if sw:
		groups[sw] = "chogs"
	for n in groups:
		if _hide.has(groups[n]):
			_layers_off(n)


func _layers_off(n: Node) -> void:
	if n is VisualInstance3D:
		(n as VisualInstance3D).layers = 0
	for c in n.get_children():
		_layers_off(c)
