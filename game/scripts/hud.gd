class_name Hud
extends CanvasLayer
## Adventure-style HUD (dark forest green, gold trim, heart containers), kept to the edges so the world stays
## visible: a small season banner (top left), three buttons (top right), a short Star Stream (bottom left) and
## a narrow Status panel (right, only when a Chog is selected). The Daily Pull and the Chronicle open as
## centred windows only when asked for. H hides everything.

const GOLD := Color("#d8b24a")
const CREAM := Color("#f3e9c6")
const DIM := Color("#a89f7e")
const GREEN := Color(0.04, 0.11, 0.07, 0.84)
const STREAM_COLORS := {"system": "#ffd166", "constellation": "#c9a7ff", "meme": "#cfe8b0", "event": "#9fd8ff", "question": "#ffb84d"}
const RANK_COL := {"F": "#9a9a9a", "E": "#7fc96b", "D": "#5aa9e6", "C": "#b07ce8", "B": "#f0a040", "A": "#e85a5a", "S": "#ffd84a"}
const TIER_RANK := ["F", "E", "D", "C", "B", "A", "S"]

var _root: Control
var _info: Label
var _phase: RichTextLabel
var _seals: Seals
var _king: Hearts
var _stream_box: PanelContainer
var _stream: RichTextLabel
var _panel: PanelContainer
var _title: Label
var _sub: RichTextLabel
var _hp: Hearts
var _agent: RichTextLabel
var _life: RichTextLabel
var _life_btn: Button
var _novel: PanelContainer
var _novel_text: RichTextLabel
var _gacha: PanelContainer
var _gacha_cards: GridContainer
var _gacha_info: Label
var _gacha_target: OptionButton
var _gacha_btn: Button
var _gacha_draw: Button
var _gacha_state := {}
var _picked := {}  # {"kind": "skill"|"quest", "ref": id}


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_build_banner()
	_build_buttons()
	_build_stream()
	_build_status()
	_novel = _modal(Vector2(620, 560))
	_novel_text = _modal_body(_novel, "THE MONADIA CYCLE")
	_build_gacha()
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
	# Dev: --open=pull or --open=chronicle opens that window a moment after start (for screenshots).
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--open="):
			await get_tree().create_timer(3.0).timeout
			if arg.ends_with("pull"):
				_toggle_gacha()
			else:
				_toggle_novel()


func _unhandled_key_input(e: InputEvent) -> void:
	var k := e as InputEventKey
	if k and k.pressed and not k.echo and k.keycode == KEY_H:
		_root.visible = not _root.visible


# ---------------------------------------------------------------------------------------------------------
# Building blocks

func _box(bg := GREEN, border := GOLD, w := 2) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.border_color = border
	b.set_border_width_all(w)
	b.set_corner_radius_all(6)
	b.set_content_margin_all(8)
	b.shadow_color = Color(0, 0, 0, 0.35)
	b.shadow_size = 4
	return b


func _label(text: String, size := 13, col := CREAM) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 4)
	return l


func _rich(size := 12, min_w := 0.0) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.custom_minimum_size = Vector2(min_w, 0)
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_font_size_override("bold_font_size", size)
	r.add_theme_font_size_override("italics_font_size", size)
	r.add_theme_color_override("default_color", CREAM)
	r.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	r.add_theme_constant_override("outline_size", 3)
	return r


func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", 13)
	b.add_theme_color_override("font_color", CREAM)
	b.add_theme_color_override("font_hover_color", GOLD)
	b.add_theme_stylebox_override("normal", _box(Color(0.06, 0.16, 0.1, 0.9), GOLD.darkened(0.2), 2))
	b.add_theme_stylebox_override("hover", _box(Color(0.1, 0.24, 0.14, 0.95), GOLD, 2))
	b.add_theme_stylebox_override("pressed", _box(Color(0.14, 0.3, 0.18, 0.95), GOLD, 2))
	b.focus_mode = Control.FOCUS_NONE
	return b


func _modal(size: Vector2) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.05, 0.1, 0.07, 0.96), GOLD, 3))
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.custom_minimum_size = size
	p.offset_left = -size.x / 2.0
	p.offset_right = size.x / 2.0
	p.offset_top = -size.y / 2.0
	p.offset_bottom = size.y / 2.0
	p.visible = false
	_root.add_child(p)
	return p


func _modal_body(p: PanelContainer, title: String) -> RichTextLabel:
	var v := VBoxContainer.new()
	p.add_child(v)
	v.add_child(_header(title, func(): p.visible = false))
	var r := _rich(14)
	r.fit_content = false
	r.scroll_active = true
	r.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(r)
	return r


func _header(title: String, on_close: Callable) -> HBoxContainer:
	var h := HBoxContainer.new()
	var t := _label("- " + title + " -", 16, GOLD)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(t)
	var x := _button("X")
	x.pressed.connect(on_close)
	h.add_child(x)
	return h


# ---------------------------------------------------------------------------------------------------------
# Season banner (top left): world clock, phase, the four seals and the Demon King's hearts.

func _build_banner() -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box())
	p.position = Vector2(10, 10)
	_root.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	top.add_child(_label("MONADIA", 17, GOLD))
	_info = _label("", 11, DIM)
	top.add_child(_info)
	_phase = _rich(12, 300)
	v.add_child(_phase)
	var row := HBoxContainer.new()
	v.add_child(row)
	row.add_child(_label("Seals", 11, DIM))
	_seals = Seals.new()
	row.add_child(_seals)
	row.add_child(_label("  Demon King", 11, Color("#ff8f8f")))
	_king = Hearts.new()
	_king.count = 10
	_king.size_px = 11.0
	row.add_child(_king)


func _refresh_season() -> void:
	var d = await Api.get_json_if_changed("/api/v2/season")
	if not (d is Dictionary):
		return
	var lines := PackedStringArray()
	lines.append("[color=#d8b24a]Season %d[/color] · %s · %d%%" % [int(d.get("season", 0)), str(d.get("phaseName", "")), int(round(float(d.get("progress", 0.0)) * 100.0))])
	var hero = d.get("hero")
	if hero is Dictionary:
		lines.append("[color=#ffd84a]HERO: %s[/color]" % str(hero["name"]))
	elif d.get("raid") is Dictionary:
		lines.append("[color=#ffb84d]Raid: %d demons attacking[/color]" % int(d["raid"]["raiders"]))
	elif d.get("lastStand", false):
		lines.append("[color=#ffd84a]Last Stand: every blow strikes three times[/color]")
	_phase.text = "\n".join(lines)
	var up: Array[bool] = []
	for g in d.get("generals", []):
		up.append(not bool(g["down"]))
	_seals.intact = up
	_seals.queue_redraw()
	var king = d.get("king")
	if king is Dictionary:
		_king.value = float(king["hp"]) / maxf(1.0, float(king["max"]))
		_king.tooltip_text = "%s, the Demon King" % str(king["name"])
		_king.queue_redraw()


func _on_positions() -> void:
	var p := GameState.positions
	var now := Time.get_datetime_dict_from_system(true)
	_info.text = "  %02d:%02d UTC · tick %d · %d Chogs" % [now.hour, now.minute, int(p.get("tick", 0)), (p.get("ids", []) as Array).size()]


# ---------------------------------------------------------------------------------------------------------
# Buttons (top right)

func _build_buttons() -> void:
	var h := HBoxContainer.new()
	h.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	h.offset_left = -390
	h.offset_right = -10
	h.offset_top = 10
	h.alignment = BoxContainer.ALIGNMENT_END
	_root.add_child(h)
	var chron := _button("Chronicle")
	chron.pressed.connect(_toggle_novel)
	h.add_child(chron)
	var pull := _button("Daily Pull")
	pull.pressed.connect(_toggle_gacha)
	h.add_child(pull)
	var hide := _button("Hide (H)")
	hide.pressed.connect(func(): _root.visible = false)
	h.add_child(hide)


# ---------------------------------------------------------------------------------------------------------
# Star Stream (bottom left, short, collapsible)

func _build_stream() -> void:
	_stream_box = PanelContainer.new()
	_stream_box.add_theme_stylebox_override("panel", _box(Color(0.04, 0.09, 0.06, 0.72)))
	_stream_box.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_stream_box.offset_left = 10
	_stream_box.offset_right = 430
	_stream_box.offset_top = -150
	_stream_box.offset_bottom = -10
	_root.add_child(_stream_box)
	var v := VBoxContainer.new()
	_stream_box.add_child(v)
	var h := HBoxContainer.new()
	v.add_child(h)
	var t := _label("STAR STREAM", 12, GOLD)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(t)
	var fold := _button("–")
	h.add_child(fold)
	_stream = _rich(11)
	_stream.fit_content = false
	_stream.scroll_active = true
	_stream.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(_stream)
	fold.pressed.connect(func():
		_stream.visible = not _stream.visible
		_stream_box.offset_top = -150 if _stream.visible else -46
		fold.text = "–" if _stream.visible else "+")


func _refresh_stream() -> void:
	var data = await Api.get_json_if_changed("/api/v2/stream")
	if not (data is Dictionary) or not data.has("lines"):
		return
	var out := PackedStringArray()
	for line in (data["lines"] as Array).slice(0, 12):
		var col: String = STREAM_COLORS.get(str(line.get("kind", "")), "#f3e9c6")
		out.append("[color=%s]%s[/color]" % [col, str(line.get("text", "")).replace("[", "[lb]")])
	_stream.text = "\n".join(out)


# ---------------------------------------------------------------------------------------------------------
# Status panel (right, narrow; only when a Chog is selected)

func _build_status() -> void:
	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", _box(Color(0.04, 0.11, 0.07, 0.78)))
	_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_panel.offset_left = -310
	_panel.offset_right = -10
	_panel.offset_top = 52
	_panel.offset_bottom = 52 + 430  # compact: about half the screen height at most, the rest of the world stays visible
	_panel.visible = false
	_root.add_child(_panel)
	var v := VBoxContainer.new()
	_panel.add_child(v)
	v.add_child(_header("STATUS", func(): GameState.select(-1)))
	_title = _label("", 17, CREAM)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_title)
	_sub = _rich(12)
	v.add_child(_sub)
	_hp = Hearts.new()
	_hp.count = 8
	_hp.size_px = 13.0
	v.add_child(_hp)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	var inner := VBoxContainer.new()
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inner)
	_agent = _rich(12)
	_agent.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inner.add_child(_agent)
	_life_btn = _button("Life +")
	inner.add_child(_life_btn)
	_life = _rich(12)
	_life.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_life.visible = false
	inner.add_child(_life)
	_life_btn.pressed.connect(func():
		_life.visible = not _life.visible
		_life_btn.text = "Life -" if _life.visible else "Life +")


func _bar(frac: float, width := 14, col := "#7fc96b") -> String:
	var n := clampi(int(round(frac * width)), 0, width)
	return "[color=%s]%s[/color][color=#3b4a3a]%s[/color]" % [col, "|".repeat(n), "|".repeat(width - n)]


func _on_selected(chog_id: int) -> void:
	if chog_id < 0:
		_panel.visible = false
		return
	_panel.visible = true
	var i := GameState.index_of(chog_id)
	_title.text = str(GameState.positions["names"][i]) if i >= 0 else "Chog #%d" % chog_id
	_sub.text = "[color=#a89f7e]Reading the Status Window...[/color]"
	_agent.text = ""
	_life.text = ""
	var data = await Api.get_json("/api/chog/%d" % chog_id)
	if GameState.selected != chog_id:
		return
	if not (data is Dictionary) or not data.has("chog"):
		_sub.text = "[color=#ff8080]Could not read this Chog.[/color]"
		return
	var c: Dictionary = data["chog"]
	var house_i := ["laser", "teardrop", "glass", "moonbeam"].find(str(c.get("house", "")))
	var house_name: String = GameState.HOUSE_NAMES[house_i] if house_i >= 0 else str(c.get("house", ""))
	var house_col: String = GameState.HOUSE_COLORS[house_i].to_html(false) if house_i >= 0 else "ffffff"
	var sub := PackedStringArray()
	var season = c.get("season")
	if season is Dictionary:
		sub.append("[color=#d8b24a]%s[/color] · %s · Lv %d" % [season["title"], season["jobName"], int(season["level"])])
		var st: Dictionary = season["stats"]
		sub.append("[color=#a89f7e]STR %d VIT %d AGI %d INT %d WIS %d LUK %d[/color]" % [int(st["STR"]), int(st["VIT"]), int(st["AGI"]), int(st["INT"]), int(st["WIS"]), int(st["LUK"])])
	sub.append("[color=#%s]%s[/color] · token #%d · %s" % [house_col, house_name, int(c["id"]), str(c.get("mood", ""))])
	_sub.text = "\n".join(sub)
	var a = data.get("agent")
	if a is Dictionary:
		_hp.value = float(a.get("hp", 0)) / maxf(1.0, float(a.get("maxhp", 1)))
		_hp.queue_redraw()
		_agent.text = _agent_text(a)
	if data.get("life") is Dictionary:
		_life.text = _life_text(data["life"])


func _agent_text(a: Dictionary) -> String:
	var lines := PackedStringArray()
	var verbs := {"work": "Working", "idle": "Wandering", "quest": "On a quest", "fight": "Fighting", "rest": "Recovering", "raid": "Raiding"}
	var state := str(a.get("state", ""))
	lines.append("[b]%s[/b] · %s" % [verbs.get(state, state.capitalize()), str(a.get("place", "?"))])
	lines.append("XP %s %d/%d" % [_bar(float(a.get("xp", 0)) / maxf(1.0, float(a.get("xpNext", 1))), 12, "#5aa9e6"), int(a.get("xp", 0)), int(a.get("xpNext", 0))])
	lines.append("[color=#a89f7e]Story %d · Kills %d · Rupees %d[/color]" % [int(a.get("story", 0)), int(a.get("kills", 0)), int(a.get("gold", 0))])
	var q = a.get("quest")
	if q is Dictionary:
		lines.append("[color=#d8b24a]Quest:[/color] %s%s" % [str(q["name"]), "  [color=#c9a7ff](from the stars)[/color]" if q.get("fromStars", false) else ""])
		lines.append("%s %d%% · ~%d ticks with these skills" % [_bar(float(q["pct"]) / 100.0), int(q["pct"]), int(q["expectedTicks"])])
	var skills: Array = a.get("skills", [])
	var names := PackedStringArray()
	for k in skills:
		names.append("[color=%s]%s[/color]" % [RANK_COL.get(str(k["rank"]), "#ffffff"), str(k["name"])])
	lines.append("[color=#d8b24a]Skills %d/6:[/color] %s" % [skills.size(), ", ".join(names) if not names.is_empty() else "none yet"])
	var log: Array = a.get("log", [])
	for l in log.slice(0, 3):
		var s := str(l)
		lines.append("[color=#a89f7e]· %s[/color]" % (s.get_slice(": ", 1) if s.contains(": ") else s))
	return "\n".join(lines)


func _life_text(l: Dictionary) -> String:
	var lines := PackedStringArray()
	if str(l.get("bio", "")) != "":
		lines.append("[i]%s[/i]" % str(l["bio"]))
	var past: Array = l.get("pastLives", [])
	if not past.is_empty():
		lines.append("[color=#c9a7ff]Past lives:[/color] " + " ".join(PackedStringArray(past)))
	for e in (l.get("timeline", []) as Array).slice(0, 8):
		lines.append("[color=#7a8a6a]S%d t%d[/color] %s" % [int(e["season"]), int(e["tick"]), str(e["text"])])
	return "\n".join(lines)


# ---------------------------------------------------------------------------------------------------------
# Chronicle (centred window)

func _toggle_novel() -> void:
	_novel.visible = not _novel.visible
	_gacha.visible = false
	if not _novel.visible:
		return
	_novel_text.text = "Opening the book..."
	var d = await Api.get_json("/api/v2/novel")
	if not (d is Dictionary):
		_novel_text.text = "The chronicle could not be read."
		return
	var out := PackedStringArray()
	out.append("[center][color=#a89f7e]Season %d · %d of %d chapters written so far[/color][/center]\n" % [int(d.get("season", 0)), (d.get("chapters", []) as Array).size(), int(d.get("total", 0))])
	for c in d.get("chapters", []):
		out.append("[font_size=17][color=#d8b24a]%s[/color][/font_size]" % str(c["title"]))
		out.append(str(c["text"]).replace("[", "[lb]") + "\n")
	if (d.get("chapters", []) as Array).is_empty():
		out.append("[i]Nothing has been written yet. The story begins when the season does.[/i]")
	_novel_text.text = "\n".join(out)
	_novel_text.scroll_to_line(0)


# ---------------------------------------------------------------------------------------------------------
# Daily Pull (centred window): draw today's hand of skills and quests, then bestow a few on your Chogs.

func _build_gacha() -> void:
	_gacha = _modal(Vector2(660, 520))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	_gacha.add_child(v)
	v.add_child(_header("DAILY PULL", func(): _gacha.visible = false))
	_gacha_info = _label("", 12, DIM)
	_gacha_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_gacha_info)
	_gacha_draw = _button("Draw today's hand")
	_gacha_draw.pressed.connect(_pull)
	_gacha_draw.visible = false  # shown once the server says you're a holder without today's hand
	v.add_child(_gacha_draw)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	_gacha_cards = GridContainer.new()
	_gacha_cards.columns = 5
	_gacha_cards.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_gacha_cards.add_theme_constant_override("h_separation", 6)
	_gacha_cards.add_theme_constant_override("v_separation", 6)
	scroll.add_child(_gacha_cards)
	var row := HBoxContainer.new()
	v.add_child(row)
	row.add_child(_label("Bestow on", 12, CREAM))
	_gacha_target = OptionButton.new()
	_gacha_target.fit_to_longest_item = false
	_gacha_target.custom_minimum_size = Vector2(260, 0)
	_gacha_target.clip_text = true
	row.add_child(_gacha_target)
	_gacha_btn = _button("Bestow")
	_gacha_btn.pressed.connect(_give)
	row.add_child(_gacha_btn)


func _toggle_gacha() -> void:
	_gacha.visible = not _gacha.visible
	_novel.visible = false
	if _gacha.visible:
		_gacha_info.text = "Asking the stars..."
		_render_gacha(await Api.get_json("/api/v2/gacha"))


func _pull() -> void:
	var r := await Api.post_json("/api/v2/gacha", {"action": "pull"})
	_render_gacha(r.get("data"), r.get("status", 0))


func _give() -> void:
	if _picked.is_empty() or _gacha_target.selected < 0:
		_gacha_info.text = "Pick a card, then a Chog to bestow it on."
		return
	var r := await Api.post_json("/api/v2/gacha", {"action": "give", "kind": _picked["kind"], "ref": _picked["ref"], "chogId": int(_gacha_target.get_item_metadata(_gacha_target.selected))})
	_picked = {}
	_render_gacha(r.get("data"), r.get("status", 0))


func _render_gacha(d, status := 200) -> void:
	if not (d is Dictionary):
		_gacha_info.text = "The stars are silent (HTTP %d)." % int(status)
		return
	if d.has("error") and not d.has("config"):
		_gacha_info.text = str(d["error"])
		return
	_gacha_state = d
	var cfg: Dictionary = d.get("config", {})
	var info := ""
	if not d.get("signedIn", false):
		info = "Connect a wallet that holds a Chog (on the website, same page) to draw. Stargazers can watch everything."
	elif not d.get("holder", false):
		info = "This wallet holds no Chog: you're a Stargazer (watch only)."
	else:
		var given: Dictionary = d.get("given", {"skills": 0, "quests": 0})
		info = "Each day: draw %d skills + %d quests, bestow %d skills + %d quests%s.   Today: skills %d/%d · quests %d/%d" % [
			int(cfg.get("pullSkills", 5)), int(cfg.get("pullQuests", 5)), int(cfg.get("giveSkills", 2)), int(cfg.get("giveQuests", 2)),
			" on Chogs you hold" if cfg.get("ownOnly", true) else " on any Chog",
			int(given.get("skills", 0)), int(cfg.get("giveSkills", 2)), int(given.get("quests", 0)), int(cfg.get("giveQuests", 2))]
	if d.has("message"):
		info = str(d["message"]) + "\n" + info
	_gacha_info.text = info
	var pull = d.get("pull")
	_gacha_draw.visible = d.get("holder", false) and not (pull is Dictionary)
	for ch in _gacha_cards.get_children():
		ch.queue_free()
	if pull is Dictionary:
		for k in pull.get("skills", []):
			_gacha_cards.add_child(_card("skill", k))
		for q in pull.get("quests", []):
			_gacha_cards.add_child(_card("quest", q))
	_gacha_target.clear()
	var owned: Array = d.get("owned", [])
	for o in owned:
		_gacha_target.add_item("%s" % str(o["name"]))
		_gacha_target.set_item_metadata(_gacha_target.item_count - 1, int(o["id"]))
	if not cfg.get("ownOnly", true) and GameState.selected >= 0:
		_gacha_target.add_item("Selected: Chog #%d" % GameState.selected)
		_gacha_target.set_item_metadata(_gacha_target.item_count - 1, GameState.selected)
	if GameState.selected >= 0:
		for i in _gacha_target.item_count:
			if int(_gacha_target.get_item_metadata(i)) == GameState.selected:
				_gacha_target.select(i)


func _card(kind: String, c: Dictionary) -> Button:
	var rank: String = str(c.get("rank", TIER_RANK[clampi(int(c.get("tier", 1)), 0, 6)]))
	var col := Color(RANK_COL.get(rank, "#ffffff"))
	var b := Button.new()
	b.custom_minimum_size = Vector2(118, 112)
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.focus_mode = Control.FOCUS_NONE
	var tag := "SKILL" if kind == "skill" else "QUEST"
	var sub := str(c.get("school", "")) if kind == "skill" else "/".join(PackedStringArray(c.get("tags", [])))
	b.text = "%s · %s\n%s\n%s" % [tag, rank, str(c.get("name", "?")), sub]
	b.tooltip_text = str(c.get("desc", ""))
	b.add_theme_font_size_override("font_size", 12)
	b.add_theme_color_override("font_color", CREAM)
	var used: bool = c.get("used", false)
	var bg := Color(0.05, 0.12, 0.08, 0.95) if not used else Color(0.1, 0.1, 0.1, 0.7)
	b.add_theme_stylebox_override("normal", _box(bg, col if not used else Color(0.3, 0.3, 0.3), 3))
	b.add_theme_stylebox_override("hover", _box(bg.lightened(0.08), col.lightened(0.2), 3))
	b.add_theme_stylebox_override("pressed", _box(bg.lightened(0.15), Color.WHITE, 3))
	b.disabled = used
	if used:
		b.text += "\n(bestowed)"
	b.pressed.connect(func():
		_picked = {"kind": kind, "ref": str(c.get("id", ""))}
		_gacha_info.text = "Chosen: %s \"%s\". Now pick a Chog and press Bestow." % [kind, str(c.get("name", ""))])
	return b


# ---------------------------------------------------------------------------------------------------------
# Drawn widgets

## A row of heart containers: full, partial and empty hearts for a 0..1 value.
class Hearts extends Control:
	var count := 8
	var value := 1.0
	var size_px := 12.0

	func _get_minimum_size() -> Vector2:
		return Vector2(count * (size_px + 3.0), size_px + 2.0)

	func _draw() -> void:
		var filled := value * count
		for i in count:
			var o := Vector2(i * (size_px + 3.0), 1.0)
			var f := clampf(filled - i, 0.0, 1.0)
			_heart(o, Color(0.25, 0.05, 0.05, 0.9))
			if f > 0.0:
				_heart(o, Color("#e63946"), f)
			_outline(o)

	func _pts(o: Vector2) -> PackedVector2Array:
		var s := size_px
		var p := PackedVector2Array()
		for k in 24:
			var t := TAU * k / 24.0
			# classic heart curve, scaled into an s x s box
			var x := 16.0 * pow(sin(t), 3)
			var y := 13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t)
			p.append(o + Vector2(s / 2.0 + x / 34.0 * s, s * 0.45 - y / 34.0 * s))
		return p

	func _heart(o: Vector2, col: Color, frac := 1.0) -> void:
		var p := _pts(o)
		if frac >= 0.999:
			draw_colored_polygon(p, col)
			return
		# partial heart: keep the left part
		var cut := o.x + size_px * frac
		var q := PackedVector2Array()
		for v in p:
			q.append(Vector2(minf(v.x, cut), v.y))
		draw_colored_polygon(q, col)

	func _outline(o: Vector2) -> void:
		var p := _pts(o)
		p.append(p[0])
		draw_polyline(p, Color(0, 0, 0, 0.8), 1.2, true)


## Four seal crystals: bright while a Demon General still holds it, dark once broken.
class Seals extends Control:
	var intact: Array[bool] = [true, true, true, true]

	func _get_minimum_size() -> Vector2:
		return Vector2(4 * 16.0, 14.0)

	func _draw() -> void:
		for i in intact.size():
			var c := Vector2(8.0 + i * 16.0, 7.0)
			var p := PackedVector2Array([c + Vector2(0, -6), c + Vector2(5, 0), c + Vector2(0, 6), c + Vector2(-5, 0)])
			draw_colored_polygon(p, Color("#b07ce8") if intact[i] else Color(0.2, 0.18, 0.15))
			p.append(p[0])
			draw_polyline(p, Color("#d8b24a"), 1.2, true)
