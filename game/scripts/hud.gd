class_name Hud
extends CanvasLayer
## Top bar, season bar, help line, Star Stream and the Status Window (with the Constellation powers).
## Built in code so the layout survives any resolution.

var _info: Label
var _panel: PanelContainer
var _title: Label
var _body: RichTextLabel
var _stream: RichTextLabel
var _season: RichTextLabel
var _agent: RichTextLabel
var _gift_box: VBoxContainer
var _skill_pick: OptionButton
var _quest_pick: OptionButton
var _gift_msg: Label
var _library := {}


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
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(340, 520)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	var inner := VBoxContainer.new()
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inner)
	_agent = _rich(inner)
	_body = _rich(inner)
	_build_gifts(inner)

	var season_panel := PanelContainer.new()
	season_panel.add_theme_stylebox_override("panel", _box(Color(0.1, 0.03, 0.08, 0.82), Color("#ff6b8b")))
	season_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_KEEP_SIZE, 12)
	season_panel.custom_minimum_size = Vector2(520, 0)
	season_panel.offset_left = -260
	season_panel.offset_right = 260
	add_child(season_panel)
	_season = RichTextLabel.new()
	_season.bbcode_enabled = true
	_season.fit_content = true
	_season.scroll_active = false
	_season.custom_minimum_size = Vector2(500, 0)
	_season.add_theme_font_size_override("normal_font_size", 12)
	_season.text = "Reading the season..."
	season_panel.add_child(_season)

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
	t.timeout.connect(_refresh_season)
	add_child(t)
	t.start()
	_refresh_stream()
	_refresh_season()

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


func _rich(parent: Control) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.custom_minimum_size = Vector2(320, 0)
	parent.add_child(r)
	return r


## A text progress bar: [■■■■■□□□□□].
func _bar(frac: float, width := 16, col := "#8ef0c4") -> String:
	var n := clampi(int(round(frac * width)), 0, width)
	return "[color=%s]%s[/color][color=#3a3550]%s[/color]" % [col, "|".repeat(n), "|".repeat(width - n)]


const PHASE_COL := ["#a49bc9", "#9fd8ff", "#ffb84d", "#ff6b8b", "#ffd166"]


## Season bar: phase, clock, seals, the Demon King's HP, raids and the top hero candidates.
func _refresh_season() -> void:
	var d = await Api.get_json_if_changed("/api/v2/season")
	if not (d is Dictionary):
		return
	var phase := int(d.get("phase", 0))
	var lines := PackedStringArray()
	lines.append("[b][color=%s]SEASON %d · %s[/color][/b]   %s %d%%" % [PHASE_COL[clampi(phase, 0, 4)], int(d.get("season", 0)), str(d.get("phaseName", "")).to_upper(),
		_bar(float(d.get("progress", 0.0)), 14, "#a49bc9"), int(round(float(d.get("progress", 0.0)) * 100.0))])
	var seals := PackedStringArray()
	for g in d.get("generals", []):
		var gd: Dictionary = g
		seals.append(("[color=#7a7a8a][s]%s[/s][/color]" if gd["down"] else "[color=#ff8fa3]%s[/color] %d%%") % ([str(gd["region"]).capitalize()] if gd["down"] else [str(gd["region"]).capitalize(), int(100.0 * float(gd["hp"]) / maxf(1.0, float(gd["max"])))]))
	lines.append("Seals %d/4   %s" % [int(d.get("seals", 0)), "  ".join(seals)])
	var king = d.get("king")
	if king is Dictionary:
		var kf := float(king["hp"]) / maxf(1.0, float(king["max"]))
		lines.append("[color=#ff6b8b]Demon King[/color] %s  %s %d%%%s" % [str(king["name"]), _bar(kf, 20, "#ff3b5c"), int(round(kf * 100.0)),
			"   [color=#ffd166]LAST STAND x3[/color]" if d.get("lastStand", false) else ""])
	var hero = d.get("hero")
	if hero is Dictionary:
		lines.append("[color=#ffd166][b]HERO: %s[/b][/color]" % str(hero["name"]))
	elif d.get("raid") is Dictionary:
		lines.append("[color=#ffb84d]Raid in progress: %d demons attacking[/color]" % int(d["raid"]["raiders"]))
	var cands := PackedStringArray()
	for c in (d.get("candidates", []) as Array).slice(0, 3):
		cands.append("%s (%s, Lv %d)" % [str(c["name"]), str(c["job"]).replace("_", " "), int(c["level"])])
	if not cands.is_empty():
		lines.append("[color=#a49bc9]Hero candidates:[/color] %s" % ", ".join(cands))
	_season.text = "\n".join(lines)


func _build_gifts(parent: Control) -> void:
	_gift_box = VBoxContainer.new()
	parent.add_child(_gift_box)
	var t := Label.new()
	t.text = "CONSTELLATION POWERS (holders: 3 Star Points a day, any Chog)"
	t.add_theme_font_size_override("font_size", 11)
	t.add_theme_color_override("font_color", Color("#c9a7ff"))
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_gift_box.add_child(t)
	var r1 := HBoxContainer.new()
	_gift_box.add_child(r1)
	_skill_pick = OptionButton.new()
	_skill_pick.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_skill_pick.clip_text = true
	_skill_pick.fit_to_longest_item = false  # long names would widen the panel off-screen
	_skill_pick.custom_minimum_size = Vector2(220, 0)
	r1.add_child(_skill_pick)
	var b1 := Button.new()
	b1.text = "Grant skill"
	b1.pressed.connect(func(): _gift("skill", _skill_pick))
	r1.add_child(b1)
	var r2 := HBoxContainer.new()
	_gift_box.add_child(r2)
	_quest_pick = OptionButton.new()
	_quest_pick.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_quest_pick.clip_text = true
	_quest_pick.fit_to_longest_item = false  # long names would widen the panel off-screen
	_quest_pick.custom_minimum_size = Vector2(220, 0)
	r2.add_child(_quest_pick)
	var b2 := Button.new()
	b2.text = "Give quest"
	b2.pressed.connect(func(): _gift("quest", _quest_pick))
	r2.add_child(b2)
	_gift_msg = Label.new()
	_gift_msg.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_gift_msg.add_theme_font_size_override("font_size", 11)
	_gift_msg.add_theme_color_override("font_color", Color("#a49bc9"))
	_gift_box.add_child(_gift_msg)


func _load_library() -> void:
	if not _library.is_empty():
		return
	var d = await Api.get_json("/api/v2/library")
	if not (d is Dictionary):
		return
	_library = d
	for k in d.get("skills", []):
		_skill_pick.add_item("%s [%s] %s" % [str(k["name"]), str(k["rank"]), str(k["school"])])
		_skill_pick.set_item_metadata(_skill_pick.item_count - 1, str(k["id"]))
	for q in d.get("quests", []):
		_quest_pick.add_item("T%d %s (%s)" % [int(q["tier"]), str(q["name"]), "/".join(q["tags"])])
		_quest_pick.set_item_metadata(_quest_pick.item_count - 1, str(q["id"]))


func _refresh_budget() -> void:
	var d = await Api.get_json("/api/v2/gift")
	if not (d is Dictionary):
		return
	if not d.get("signedIn", false):
		_gift_msg.text = "Connect a wallet that holds a Chog (on the website, same page) to use Star Points. Stargazers can watch everything."
	elif not d.get("holder", false):
		_gift_msg.text = "This wallet holds no Chog: you're a Stargazer (watch only)."
	else:
		_gift_msg.text = "Star Points today: %d / %d used." % [int(d.get("used", 0)), int(d.get("limit", 3))]


func _gift(kind: String, pick: OptionButton) -> void:
	if GameState.selected < 0 or pick.selected < 0:
		return
	var r := await Api.post_json("/api/v2/gift", {"kind": kind, "chogId": GameState.selected, "ref": str(pick.get_item_metadata(pick.selected))})
	var data = r.get("data")
	if data is Dictionary:
		_gift_msg.text = str(data.get("message", data.get("error", "")))
	else:
		_gift_msg.text = "The stars are silent (HTTP %d)." % int(r.get("status", 0))


## Live agent section of the Status Window: what this Chog is doing right now in the season simulation.
func _agent_text(a: Dictionary) -> String:
	var lines := PackedStringArray()
	var state := str(a.get("state", ""))
	var verbs := {"work": "Working", "idle": "Wandering", "quest": "On a quest", "fight": "Fighting", "rest": "Recovering", "raid": "Raiding"}
	lines.append("[b]%s[/b] at %s" % [verbs.get(state, state.capitalize()), str(a.get("place", "?"))])
	var hp := float(a.get("hp", 0))
	var mhp := maxf(1.0, float(a.get("maxhp", 1)))
	lines.append("HP %s %d/%d   XP %s %d/%d" % [_bar(hp / mhp, 10, "#ff8fa3"), int(hp), int(mhp), _bar(float(a.get("xp", 0)) / maxf(1.0, float(a.get("xpNext", 1))), 10, "#9fd8ff"), int(a.get("xp", 0)), int(a.get("xpNext", 0))])
	lines.append("Level %d   Story %d   Kills %d   Gold %d" % [int(a.get("level", 1)), int(a.get("story", 0)), int(a.get("kills", 0)), int(a.get("gold", 0))])
	var q = a.get("quest")
	if q is Dictionary:
		lines.append("")
		lines.append("[color=#ffd166]Quest:[/color] %s%s" % [str(q["name"]), "  [color=#c9a7ff](from the stars)[/color]" if q.get("fromStars", false) else ""])
		lines.append("%s %d%%   ~%d ticks with these skills" % [_bar(float(q["pct"]) / 100.0, 18), int(q["pct"]), int(q["expectedTicks"])])
	var skills: Array = a.get("skills", [])
	lines.append("")
	lines.append("[color=#9fd8ff]Skills (%d/6):[/color] %s" % [skills.size(), ", ".join(PackedStringArray(skills.map(func(k): return "%s [%s]" % [k["name"], k["rank"]]))) if not skills.is_empty() else "none yet"])
	var log: Array = a.get("log", [])
	if not log.is_empty():
		lines.append("")
		lines.append("[color=#a49bc9]Recently[/color]")
		for l in log.slice(0, 4):
			lines.append("· " + str(l).get_slice(": ", 1) if str(l).contains(": ") else "· " + str(l))
	return "\n".join(lines)


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
	_agent.text = ""
	_load_library()
	_refresh_budget()
	var data = await Api.get_json("/api/chog/%d" % chog_id)
	if GameState.selected != chog_id:
		return
	if not (data is Dictionary) or not data.has("chog"):
		_body.text = "[color=#ff8080]Could not read this Chog.[/color]"
		return
	var c: Dictionary = data["chog"]
	if data.get("agent") is Dictionary:
		_agent.text = _agent_text(data["agent"])
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
