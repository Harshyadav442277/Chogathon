class_name Hud
extends CanvasLayer
## Top bar, help line and the Status Window. Built in code so the layout survives any resolution.

var _info: Label
var _panel: PanelContainer
var _title: Label
var _body: RichTextLabel
var _stream: RichTextLabel


func _ready() -> void:
	var top := PanelContainer.new()
	top.position = Vector2(12, 12)
	top.add_theme_stylebox_override("panel", _box(Color(0.07, 0.06, 0.14, 0.82), Color(0.66, 0.48, 1.0)))
	add_child(top)
	var col := VBoxContainer.new()
	top.add_child(col)
	var brand := Label.new()
	brand.text = "MONADIA"
	brand.add_theme_font_size_override("font_size", 20)
	brand.add_theme_color_override("font_color", Color("#e9dcff"))
	col.add_child(brand)
	_info = Label.new()
	_info.text = "Summoning the world..."
	_info.add_theme_font_size_override("font_size", 13)
	_info.add_theme_color_override("font_color", Color("#a49bc9"))
	col.add_child(_info)

	var help := Label.new()
	help.text = "Drag: pan    Right-drag: rotate    Wheel/pinch: zoom    Click a Chog: Status Window"
	help.add_theme_font_size_override("font_size", 12)
	help.add_theme_color_override("font_color", Color(1, 1, 1, 0.7))
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_MINSIZE, 12)
	add_child(help)

	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", _box(Color(0.06, 0.12, 0.3, 0.93), Color("#4dabf7")))
	_panel.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE, Control.PRESET_MODE_KEEP_SIZE, 12)
	_panel.custom_minimum_size = Vector2(360, 0)
	_panel.offset_left = -372
	_panel.visible = false
	add_child(_panel)
	var v := VBoxContainer.new()
	_panel.add_child(v)
	var head := HBoxContainer.new()
	v.add_child(head)
	var tag := Label.new()
	tag.text = "[ STATUS ]"
	tag.add_theme_color_override("font_color", Color("#9fd8ff"))
	tag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(tag)
	var close := Button.new()
	close.text = "X"
	close.flat = true
	close.pressed.connect(func(): GameState.select(-1))
	head.add_child(close)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 20)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_title)
	_body = RichTextLabel.new()
	_body.bbcode_enabled = true
	_body.fit_content = true
	_body.scroll_active = false
	_body.custom_minimum_size = Vector2(340, 0)
	v.add_child(_body)

	var stream_panel := PanelContainer.new()
	stream_panel.add_theme_stylebox_override("panel", _box(Color(0.05, 0.04, 0.11, 0.8), Color(0.66, 0.48, 1.0, 0.6)))
	stream_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_KEEP_SIZE, 12)
	stream_panel.custom_minimum_size = Vector2(460, 210)
	stream_panel.offset_top = -250
	stream_panel.offset_bottom = -36
	stream_panel.offset_right = 472
	add_child(stream_panel)
	var sv := VBoxContainer.new()
	stream_panel.add_child(sv)
	var st := Label.new()
	st.text = "STAR STREAM"
	st.add_theme_color_override("font_color", Color("#c9a7ff"))
	st.add_theme_font_size_override("font_size", 13)
	sv.add_child(st)
	_stream = RichTextLabel.new()
	_stream.bbcode_enabled = true
	_stream.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_stream.scroll_active = true
	_stream.add_theme_font_size_override("normal_font_size", 12)
	sv.add_child(_stream)
	var t := Timer.new()
	t.wait_time = 10.0
	t.timeout.connect(_refresh_stream)
	add_child(t)
	t.start()
	_refresh_stream()

	GameState.positions_updated.connect(_on_positions)
	GameState.selection_changed.connect(_on_selected)


const STREAM_COLORS := {"system": "#ffd166", "constellation": "#c9a7ff", "meme": "#8ef0c4", "event": "#9fd8ff", "question": "#ffb84d"}


func _refresh_stream() -> void:
	var data = await Api.get_json_if_changed("/api/v2/stream")
	if not (data is Dictionary) or not data.has("lines"):
		return
	var out := PackedStringArray()
	for line in (data["lines"] as Array).slice(0, 14):
		var col: String = STREAM_COLORS.get(str(line.get("kind", "")), "#ffffff")
		out.append("[color=%s]%s[/color]" % [col, str(line.get("text", "")).replace("[", "[lb]")])
	_stream.text = "\n".join(out)


func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.border_color = border
	b.set_border_width_all(1)
	b.set_corner_radius_all(12)
	b.set_content_margin_all(12)
	return b


func _on_positions() -> void:
	var p := GameState.positions
	var now := Time.get_datetime_dict_from_system(true)
	_info.text = "%02d:%02d UTC   Season %d   tick %d   %d Chogs alive" % [now.hour, now.minute, int(p.get("season", 0)), int(p.get("tick", 0)), (p.get("ids", []) as Array).size()]


func _on_selected(chog_id: int) -> void:
	if chog_id < 0:
		_panel.visible = false
		return
	_panel.visible = true
	var i := GameState.index_of(chog_id)
	_title.text = str(GameState.positions["names"][i]) if i >= 0 else "Chog #%d" % chog_id
	_body.text = "Reading the Status Window..."
	var data = await Api.get_json("/api/chog/%d" % chog_id)
	if GameState.selected != chog_id:
		return
	if not (data is Dictionary) or not data.has("chog"):
		_body.text = "[color=#ff8080]Could not read this Chog.[/color]"
		return
	var c: Dictionary = data["chog"]
	var persona: Dictionary = c.get("persona", {})
	var house_i := ["laser", "teardrop", "glass", "moonbeam"].find(str(c.get("house", "")))
	var house_name: String = GameState.HOUSE_NAMES[house_i] if house_i >= 0 else str(c.get("house", ""))
	var house_col: String = GameState.HOUSE_COLORS[house_i].to_html(false) if house_i >= 0 else "ffffff"
	var poi_name := "somewhere"
	if i >= 0:
		var pois: Array = GameState.world.get("pois", [])
		var pi := int(GameState.positions["poi"][i])
		if pi >= 0 and pi < pois.size():
			poi_name = str(pois[pi]["name"])
	var lines := PackedStringArray()
	lines.append("[color=#%s]%s[/color]   token #%d" % [house_col, house_name, int(c["id"])])
	lines.append("Location: %s    Mood: %s" % [poi_name, str(c.get("mood", "?"))])
	var season = c.get("season")
	if season is Dictionary:
		lines.append("")
		lines.append("[font_size=18][color=#ffd166]%s[/color][/font_size]  %s · Lv %d · Rank %s" % [season["title"], season["jobName"], int(season["level"]), season["rank"]])
		var st: Dictionary = season["stats"]
		lines.append("[color=#9fd8ff]STR[/color] %d  [color=#9fd8ff]VIT[/color] %d  [color=#9fd8ff]AGI[/color] %d  [color=#9fd8ff]INT[/color] %d  [color=#9fd8ff]WIS[/color] %d  [color=#9fd8ff]LUK[/color] %d" % [int(st["STR"]), int(st["VIT"]), int(st["AGI"]), int(st["INT"]), int(st["WIS"]), int(st["LUK"])])
		lines.append("HP %d · Gold %d · Story %d" % [int(season["hp"]), int(season["gold"]), int(season["story"])])
	lines.append("")
	lines.append("[b]Influence[/b] %.1f (#%d)   [b]Bond[/b] %d   [b]Posts[/b] %d   [b]Followers[/b] %d" % [float(c.get("influence", 0)), int(c.get("rank", 0)), int(c.get("bond", 0)), int(c.get("posts", 0)), int(c.get("followers", 0))])
	lines.append("")
	lines.append("[color=#9fd8ff]Temperament[/color] %s" % persona.get("temperament", "?"))
	lines.append("[color=#9fd8ff]Calling[/color] %s" % persona.get("job", "?"))
	lines.append("[color=#9fd8ff]Obsession[/color] %s" % persona.get("obsession", "?"))
	var mem: Array = c.get("memories", [])
	if not mem.is_empty():
		lines.append("")
		lines.append("[color=#a49bc9]Latest memory[/color]  \"%s\"" % mem[0]["text"])
	var feed: Array = c.get("feed", [])
	if not feed.is_empty():
		lines.append("[color=#a49bc9]Last said[/color]  \"%s\"" % feed[0]["text"])
	_body.text = "\n".join(lines)
