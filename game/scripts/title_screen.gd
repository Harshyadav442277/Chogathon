class_name TitleScreen
extends CanvasLayer
## Opening screen: the key art, the ChogSekai logo and an "Enter Monadia" button. The world keeps loading
## behind it. The click also starts the music (browsers only allow audio after a user gesture).

signal entered

const GOLD := Color("#f2cf63")


func _ready() -> void:
	layer = 20
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	var art := TextureRect.new()
	art.texture = preload("res://assets/title.jpg")
	art.set_anchors_preset(Control.PRESET_FULL_RECT)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	root.add_child(art)
	# Darken the lower third so the logo and button read on any part of the picture.
	var shade := TextureRect.new()
	var grad := Gradient.new()
	grad.set_color(0, Color(0, 0, 0, 0.0))
	grad.set_color(1, Color(0.02, 0.04, 0.03, 0.85))
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill_from = Vector2(0.5, 0.45)
	gt.fill_to = Vector2(0.5, 1.0)
	shade.texture = gt
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	root.add_child(shade)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	box.offset_left = -320
	box.offset_right = 320
	box.offset_top = -230
	box.offset_bottom = -40
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 6)
	root.add_child(box)
	box.add_child(_text("ChogSekai", 64, GOLD, 10))
	box.add_child(_text("The Monadia Cycle", 22, Color("#f3e9c6"), 6))
	box.add_child(_text("1,969 Chogs. One Demon King. Every season, a new Hero.", 15, Color("#d8d0b0"), 5))
	var b := Button.new()
	b.text = "Enter Monadia"
	b.custom_minimum_size = Vector2(240, 48)
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_size_override("font_size", 20)
	b.add_theme_color_override("font_color", Color("#f3e9c6"))
	b.add_theme_color_override("font_hover_color", GOLD)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.14, 0.09, 0.9)
	sb.border_color = GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(8)
	b.add_theme_stylebox_override("normal", sb)
	var hover := sb.duplicate() as StyleBoxFlat
	hover.bg_color = Color(0.09, 0.22, 0.13, 0.95)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", hover)
	b.pressed.connect(_enter.bind(root))
	box.add_child(b)
	box.add_child(_text("Watch every Chog live · Holders draw skills and quests daily · H hides the HUD", 12, Color("#bdb59a"), 4))


func _text(t: String, size: int, col: Color, outline: int) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0.05, 0.03, 0.12, 0.95))
	l.add_theme_constant_override("outline_size", outline)
	return l


func _enter(root: Control) -> void:
	entered.emit()
	var tw := create_tween()
	tw.tween_property(root, "modulate:a", 0.0, 0.6)
	tw.tween_callback(queue_free)
