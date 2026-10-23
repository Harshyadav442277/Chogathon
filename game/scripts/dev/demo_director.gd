class_name DemoDirector
extends Node
## Dev-only: drives a scripted tour of the real game for the demo video. Run with Godot's Movie Maker, e.g.
##   godot --path game --write-movie out.avi --fixed-fps 30 -- --api=https://chogsekai.vercel.app --demo=fly
## Scenes: fly (the world), chog (a Chog's Status + Life Story), pulls (judge sign-in, a Star Pull, bestow; needs
## --judge=<code>), chronicle (the Monadia Cycle). A drawn cursor shows where the "clicks" go. Not part of the game.

var main: Node3D
var hud: Hud
var rig: CameraRig
var _cursor: Cursor
const CHOG := 681


func run(scene: String) -> void:
	# Bigger UI for 1080p video: lay the UI out in a smaller virtual size and scale it up (the 3D view stays full resolution).
	var win := get_window()
	win.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	win.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_KEEP
	win.content_scale_size = Vector2i(1480, 832)
	_cursor = Cursor.new()
	add_child(_cursor)
	_cursor.position = Vector2(1500, 520)
	await _wait(2.5)  # the world loads and the first Chogs appear
	match scene:
		"fly": await _fly()
		"chog": await _chog()
		"pulls": await _pulls()
		"chronicle": await _chronicle()
	await _wait(0.5)
	get_tree().quit()


## Print the movie time of a key moment so the video tools can lock overlays onto it (see video/make_overlays.py).
func _mark(name: String) -> void:
	print("MARK %s %.2f" % [name, Engine.get_frames_drawn() / 30.0])


func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout


## Smooth camera move (ease in-out) over `dur` seconds.
func _cam(pos: Vector3, dist: float, yaw_deg: float, pitch_deg: float, dur: float) -> void:
	var p0 := rig.position
	var d0 := rig.dist
	var y0 := rig.yaw
	var t0 := rig.pitch
	var y1 := deg_to_rad(yaw_deg)
	var t1 := deg_to_rad(pitch_deg)
	rig._goal = null
	var tw := create_tween()
	tw.tween_method(func(k: float):
		var e := smoothstep(0.0, 1.0, k)
		rig.position = p0.lerp(pos, e)
		rig.dist = lerpf(d0, dist, e)
		rig.yaw = lerpf(y0, y1, e)
		rig.pitch = lerpf(t0, t1, e)
		rig._apply(), 0.0, 1.0, dur)
	await tw.finished


func _fly() -> void:
	rig.position = Vector3(0, 0, 10)
	rig.dist = 460.0
	rig.yaw = deg_to_rad(-20)
	rig.pitch = deg_to_rad(56)
	rig._apply()
	await _wait(1.0)
	_mark("cam_capital")
	await _cam(Vector3(0, 0, 12), 150, 20, 44, 6.0)       # down into the Hive Capital
	_mark("cam_emberforge")
	await _cam(Vector3(-205, 0, -95), 125, 50, 40, 5.5)   # Emberforge Peaks
	_mark("cam_tidecry")
	await _cam(Vector3(-195, 0, 150), 120, -15, 36, 5.5)  # Tidecry Coast
	_mark("cam_prism")
	await _cam(Vector3(205, 0, -95), 130, 75, 42, 5.5)    # Prism Expanse
	_mark("cam_hollow")
	await _cam(Vector3(0, 0, -150), 170, 110, 46, 5.0)    # towards the Hollow and the demon realm
	_mark("end")


func _wait_for(cond: Callable, timeout := 20.0) -> bool:
	var t := 0.0
	while t < timeout:
		if cond.call():
			return true
		await get_tree().create_timer(0.2).timeout
		t += 0.2
	return false


func _chog() -> void:
	GameState.select(CHOG)
	var pos: Vector3 = main.swarm.call("position_of", CHOG)
	await _cam(Vector3(pos.x, 0, pos.z), 60, 25, 40, 4.5)
	await _wait_for(func(): return not hud._life_btn.disabled)
	_mark("panel_ready")
	await _wait(3.5)  # the NFT picture, the stats, the skills
	await _cursor.click_control(hud._life_btn)
	_mark("life_open")
	await _wait(1.5)
	_mark("scroll_start")
	var sb: ScrollBar = hud._life_text_label.get_v_scroll_bar()
	var tw := create_tween()
	tw.tween_property(sb, "value", minf(sb.max_value, 1900.0), 17.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await tw.finished
	_mark("scroll_end")
	await _wait(1.0)


func _judge_code() -> String:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--judge="):
			return arg.trim_prefix("--judge=")
	return ""


func _pulls() -> void:
	GameState.select(CHOG)
	var pos: Vector3 = main.swarm.call("position_of", CHOG)
	await _cam(Vector3(pos.x, 0, pos.z), 90, 25, 44, 2.0)
	await _cursor.click_control(hud._btn_pull)
	_mark("window_open")
	await _wait(1.4)
	if hud._signin.visible:  # signed out: type the judge code (shown as dots) and sign in
		await _cursor.move_to_control(hud._judge_code)
		await _cursor.click_at(hud._judge_code.get_global_rect().get_center())
		_mark("typing")
		for ch in _judge_code():
			hud._judge_code.text += ch
			await _wait(0.09)
		await _wait(0.5)
		_mark("signin_click")
		await _cursor.click_control(hud._btn_judge)
		await _wait_for(func(): return not hud._signin.visible)
		_mark("signed_in")
		await _wait(1.6)
	# Pull, if one is waiting (a retake finds the offers already on the table).
	var first: Node = hud._offers.get_child(0) if hud._offers.get_child_count() > 0 else null
	if first is Button and (first as Button).text.contains("PULL"):
		_mark("pull_click")
		await _cursor.click_control(first as Button)
		await _wait_for(func(): return hud._offers.get_child_count() >= 4)
		_mark("cards_flip")
		await _wait(3.0)  # the cards flip in
	else:
		await _wait(1.5)
	if hud._offers.get_child_count() >= 3 and not (hud._offers.get_child(0) is Label):
		for i in hud._gacha_target.item_count:
			if int(hud._gacha_target.get_item_metadata(i)) == CHOG:
				hud._gacha_target.select(i)
		var card: Button = hud._offers.get_child(2) as Button  # a quest card
		_mark("card_click")
		await _cursor.click_control(card)
		await _wait(1.2)
		_mark("bestow_click")
		await _cursor.click_control(hud._gacha_btn)
		await _wait(4.0)  # "Bestowed", the slot turns gold
		_mark("bestowed")


func _chronicle() -> void:
	await _cursor.click_control(hud._btn_novel)
	_mark("chronicle_open")
	await _wait_for(func(): return not hud._novel_text.text.begins_with("Opening"))
	await _wait(2.5)
	_mark("scroll_start")
	var sb: ScrollBar = hud._novel_text.get_v_scroll_bar()
	var tw := create_tween()
	tw.tween_property(sb, "value", minf(sb.max_value, 2700.0), 27.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await tw.finished
	_mark("scroll_end")
	await _wait(1.0)


## A drawn mouse pointer with a click ripple, so the "clicks" of a scripted tour are visible.
class Cursor extends CanvasLayer:
	var _node: Control
	var position: Vector2:
		get: return _node.position if _node else Vector2.ZERO
		set(v):
			if _node:
				_node.position = v
	var _ripple := 0.0

	func _init() -> void:
		layer = 100
		_node = Control.new()
		_node.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_node.draw.connect(_draw_cursor)
		add_child(_node)

	func _draw_cursor() -> void:
		if _ripple > 0.0:
			var r := 8.0 + 34.0 * (1.0 - _ripple)
			_node.draw_arc(Vector2.ZERO, r, 0.0, TAU, 40, Color(1, 0.85, 0.3, _ripple), 3.0, true)
		var pts := PackedVector2Array([Vector2(0, 0), Vector2(0, 22), Vector2(5.5, 17), Vector2(9.5, 26), Vector2(13.5, 24.2), Vector2(9.6, 15.4), Vector2(17, 15)])
		_node.draw_colored_polygon(pts, Color.WHITE)
		var closed := pts.duplicate()
		closed.append(pts[0])
		_node.draw_polyline(closed, Color(0, 0, 0, 0.95), 1.8, true)

	func move_to(target: Vector2, dur := 0.7) -> void:
		var tw := create_tween()
		tw.tween_property(_node, "position", target, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
		await tw.finished

	func move_to_control(c: Control) -> void:
		await move_to(c.get_global_rect().get_center() + Vector2(6, 4))

	func click_at(_p: Vector2) -> void:
		_ripple = 1.0
		var tw := create_tween()
		tw.tween_method(func(v: float):
			_ripple = v
			_node.queue_redraw(), 1.0, 0.0, 0.4)
		await tw.finished

	## Move to a control, ripple, and press it.
	func click_control(c: Control) -> void:
		await move_to_control(c)
		_node.queue_redraw()
		var ripple := create_tween()
		_ripple = 1.0
		ripple.tween_method(func(v: float):
			_ripple = v
			_node.queue_redraw(), 1.0, 0.0, 0.4)
		if c is BaseButton:
			(c as BaseButton).pressed.emit()
		await ripple.finished
