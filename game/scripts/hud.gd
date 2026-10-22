class_name Hud
extends CanvasLayer
## Adventure-style HUD (dark forest green, gold trim, heart containers), kept to the edges so the world stays
## visible: a small season banner (top left), three buttons (top right), a short Star Stream (bottom left) and
## a narrow Status panel (right, only when a Chog is selected). The Star Pulls and the Chronicle open as
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
var _life_btn: Button
var _life_win: PanelContainer
var _life_text_label: RichTextLabel
var _life_data := {}
var _life_name := ""
var _italic := RegEx.new()
var _novel: PanelContainer
var _novel_text: RichTextLabel
var _gacha: PanelContainer
var _gacha_info: Label
var _gacha_target: OptionButton
var _gacha_btn: Button
var _gacha_state := {}
var _slots: HBoxContainer
var _offers: HBoxContainer
var _offer_title: Label
var _bestow_row: HBoxContainer
var _wait_label: Label
var _view := -1  # the pull being looked at
var _choice := -1  # the offer picked in it
var _clock_skew := 0  # server clock minus local clock, ms
var _sfx := {}
var _pic: TextureRect
var _pics := {}  # chog id -> ImageTexture (NFT pictures, cached)
var _now_playing: Label
var _signin: HBoxContainer
var _judge_code: LineEdit


func _ready() -> void:
	# UI sounds (original, tools/make_sfx.py): click, select, pull, bestow, error, open.
	for n in ["click", "select", "pull", "bestow", "error", "open"]:
		var pl := AudioStreamPlayer.new()
		pl.stream = load("res://assets/sfx/%s.wav" % n)
		pl.volume_db = -6.0
		add_child(pl)
		_sfx[n] = pl
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_build_banner()
	_build_buttons()
	_build_stream()
	_build_status()
	_italic.compile("\\*([^*\\n]+)\\*")
	_novel = _modal(Vector2(660, 580))
	_novel_text = _modal_body(_novel, "THE MONADIA CYCLE")
	_life_win = _modal(Vector2(720, 620))
	_life_text_label = _modal_body(_life_win, "LIFE STORY")
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
			elif arg.ends_with("life"):
				await get_tree().create_timer(4.0).timeout
				_toggle_life()
			else:
				_toggle_novel()


## "Now playing" note under the buttons (top right) when a track starts; fades after a few seconds.
func show_track(title: String, credit: String) -> void:
	if _now_playing == null:
		_now_playing = _label("", 12, CREAM)
		_now_playing.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		_now_playing.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		_now_playing.offset_left = -560
		_now_playing.offset_right = -14
		_now_playing.offset_top = 48
		_now_playing.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_root.add_child(_now_playing)
	_now_playing.text = "♪ %s
%s" % [title, credit]
	_now_playing.modulate.a = 1.0
	var tw := _now_playing.create_tween()
	tw.tween_interval(6.0)
	tw.tween_property(_now_playing, "modulate:a", 0.0, 1.5)


func sfx(name: String) -> void:
	var pl := _sfx.get(name) as AudioStreamPlayer
	if pl:
		pl.play()


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
	b.pressed.connect(func(): sfx("click"))
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
	p.mouse_filter = Control.MOUSE_FILTER_STOP  # the wheel scrolls the window, never zooms the map behind it
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
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	top.add_child(_label("CHOGSEKAI", 17, GOLD))
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
	h.offset_left = -560
	h.offset_right = -10
	h.offset_top = 10
	h.alignment = BoxContainer.ALIGNMENT_END
	_root.add_child(h)
	var chron := _button("Chronicle")
	chron.pressed.connect(_toggle_novel)
	h.add_child(chron)
	var pull := _button("Star Pulls")
	pull.pressed.connect(_toggle_gacha)
	h.add_child(pull)
	var song := _button("Music")
	song.pressed.connect(func():
		var m := get_parent().get("music") as Jukebox
		if m == null:
			return
		if not m.playing and not m.stream_paused:
			m.start()
			song.text = "Music"
		else:
			m.stream_paused = not m.stream_paused
			song.text = "Music (off)" if m.stream_paused else "Music")
	h.add_child(song)
	var skip := _button("Next ♪")
	skip.tooltip_text = "Another track (each region of the map has its own)"
	skip.pressed.connect(func():
		var m := get_parent().get("music") as Jukebox
		if m:
			song.text = "Music"
			m.next())
	h.add_child(skip)
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
	_stream_box.mouse_filter = Control.MOUSE_FILTER_STOP
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
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(_panel)
	var v := VBoxContainer.new()
	_panel.add_child(v)
	v.add_child(_header("STATUS", func(): GameState.select(-1)))
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	v.add_child(head)
	var frame := PanelContainer.new()
	var fb := _box(Color(0.02, 0.05, 0.03, 1.0), GOLD, 2)
	fb.set_content_margin_all(2)
	frame.add_theme_stylebox_override("panel", fb)
	head.add_child(frame)
	_pic = TextureRect.new()
	_pic.custom_minimum_size = Vector2(84, 84)
	_pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	frame.add_child(_pic)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(hv)
	_title = _label("", 16, CREAM)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hv.add_child(_title)
	_sub = _rich(11)
	hv.add_child(_sub)
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
	_life_btn = _button("Read Life Story")
	_life_btn.disabled = true
	inner.add_child(_life_btn)
	_life_btn.pressed.connect(_toggle_life)


func _bar(frac: float, width := 14, col := "#7fc96b") -> String:
	var n := clampi(int(round(frac * width)), 0, width)
	return "[color=%s]%s[/color][color=#3b4a3a]%s[/color]" % [col, "|".repeat(n), "|".repeat(width - n)]


func _on_selected(chog_id: int) -> void:
	if chog_id < 0:
		_panel.visible = false
		return
	_panel.visible = true
	sfx("select")
	_show_pic(chog_id)
	var i := GameState.index_of(chog_id)
	_title.text = str(GameState.positions["names"][i]) if i >= 0 else "Chog #%d" % chog_id
	_sub.text = "[color=#a89f7e]Reading the Status Window...[/color]"
	_agent.text = ""
	_life_data = {}
	_life_btn.disabled = true
	_life_win.visible = false
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
		_life_data = data["life"]
		_life_name = str(c.get("name", "Chog #%d" % chog_id))
		_life_btn.disabled = false
		var ep: Array = _life_data.get("epithets", [])
		if not ep.is_empty():
			_sub.text += "\n[color=#ffd84a]%s[/color]" % "  ·  ".join(PackedStringArray(ep))


## The Chog's NFT picture (160 px webp served by the site at /chogs/<id>.webp), cached per id.
func _show_pic(chog_id: int) -> void:
	if _pics.has(chog_id):
		_pic.texture = _pics[chog_id]
		return
	_pic.texture = null
	var bytes := await Api.get_bytes("/chogs/%d.webp" % chog_id)
	if bytes.is_empty() or GameState.selected != chog_id:
		return
	var img := Image.new()
	if img.load_webp_from_buffer(bytes) != OK:
		return
	var tex := ImageTexture.create_from_image(img)
	_pics[chog_id] = tex
	_pic.texture = tex


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


## Story text may use *italics*; escape brackets so BBCode can't be injected.
func _md(t: String) -> String:
	return _italic.sub(t.replace("[", "[lb]"), "[i]$1[/i]", true)


const KIND_TAG := {
	"quest_done": ["Quest", "#7fc96b"], "quest_fail": ["Fell", "#ff8a8a"], "level": ["Level", "#5aa9e6"], "title": ["Title", "#ffd84a"],
	"party": ["Party", "#c9a7ff"], "raid_held": ["Raid", "#ffb84d"], "raid_hurt": ["Raid", "#ff8a8a"], "raid_won": ["Raid", "#ffb84d"], "raid_lost": ["Raid", "#ff8a8a"],
	"gift_skill": ["Star", "#c9a7ff"], "gift_quest": ["Star", "#c9a7ff"], "slay_general": ["Seal", "#ffd84a"], "hero": ["Hero", "#ffd84a"], "summoned": ["Born", "#9fd8ff"],
	"thread": ["Tale", "#d8b24a"], "train": ["Spar", "#9fd8ff"], "trade": ["Trade", "#cfe8b0"], "gossip": ["Talk", "#a89f7e"], "heal": ["Heal", "#7fc96b"],
	"work": ["Work", "#a89f7e"], "fell": ["Fell", "#ff8a8a"],
}


func _heading(t: String) -> String:
	return "\n[font_size=17][color=#d8b24a]%s[/color][/font_size]" % t


## The whole life story as BBCode: profile card, the told sections, bonds, past lives and the season-by-season timeline.
func _life_bbcode(l: Dictionary, nm: String) -> String:
	var out := PackedStringArray()
	var p: Dictionary = l.get("profile", {})
	out.append("[font_size=20][color=#f3e9c6]%s[/color][/font_size]" % nm.replace("[", "[lb]"))
	var ep: Array = l.get("epithets", [])
	if not ep.is_empty():
		out.append("[color=#ffd84a]%s[/color]" % "  ·  ".join(PackedStringArray(ep)))
	if not p.is_empty():
		out.append(_heading("Who they are"))
		out.append("[color=#d8b24a]%s.[/color] %s" % [str(p.get("temperament", "")), _md(str(p.get("temperamentLine", "")))])
		for look in p.get("look", []):
			out.append("[color=#a89f7e]%s[/color]" % _md(str(look)))
		out.append("")
		var facts := [["Quirk", "quirk"], ["Dream", "dream"], ["Fear", "fear"], ["Motto", "motto"], ["Favourite food", "food"], ["Pastime", "hobby"], ["Talent", "talent"]]
		for f in facts:
			out.append("[color=#d8b24a]%s:[/color] %s" % [f[0], _md(str(p.get(f[1], "")))])
		var tr: Array = p.get("traits", [])
		if not tr.is_empty():
			var bits := PackedStringArray()
			for t in tr:
				bits.append("%s %s" % [str(t["name"]), str(t["value"])])
			out.append("[color=#7a8a6a]NFT: %s[/color]" % ", ".join(bits).replace("[", "[lb]"))
	for sec in l.get("sections", []):
		out.append(_heading(str(sec["title"])))
		for para in sec["paragraphs"]:
			out.append(_md(str(para)) + "\n")
	var past: Array = l.get("pastLives", [])
	if not past.is_empty():
		out.append(_heading("Past Lives"))
		for pl in past:
			out.append("[color=#c9a7ff]%s[/color]" % _md(str(pl["text"])))
	var tl: Array = l.get("timeline", [])
	if not tl.is_empty():
		out.append(_heading("Timeline"))
		var last := -1
		for e in tl:
			var sn := int(e["season"])
			if sn != last:
				out.append("\n[color=#d8b24a]Season %d[/color]" % sn)
				last = sn
			var tag: Array = KIND_TAG.get(str(e["kind"]), [str(e["kind"]).capitalize(), "#a89f7e"])
			out.append("[color=#7a8a6a]t%d[/color] [color=%s]%s[/color]  %s" % [int(e["tick"]), tag[1], tag[0], _md(str(e["text"]))])
	return "\n".join(out)


func _toggle_life() -> void:
	if _life_data.is_empty():
		return
	_life_win.visible = not _life_win.visible
	_novel.visible = false
	_gacha.visible = false
	if _life_win.visible:
		sfx("open")
		_life_text_label.text = _life_bbcode(_life_data, _life_name)
		_life_text_label.scroll_to_line(0)


# ---------------------------------------------------------------------------------------------------------
# Chronicle (centred window)

func _toggle_novel() -> void:
	_novel.visible = not _novel.visible
	_gacha.visible = false
	_life_win.visible = false
	if not _novel.visible:
		return
	_novel_text.text = "Opening the book..."
	var d = await Api.get_json("/api/v2/novel")
	if not (d is Dictionary):
		_novel_text.text = "The chronicle could not be read."
		return
	var out := PackedStringArray()
	var arc: Dictionary = d.get("arc", {}) if d.get("arc") is Dictionary else {}
	if not arc.is_empty():
		out.append("[center][font_size=20][color=#f3e9c6]%s[/color][/font_size][/center]" % _md(str(arc.get("title", ""))))
		out.append("[center][color=#a89f7e]%s[/color][/center]" % _md(str(arc.get("blurb", ""))))
	out.append("[center][color=#7a8a6a]Season %d · %d beats told so far (about %d in all)[/color][/center]\n" % [int(d.get("season", 0)), (d.get("chapters", []) as Array).size(), int(d.get("total", 0))])
	for c in d.get("chapters", []):
		out.append("[font_size=17][color=#d8b24a]%s[/color][/font_size]" % _md(str(c["title"])))
		out.append(_md(str(c["text"])) + "\n")
	if (d.get("chapters", []) as Array).is_empty():
		out.append("[i]Nothing has been written yet. The story begins when the season does.[/i]")
	_novel_text.text = "\n".join(out)
	_novel_text.scroll_to_line(0)


# ---------------------------------------------------------------------------------------------------------
# Star Pulls (centred window): each season a holder gets 5 pulls, unlocked one at a time across the day. A pull
# reveals 4 cards (skills and quests); the holder chooses one and bestows it on a Chog they hold.

func _build_gacha() -> void:
	_gacha = _modal(Vector2(780, 600))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	_gacha.add_child(v)
	v.add_child(_header("STAR PULLS", func(): _gacha.visible = false))
	_gacha_info = _label("", 13, DIM)
	_gacha_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_gacha_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_gacha_info)
	# Sign-in row (shown only when signed out): a wallet signature, or a judge code.
	_signin = HBoxContainer.new()
	_signin.alignment = BoxContainer.ALIGNMENT_CENTER
	_signin.visible = false
	v.add_child(_signin)
	var wallet := _button("Connect wallet")
	wallet.pressed.connect(_connect_wallet)
	_signin.add_child(wallet)
	_signin.add_child(_label("   or   ", 12, DIM))
	_judge_code = LineEdit.new()
	_judge_code.placeholder_text = "judge code"
	_judge_code.secret = true
	_judge_code.custom_minimum_size = Vector2(180, 0)
	_judge_code.text_submitted.connect(func(_t): _judge_signin())
	_signin.add_child(_judge_code)
	var judge := _button("Judge sign-in")
	judge.pressed.connect(_judge_signin)
	_signin.add_child(judge)
	# The five pull slots of this season.
	_slots = HBoxContainer.new()
	_slots.alignment = BoxContainer.ALIGNMENT_CENTER
	_slots.add_theme_constant_override("separation", 8)
	v.add_child(_slots)
	v.add_child(HSeparator.new())
	_offer_title = _label("", 15, GOLD)
	_offer_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_offer_title)
	# The offered cards of the pull being looked at (or a big Pull button, or the countdown).
	var center := CenterContainer.new()
	center.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(center)
	_offers = HBoxContainer.new()
	_offers.add_theme_constant_override("separation", 12)
	center.add_child(_offers)
	_bestow_row = HBoxContainer.new()
	_bestow_row.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(_bestow_row)
	_bestow_row.add_child(_label("Bestow on ", 13, CREAM))
	_gacha_target = OptionButton.new()
	_gacha_target.fit_to_longest_item = false
	_gacha_target.custom_minimum_size = Vector2(260, 0)
	_gacha_target.clip_text = true
	_bestow_row.add_child(_gacha_target)
	_gacha_btn = _button("  Choose & Bestow  ")
	_gacha_btn.pressed.connect(_give)
	_bestow_row.add_child(_gacha_btn)
	# Countdown to the next pull, refreshed every second while the window is open.
	var t := Timer.new()
	t.wait_time = 1.0
	t.timeout.connect(_tick_countdown)
	add_child(t)
	t.start()


func _toggle_gacha() -> void:
	_gacha.visible = not _gacha.visible
	_novel.visible = false
	_life_win.visible = false
	if _gacha.visible:
		sfx("open")
		_gacha_info.text = "Asking the stars..."
		_render_gacha(await Api.get_json("/api/v2/gacha"))


func _pull() -> void:
	var r := await Api.post_json("/api/v2/gacha", {"action": "pull"})
	sfx("pull" if int(r.get("status", 0)) == 200 else "error")
	_render_gacha(r.get("data"), r.get("status", 0))


func _give() -> void:
	if _view < 0 or _choice < 0:
		_gacha_info.text = "Pick one of the cards first."
		sfx("error")
		return
	if _gacha_target.selected < 0:
		_gacha_info.text = "Pick a Chog to bestow it on."
		sfx("error")
		return
	var r := await Api.post_json("/api/v2/gacha", {"action": "choose", "pull": _view, "option": _choice, "chogId": int(_gacha_target.get_item_metadata(_gacha_target.selected))})
	sfx("bestow" if int(r.get("status", 0)) == 200 else "error")
	_render_gacha(r.get("data"), r.get("status", 0))


## Milliseconds until the next pull unlocks (server clock), or -1 when none is left to unlock.
func _next_in() -> int:
	if _gacha_state.get("nextAt") == null:
		return -1
	var now_ms := int(Time.get_unix_time_from_system() * 1000.0) + _clock_skew
	return maxi(0, int(_gacha_state["nextAt"]) - now_ms)


func _fmt_ms(ms: int) -> String:
	var s := ms / 1000
	if s >= 3600:
		return "%dh %02dm" % [s / 3600, (s / 60) % 60]
	return "%dm %02ds" % [s / 60, s % 60]


func _tick_countdown() -> void:
	if not _gacha.visible or _wait_label == null or not is_instance_valid(_wait_label):
		return
	var ms := _next_in()
	if ms == 0:
		_wait_label = null
		_render_gacha(await Api.get_json("/api/v2/gacha"))  # a new pull has risen
	elif ms > 0:
		_wait_label.text = "Next pull rises in %s" % _fmt_ms(ms)


func _render_gacha(d, status := 200) -> void:
	if not (d is Dictionary):
		_gacha_info.text = "The stars are silent (HTTP %d)." % int(status)
		return
	if d.has("error") and not d.has("config"):
		_gacha_info.text = str(d["error"])
		sfx("error")
		return
	_gacha_state = d
	if d.has("now"):
		_clock_skew = int(d["now"]) - int(Time.get_unix_time_from_system() * 1000.0)
	var signed: bool = d.get("signedIn", false)
	var holder: bool = d.get("holder", false)
	var pulls: Array = d.get("pulls", [])
	var total := int(d.get("pullsTotal", 5))
	var risen := int(d.get("unlocked", 0))
	_signin.visible = not signed
	var info := ""
	if not signed:
		info = "Constellations who hold a Chog get 5 Star Pulls each season, one every few hours. Each pull shows 4 cards: choose one and bestow it on your Chog.\nConnect a wallet that holds a Chog (judges: use your judge code). Stargazers can watch everything."
	elif not holder:
		info = "This wallet holds no Chog: you're a Stargazer (watch only)."
	else:
		info = "Season %d · %d of %d pulls risen · each pull: choose 1 of 4 cards for a Chog you hold" % [int(d.get("season", 0)), risen, total]
	if d.has("message"):
		info = str(d["message"]) + "\n" + info
	_gacha_info.text = info
	# The pull to look at: the one just drawn, else the first one still waiting for a choice.
	_view = int(d.get("drawn", -1))
	if _view < 0:
		for p in pulls:
			if p.get("chosen") == null:
				_view = int(p["index"])
				break
	_choice = -1
	for ch in _slots.get_children():
		ch.queue_free()
	_slots.visible = signed and holder
	for i in total:
		_slots.add_child(_slot(i, pulls[i] if i < pulls.size() else null, i < risen))
	for ch in _offers.get_children():
		ch.queue_free()
	_wait_label = null
	_bestow_row.visible = false
	_offer_title.text = ""
	if signed and holder:
		if _view >= 0 and _view < pulls.size():
			_show_pull(pulls[_view], int(d.get("drawn", -1)) == _view)
		elif pulls.size() < risen:
			_offer_title.text = "A star is waiting for you"
			var b := _button("  ★  PULL  ★  ")
			b.add_theme_font_size_override("font_size", 22)
			b.custom_minimum_size = Vector2(240, 70)
			b.pressed.connect(_pull)
			_offers.add_child(b)
		elif pulls.size() >= total:
			_offer_title.text = "All %d pulls used this season" % total
			_offers.add_child(_label("A new season brings new stars.", 14, DIM))
		else:
			_offer_title.text = "Every choice is made"
			_wait_label = _label("Next pull rises in %s" % _fmt_ms(_next_in()), 16, CREAM)
			_offers.add_child(_wait_label)
	_gacha_target.clear()
	for o in d.get("owned", []):
		_gacha_target.add_item("%s" % str(o["name"]))
		_gacha_target.set_item_metadata(_gacha_target.item_count - 1, int(o["id"]))
	var cfg: Dictionary = d.get("config", {})
	if not cfg.get("ownOnly", true) and GameState.selected >= 0:
		_gacha_target.add_item("Selected: Chog #%d" % GameState.selected)
		_gacha_target.set_item_metadata(_gacha_target.item_count - 1, GameState.selected)
	if GameState.selected >= 0:
		for i in _gacha_target.item_count:
			if int(_gacha_target.get_item_metadata(i)) == GameState.selected:
				_gacha_target.select(i)


## One of the season's pull slots: done (gold), waiting for a choice (violet), ready (green) or locked (grey).
func _slot(i: int, p, open: bool) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(138, 58)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 12)
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var col := Color(0.3, 0.3, 0.3)
	var bg := Color(0.06, 0.08, 0.07, 0.9)
	if p is Dictionary and p.get("chosen") != null:
		var c: Dictionary = p["offers"][int(p["chosen"])]
		b.text = "★ %s\n→ %s" % [str(c.get("name", "?")), str(p.get("chogName", ""))]
		col = GOLD
		bg = Color(0.12, 0.1, 0.04, 0.95)
	elif p is Dictionary:
		b.text = "★ Pull %d\nchoose a card!" % (i + 1)
		col = Color("#c9a7ff")
		bg = Color(0.1, 0.06, 0.16, 0.95)
	elif open:
		b.text = "☆ Pull %d\nready" % (i + 1)
		col = Color("#7fc96b")
	else:
		b.text = "☆ Pull %d\nlocked" % (i + 1)
	b.add_theme_color_override("font_color", CREAM if open or p != null else DIM)
	b.add_theme_stylebox_override("normal", _box(bg, col, 3 if i == _view else 2))
	b.add_theme_stylebox_override("hover", _box(bg.lightened(0.08), col.lightened(0.2), 3))
	b.add_theme_stylebox_override("pressed", _box(bg.lightened(0.12), Color.WHITE, 3))
	b.pressed.connect(func():
		sfx("click")
		if p is Dictionary:
			_view = i
			_choice = -1
			for ch in _offers.get_children():
				ch.queue_free()
			_wait_label = null
			_show_pull(p, false)
		elif open:
			_pull())
	return b


func _show_pull(p: Dictionary, flip: bool) -> void:
	var chosen = p.get("chosen")
	if chosen == null:
		_offer_title.text = "Pull %d · choose one card" % (int(p["index"]) + 1)
	else:
		_offer_title.text = "Pull %d · bestowed on %s" % [int(p["index"]) + 1, str(p.get("chogName", ""))]
	_bestow_row.visible = chosen == null
	var offers: Array = p.get("offers", [])
	for k in offers.size():
		var card := _card(offers[k], k, chosen)
		_offers.add_child(card)
		if flip:
			# the cards just pulled flip in one after another
			card.pivot_offset = Vector2(80, 105)
			card.scale = Vector2(0.1, 0.1)
			card.modulate = Color(2.0, 2.0, 1.4, 0.0)
			var tw := card.create_tween().set_parallel()
			tw.tween_property(card, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(k * 0.12)
			tw.tween_property(card, "modulate", Color.WHITE, 0.7).set_delay(k * 0.12)


## Wallet sign-in from inside the web build: the browser wallet signs the same free message as the website
## (no transaction), /api/auth/verify sets the session cookie, then Star Pulls reloads.
const SIGN_IN_JS := """
(async () => {
  window.__csAuth = 'pending';
  try {
    const eth = window.ethereum;
    if (!eth) { window.__csAuth = 'error:No wallet found. Install MetaMask or Rabby, or use a judge code.'; return; }
    const [address] = await eth.request({ method: 'eth_requestAccounts' });
    const issuedAt = new Date().toISOString();
    const message = 'Sign in to ChogSekai\\n\\nThis only proves you own this wallet. It costs nothing and sends no transaction.\\n\\nAddress: ' + address + '\\nIssued: ' + issuedAt;
    const signature = await eth.request({ method: 'personal_sign', params: [message, address] });
    const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, signature, issuedAt }) });
    window.__csAuth = r.ok ? 'ok' : 'error:' + (((await r.json().catch(() => ({}))).error) || r.status);
  } catch (e) { window.__csAuth = 'error:' + (e && e.message ? e.message : e); }
})();
"""


func _connect_wallet() -> void:
	if not OS.has_feature("web"):
		_gacha_info.text = "Wallet sign-in works in the browser build (/play). In this window, use a judge code."
		return
	JavaScriptBridge.eval(SIGN_IN_JS, true)
	_gacha_info.text = "Check your wallet: sign the message (free, no transaction)."
	for i in 240:  # up to 2 minutes for the user to approve
		await get_tree().create_timer(0.5).timeout
		var st = JavaScriptBridge.eval("window.__csAuth", true)
		if typeof(st) == TYPE_STRING and st != "pending":
			if st == "ok":
				sfx("bestow")
				_render_gacha(await Api.get_json("/api/v2/gacha"))
			else:
				_gacha_info.text = "Sign-in failed: " + str(st).trim_prefix("error:")
			return
	_gacha_info.text = "Sign-in timed out. Try again."


func _judge_signin() -> void:
	var r := await Api.post_json("/api/auth/judge", {"code": _judge_code.text.strip_edges()})
	if int(r.get("status", 0)) == 200:
		_judge_code.text = ""
		_render_gacha(await Api.get_json("/api/v2/gacha"))
	else:
		var d = r.get("data")
		_gacha_info.text = str(d.get("error", "Judge sign-in failed.")) if d is Dictionary else "Judge sign-in failed."


## An offered card: rank-coloured frame, kind, name, school or tags, and its description. Click to choose it.
func _card(c: Dictionary, k: int, chosen) -> Button:
	var kind := str(c.get("kind", "skill"))
	var rank: String = str(c.get("rank", TIER_RANK[clampi(int(c.get("tier", 1)), 0, 6)]))
	var col := Color(RANK_COL.get(rank, "#ffffff"))
	var b := Button.new()
	b.custom_minimum_size = Vector2(160, 210)
	b.focus_mode = Control.FOCUS_NONE
	b.toggle_mode = true
	var dim: bool = chosen != null and int(chosen) != k
	var bg := Color(0.05, 0.12, 0.08, 0.97) if kind == "skill" else Color(0.1, 0.08, 0.04, 0.97)
	if dim:
		bg = Color(0.08, 0.08, 0.08, 0.8)
		col = Color(0.3, 0.3, 0.3)
	b.add_theme_stylebox_override("normal", _box(bg, col, 3))
	b.add_theme_stylebox_override("hover", _box(bg.lightened(0.08), col.lightened(0.25), 3))
	b.add_theme_stylebox_override("pressed", _box(bg.lightened(0.14), Color.WHITE, 4))
	b.add_theme_stylebox_override("hover_pressed", _box(bg.lightened(0.14), Color.WHITE, 4))
	b.add_theme_stylebox_override("disabled", _box(bg, GOLD if (chosen != null and int(chosen) == k) else col, 3))
	if chosen != null:
		b.disabled = true
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 10
	v.offset_right = -10
	v.offset_top = 8
	v.offset_bottom = -8
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 4)
	b.add_child(v)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(top)
	var kl := _label("SKILL" if kind == "skill" else "QUEST", 11, Color("#9fd8ff") if kind == "skill" else Color("#ffb84d"))
	kl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(kl)
	top.add_child(_label(rank, 18, col))
	var title := _label(str(c.get("name", "?")), 15, CREAM if not dim else DIM)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(title)
	var sub := str(c.get("school", "")) if kind == "skill" else " / ".join(PackedStringArray(c.get("tags", [])))
	v.add_child(_label(sub, 11, GOLD if not dim else DIM))
	var desc := _label(str(c.get("desc", "")), 11, DIM)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	desc.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	desc.custom_minimum_size = Vector2(140, 0)
	v.add_child(desc)
	if chosen != null and int(chosen) == k:
		v.add_child(_label("★ CHOSEN", 12, GOLD))
	for ch in v.get_children() + top.get_children():
		(ch as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.tooltip_text = str(c.get("desc", ""))
	if chosen == null:
		b.pressed.connect(func():
			sfx("select")
			_choice = k
			for o in _offers.get_children():
				(o as Button).set_pressed_no_signal(o == b)
			_gacha_info.text = "Chosen: %s \"%s\". Pick a Chog and press Choose & Bestow." % [kind, str(c.get("name", ""))])
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
