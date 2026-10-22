class_name InteriorCatalog
extends RefCounted
## Procedural "dollhouse" interiors (floor + back and side walls, open front) for enterable buildings.
## build(type) returns {mesh, size: Vector2(w, d), spots: Array[Vector3], lights: Array, title, mood}.
## Local space: floor at y = 0, open front toward +Z, camera looks from the front.

const A := preload("res://scripts/architect.gd")
const WOOD := Color("#8a5a3a")
const DWOOD := Color("#5c3b26")
const PLANK := Color("#a77a4f")
const STONE := Color("#9d968b")
const CREAM := Color("#efe3c8")
const GOLD := Color("#e8b84a")
const RED := Color("#a83232")
const GLASS := Color("#ffd27a")

## Which building types can be entered (mid to big buildings tied to the story).
const ENTERABLE := [
	"tavern", "guild_hall", "blacksmith", "weaponsmith", "armorsmith", "alchemist", "general_store", "library",
	"academy", "temple", "keep", "castle", "barracks", "restaurant", "bakery", "flower_shop", "toyshop", "tailor",
	"jeweler", "colosseum", "spire", "demon_castle", "dungeon", "post_office", "market",
]


static func build(type: String) -> Dictionary:
	var a := A.new()
	var spots: Array[Vector3] = []
	var lights: Array = []
	var w := 14.0
	var d := 10.0
	var floor_col := PLANK
	var wall_col := CREAM
	match type:
		"keep", "castle", "spire", "demon_castle", "temple", "library", "guild_hall", "colosseum":
			w = 20.0
			d = 14.0
		"dungeon":
			w = 16.0
			d = 12.0
	match type:
		"keep", "castle", "temple", "library", "barracks", "colosseum":
			floor_col = Color("#b8b0a2")
			wall_col = STONE
		"spire":
			floor_col = Color("#d9d0ee")
			wall_col = Color("#c9bde8")
		"demon_castle":
			floor_col = Color("#2a2030")
			wall_col = Color("#3a2747")
		"dungeon":
			floor_col = Color("#3d3a4a")
			wall_col = Color("#4a4560")
		"alchemist", "academy":
			wall_col = Color("#e6dcf3")
	_shell(a, w, d, 5.5, floor_col, wall_col, type in ["dungeon", "demon_castle"])
	var mood := "warm"
	match type:
		"tavern":
			_counter(a, -3.0, -d / 2.0 + 1.4, 7.0)
			_shelf(a, -3.0, -d / 2.0 + 0.4, 7.0, 3.0, [Color("#8ef0c4"), Color("#ffb84d"), Color("#c9a7ff"), Color("#ff7aa8")], true)
			for p in [Vector2(2.5, -1.5), Vector2(5.0, 1.5), Vector2(1.0, 2.5), Vector2(-4.5, 2.0)]:
				_table(a, p.x, p.y)
			_fireplace(a, w / 2.0 - 0.8, -1.0)
			for z in [-3.0, 3.0]:
				a.cyl(Vector3(-w / 2.0 + 0.8, 0, z), 0.5, 1.2, WOOD, 7)
			_board(a, w / 2.0 - 2.0, -d / 2.0 + 0.2, 2.6, "rumors")
			lights.append([Vector3(-2, 4, -1), Color("#ffb84d"), 2.5])
			lights.append([Vector3(4, 4, 1), Color("#ffb84d"), 2.5])
			spots = _grid_spots(w, d, 18)
		"guild_hall":
			_board(a, 0.0, -d / 2.0 + 0.2, 7.0, "quests")
			_counter(a, -5.5, -2.5, 5.0)
			for x in [-6.0, 6.0]:
				_banner(a, x, -d / 2.0 + 0.15)
			for p in [Vector2(3, 0), Vector2(6, 2.5), Vector2(-1, 2.5), Vector2(-6, 3)]:
				_long_table(a, p.x, p.y)
			_trophy(a, 4.0, -d / 2.0 + 0.3)
			for x in [-9.0, 9.0]:
				_armor_stand(a, x, -3.0)
			lights.append([Vector3(0, 4.5, -3), Color("#ffd27a"), 3.0])
			lights.append([Vector3(0, 4.5, 3), Color("#ffd27a"), 2.0])
			spots = _grid_spots(w, d, 40)
		"blacksmith", "weaponsmith", "armorsmith":
			_forge(a, -w / 2.0 + 2.2, -d / 2.0 + 1.6)
			_anvil(a, -1.5, -0.5)
			_anvil(a, 2.0, 0.5)
			_rack(a, w / 2.0 - 0.6, -1.0, type)
			_shelf(a, 2.5, -d / 2.0 + 0.4, 5.0, 2.2, [Color("#cfd6de"), Color("#9aa3ad"), Color("#4a4a52")], false)
			a.cyl(Vector3(-3.5, 0, 3.0), 0.6, 0.9, Color("#4f6d7a"), 8)  # quench barrel
			lights.append([Vector3(-w / 2.0 + 2.2, 2.5, -d / 2.0 + 2.2), Color("#ff6a1a"), 4.0])
			mood = "forge"
			spots = _grid_spots(w, d, 10)
		"alchemist":
			_cauldron(a, 0.0, -0.5)
			_shelf(a, -3.5, -d / 2.0 + 0.4, 6.0, 3.4, [Color("#8ef0c4"), Color("#c9a7ff"), Color("#ff7aa8"), Color("#7fe7ff")], true)
			_shelf(a, 3.5, -d / 2.0 + 0.4, 5.0, 3.4, [Color("#ffd43b"), Color("#8ef0c4"), Color("#b197fc")], true)
			_table(a, 4.0, 1.5)
			a.crystal(Vector3(4.0, 0.95, 1.5), 0.25, 0.8, Color("#8ef0c4"))
			lights.append([Vector3(0, 2.5, -0.5), Color("#8ef0c4"), 3.5])
			mood = "magic"
			spots = _grid_spots(w, d, 10)
		"library":
			for x in [-7.0, -3.5, 3.5, 7.0]:
				for z in [-4.0, 0.0]:
					_bookcase(a, x, z)
			for x in [-5.0, 5.0]:
				_long_table(a, x, 3.5)
			a.ball(Vector3(0, 1.4, 3.5), 0.7, Color("#4dabf7"))  # globe
			a.cyl(Vector3(0, 0, 3.5), 0.25, 0.8, DWOOD, 6)
			lights.append([Vector3(0, 4.5, 0), Color("#ffe6a8"), 3.0])
			spots = _grid_spots(w, d, 20)
		"academy":
			a.box(Vector3(0, 1.2, -d / 2.0 + 0.2), Vector3(7.0, 2.8, 0.12), Color("#2f4f3f"))  # blackboard
			for row in 2:
				for col in 3:
					_desk(a, -4.0 + col * 4.0, 0.5 + row * 2.5)
			a.ball(Vector3(-5.5, 3.2, -2.5), 0.8, Color("#c9a7ff"), 1.0)  # floating orb
			a.cyl(Vector3(-5.5, 0, -2.5), 0.4, 1.8, STONE, 8)
			lights.append([Vector3(-5.5, 3.2, -2.5), Color("#c9a7ff"), 3.0])
			mood = "magic"
			spots = _grid_spots(w, d, 16)
		"temple":
			_altar(a, 0.0, -d / 2.0 + 2.0)
			a.box(Vector3(0, 1.5, -d / 2.0 + 0.15), Vector3(3.0, 3.5, 0.1), Color("#ffe8a3"), 0.5)  # stained window
			for row in 4:
				for side in [-1.0, 1.0]:
					a.box(Vector3(side * 3.6, 0, -1.0 + row * 2.0), Vector3(4.6, 0.55, 0.7), DWOOD)
			for x in [-8.5, 8.5]:
				for z in [-4.0, 1.0]:
					a.cyl(Vector3(x, 0, z), 0.55, 5.5, Color("#ece6da"), 8)
			_rug(a, 0, 1.0, 2.2, d - 3.0, RED)
			lights.append([Vector3(0, 3.5, -d / 2.0 + 2.5), Color("#fff1c4"), 3.5])
			mood = "holy"
			spots = _grid_spots(w, d, 24)
		"keep", "castle":
			_rug(a, 0, 0.5, 3.0, d - 2.0, RED)
			_throne(a, 0.0, -d / 2.0 + 1.8, GOLD, 1.0)
			for x in [-6.0, 6.0]:
				for z in [-4.0, 0.0, 4.0]:
					a.cyl(Vector3(x, 0, z), 0.6, 5.5, Color("#ece6da"), 8)
				_banner(a, x * 1.4, -d / 2.0 + 0.15)
			_long_table(a, -7.0, 4.0)
			lights.append([Vector3(0, 4.5, -3), Color("#ffe6a8"), 3.5])
			spots = _grid_spots(w, d, 30)
		"spire":
			_rug(a, 0, 0.5, 3.0, d - 2.0, Color("#7b4dff"))
			a.box(Vector3(0, 0, -d / 2.0 + 2.0), Vector3(3.0, 1.2, 1.6), Color("#e9e1ff"))  # ballot podium
			a.crystal(Vector3(0, 1.2, -d / 2.0 + 2.0), 0.5, 1.6, Color("#c9a7ff"))
			for i in 5:
				var x := -6.0 + i * 3.0
				a.cyl(Vector3(x, 0, -d / 2.0 + 0.8), 0.45, 0.9, Color("#c9bde8"), 8)  # candidate pedestals
			for x in [-8.0, 8.0]:
				for z in [-3.0, 3.0]:
					a.cyl(Vector3(x, 0, z), 0.6, 5.5, Color("#e9e1ff"), 8)
			lights.append([Vector3(0, 4, -d / 2.0 + 2.0), Color("#c9a7ff"), 4.0])
			mood = "magic"
			spots = _grid_spots(w, d, 30)
		"demon_castle":
			_rug(a, 0, 0.5, 3.4, d - 2.0, Color("#5a1f6a"))
			_throne(a, 0.0, -d / 2.0 + 2.2, Color("#2a1f33"), 1.8)
			a.crystal(Vector3(0, 6.2, -d / 2.0 + 2.2), 0.8, 2.4, Color("#ff3df2"))
			for x in [-7.0, 7.0]:
				for z in [-3.5, 2.5]:
					a.cone(Vector3(x, 0, z), 1.0, 6.0, Color("#2a1f33"), 6)
					a.ball(Vector3(x, 6.2, z), 0.35, Color("#ff3df2"), 1.0)
			for i in 6:
				a.box(Vector3(-5.0 + i * 2.0, 4.8, -d / 2.0 + 0.3), Vector3(0.1, 1.6, 0.1), Color("#6d675e"))  # chains
			lights.append([Vector3(0, 4, -d / 2.0 + 3), Color("#ff3df2"), 4.5])
			lights.append([Vector3(-6, 3, 2), Color("#b06cff"), 3.0])
			lights.append([Vector3(6, 3, 2), Color("#b06cff"), 3.0])
			lights.append([Vector3(0, 3, 5), Color("#d9b8ff"), 2.0])
			mood = "doom"
			spots = _grid_spots(w, d, 12)
		"dungeon":
			a.box(Vector3(0, 0, -d / 2.0 + 0.4), Vector3(4.0, 4.6, 0.3), Color("#8ef0c4"), 1.0)  # portal
			a.cyl(Vector3(0, 0.02, 0.5), 3.5, 0.05, Color("#8ef0c4"), 16, -1.0, 1.0)  # summoning circle
			for i in 8:
				var ang := TAU * i / 8
				a.ball(Vector3(cos(ang) * 6.5, 0.6, sin(ang) * 4.5), 1.0, Color("#3d3a4a"), 0.0, 0.0, 0.8)
			for p in [Vector2(-5, -3), Vector2(5, 2), Vector2(-3, 3.5)]:
				a.cone(Vector3(p.x, 0, p.y), 0.5, 2.0, Color("#e7e1d3"), 6)
			lights.append([Vector3(0, 3, 0), Color("#8ef0c4"), 4.0])
			mood = "doom"
			spots = _grid_spots(w, d, 14)
		"barracks":
			for i in 4:
				_bunk(a, -5.5 + i * 3.6, -d / 2.0 + 1.4)
			for x in [-3.0, 0.0, 3.0]:
				_dummy(a, x, 2.5)
			_rack(a, w / 2.0 - 0.6, 0.0, "weaponsmith")
			lights.append([Vector3(0, 4, 0), Color("#ffd27a"), 2.5])
			spots = _grid_spots(w, d, 20)
		"colosseum":
			a.cyl(Vector3(0, 0.02, 0), 6.5, 0.05, Color("#d9c7a0"), 20)
			for i in 3:
				a.box(Vector3(0, i * 0.8, -d / 2.0 + 0.6 + i * 0.7), Vector3(w - 2.0, 0.8, 0.8), STONE)  # stands
			for x in [-3.0, 3.0]:
				_dummy(a, x, 0.5)
			_banner(a, -8.0, -d / 2.0 + 0.15)
			_banner(a, 8.0, -d / 2.0 + 0.15)
			lights.append([Vector3(0, 5, 0), Color("#fff1c4"), 3.0])
			spots = _grid_spots(w, d, 24)
		"post_office":
			_counter(a, 0.0, -1.0, 6.0)
			for i in 6:
				a.box(Vector3(-4.5 + i * 1.8, 0.0, -d / 2.0 + 0.5), Vector3(1.5, 3.2, 0.6), WOOD)  # pigeonholes
			for i in 4:
				a.box(Vector3(-3.0 + i * 1.6, 0.0, 2.5), Vector3(0.9, 0.7, 0.9), Color("#c9a26a"))  # parcels
			lights.append([Vector3(0, 4, 0), Color("#ffd27a"), 2.5])
			spots = _grid_spots(w, d, 8)
		_:
			# shops: counter + goods themed by type
			_counter(a, 0.0, -1.5, 6.0)
			var goods: Array = {
				"general_store": [Color("#b98a5a"), Color("#e85d5d"), Color("#4dabf7")],
				"restaurant": [Color("#f4ead0"), Color("#e85d5d"), Color("#2e8b57")],
				"bakery": [Color("#e0a95c"), Color("#c9774a"), Color("#fbe4c4")],
				"flower_shop": [Color("#ff7aa8"), Color("#ffd43b"), Color("#b197fc"), Color("#ff9f6a")],
				"toyshop": [Color("#ff4d6d"), Color("#4dabf7"), Color("#ffd43b"), Color("#8ef0c4")],
				"tailor": [Color("#b197fc"), Color("#4dabf7"), Color("#ff7aa8")],
				"jeweler": [Color("#7fe7ff"), Color("#c9a7ff"), Color("#ffd43b")],
				"market": [Color("#ff9f6a"), Color("#8ef0c4"), Color("#f2a6c8")],
			}.get(type, [Color("#b98a5a")])
			_shelf(a, -3.5, -d / 2.0 + 0.4, 5.5, 3.0, goods, type == "jeweler")
			_shelf(a, 3.5, -d / 2.0 + 0.4, 5.5, 3.0, goods, type == "jeweler")
			if type == "restaurant":
				for p in [Vector2(-4, 2.5), Vector2(0, 3), Vector2(4, 2.5)]:
					_table(a, p.x, p.y)
			elif type == "flower_shop":
				for i in 8:
					a.cyl(Vector3(-5.0 + i * 1.4, 0, 3.0), 0.35, 0.6, Color("#c9774a"), 7)
					a.ball(Vector3(-5.0 + i * 1.4, 0.95, 3.0), 0.45, goods[i % goods.size()])
			elif type == "bakery":
				a.ball(Vector3(w / 2.0 - 2.0, 1.0, -2.0), 1.6, Color("#c9774a"), 0.0, 0.0, 0.8)
				a.box(Vector3(w / 2.0 - 2.0, 0.7, -0.6), Vector3(1.0, 0.6, 0.2), Color("#ff6a1a"), 1.0)
			elif type == "toyshop":
				for i in 5:
					a.ball(Vector3(-4.0 + i * 2.0, 3.8, 1.0), 0.45, goods[i % goods.size()])
			for z in [2.5]:
				_table(a, 5.0, z)
			lights.append([Vector3(0, 4, 0), Color("#ffd27a"), 2.5])
			spots = _grid_spots(w, d, 10)
	return {"mesh": a.commit(), "size": Vector2(w, d), "spots": spots, "lights": lights, "mood": mood}


# ---------------------------------------------------------------- room shell and furniture kit

static func _shell(a: Architect, w: float, d: float, h: float, floor_col: Color, wall_col: Color, cave: bool) -> void:
	a.box(Vector3(0, -0.3, 0), Vector3(w, 0.3, d), floor_col)
	for i in int(w / 2.0):
		a.box(Vector3(-w / 2.0 + 1.0 + i * 2.0, 0.0, 0), Vector3(0.05, 0.02, d), floor_col.darkened(0.12))  # planks / tiles
	a.box(Vector3(0, 0, -d / 2.0 - 0.2), Vector3(w + 0.4, h, 0.4), wall_col)  # back wall
	a.box(Vector3(-w / 2.0 - 0.2, 0, 0), Vector3(0.4, h, d), wall_col)
	a.box(Vector3(w / 2.0 + 0.2, 0, 0), Vector3(0.4, h, d), wall_col)
	a.box(Vector3(0, 0, d / 2.0 + 0.15), Vector3(w + 0.4, 0.5, 0.3), wall_col.darkened(0.2))  # low front sill
	a.box(Vector3(0, 0, -d / 2.0 + 0.02), Vector3(w, 0.35, 0.1), DWOOD)  # baseboard
	if not cave:
		for i in int(w / 4.0):
			var x := -w / 2.0 + 2.0 + i * 4.0
			a.box(Vector3(x, 2.4, -d / 2.0 + 0.02), Vector3(1.2, 1.6, 0.06), GLASS, 0.5)  # back windows
		for side in [-1.0, 1.0]:
			a.box(Vector3(side * (w / 2.0 - 0.05), 3.0, -1.0), Vector3(0.1, 0.4, 0.1), DWOOD)  # torch bracket
			a.ball(Vector3(side * (w / 2.0 - 0.15), 3.35, -1.0), 0.2, Color("#ffb84d"), 1.0)
	# beams along the top of the walls
	a.box(Vector3(0, h - 0.2, -d / 2.0 + 0.1), Vector3(w, 0.3, 0.3), DWOOD)


static func _grid_spots(w: float, d: float, n: int) -> Array[Vector3]:
	var out: Array[Vector3] = []
	var cols := maxi(3, int(sqrt(float(n) * w / d)))
	var rows := maxi(2, int(ceil(float(n) / cols)))
	for r in rows:
		for c in cols:
			out.append(Vector3(-w / 2.0 + 1.5 + (w - 3.0) * (c + 0.5) / cols, 0, -d / 2.0 + 2.5 + (d - 3.5) * (r + 0.5) / rows))
	return out


static func _table(a: Architect, x: float, z: float) -> void:
	a.cyl(Vector3(x, 0, z), 0.12, 0.8, DWOOD, 6)
	a.cyl(Vector3(x, 0.8, z), 0.75, 0.1, WOOD, 8)
	for ang in [0.0, 2.1, 4.2]:
		a.box(Vector3(x + cos(ang) * 1.1, 0, z + sin(ang) * 1.1), Vector3(0.45, 0.45, 0.45), DWOOD)
	a.cyl(Vector3(x + 0.2, 0.9, z), 0.12, 0.25, Color("#e8b84a"), 6)  # mug


static func _long_table(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(3.2, 0.8, 1.1), WOOD)
	a.box(Vector3(x, 0, z + 0.9), Vector3(3.0, 0.45, 0.4), DWOOD)
	a.box(Vector3(x, 0, z - 0.9), Vector3(3.0, 0.45, 0.4), DWOOD)
	a.ball(Vector3(x - 0.8, 0.95, z), 0.15, Color("#ffb84d"), 0.5)


static func _counter(a: Architect, x: float, z: float, w: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(w, 1.1, 0.9), WOOD)
	a.box(Vector3(x, 1.1, z), Vector3(w + 0.2, 0.12, 1.1), DWOOD)


static func _shelf(a: Architect, x: float, z: float, w: float, h: float, cols: Array, glow: bool) -> void:
	a.box(Vector3(x, 0, z), Vector3(w, h, 0.6), DWOOD)
	var rows := int(h / 0.9)
	for r in rows:
		var y := 0.5 + r * 0.9
		a.box(Vector3(x, y - 0.05, z + 0.3), Vector3(w, 0.08, 0.3), WOOD)
		for i in int(w / 0.6):
			var c: Color = cols[(i + r) % cols.size()]
			a.box(Vector3(x - w / 2.0 + 0.4 + i * 0.6, y, z + 0.32), Vector3(0.3, 0.45, 0.25), c, 1.0 if glow else 0.0)


static func _bookcase(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(3.0, 4.2, 0.8), DWOOD)
	var bc := [Color("#a83232"), Color("#2f6f9f"), Color("#4f8a3c"), Color("#e8b84a"), Color("#7b4dff")]
	for r in 4:
		for i in 7:
			a.box(Vector3(x - 1.2 + i * 0.4, 0.3 + r * 1.0, z + 0.42), Vector3(0.3, 0.7, 0.1), bc[(i * 3 + r) % 5])


static func _board(a: Architect, x: float, z: float, w: float, kind: String) -> void:
	a.box(Vector3(x, 1.2, z), Vector3(w, 2.2, 0.15), Color("#8a5a3a"))
	var notes := int(w / 0.8)
	for i in notes:
		for r in 2:
			var col := Color("#f4ead0") if (i + r) % 3 else (Color("#ff7aa8") if kind == "quests" else Color("#c9a7ff"))
			a.box(Vector3(x - w / 2.0 + 0.5 + i * 0.8, 1.6 + r * 0.9, z + 0.1), Vector3(0.6, 0.7, 0.04), col)
	if kind == "quests":
		a.box(Vector3(x, 3.6, z + 0.1), Vector3(2.4, 0.5, 0.06), Color("#a83232"))  # "WANTED: Demon Generals"


static func _banner(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 2.0, z), Vector3(1.4, 3.0, 0.06), Color(1, 1, 1), 0.0, 1.0)
	a.box(Vector3(x, 5.0, z), Vector3(1.8, 0.12, 0.12), GOLD)


static func _trophy(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 3.0, z), Vector3(1.2, 1.2, 0.15), DWOOD)
	a.ball(Vector3(x, 3.6, z + 0.4), 0.55, Color("#5a1f6a"))
	a.cone(Vector3(x - 0.4, 3.9, z + 0.4), 0.15, 0.7, Color("#e7e1d3"), 5)
	a.cone(Vector3(x + 0.4, 3.9, z + 0.4), 0.15, 0.7, Color("#e7e1d3"), 5)


static func _armor_stand(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(0.5, 1.4, 0.4), Color("#9aa3ad"))
	a.ball(Vector3(x, 1.7, z), 0.32, Color("#9aa3ad"))
	a.box(Vector3(x, 0, z), Vector3(0.9, 0.12, 0.9), DWOOD)


static func _fireplace(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(0.9, 2.4, 2.6), STONE)
	a.box(Vector3(x - 0.3, 0.2, z), Vector3(0.4, 0.9, 1.4), Color("#ff6a1a"), 1.0)
	a.box(Vector3(x, 2.4, z), Vector3(0.7, 3.0, 1.2), STONE)


static func _forge(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(3.0, 1.2, 2.4), STONE)
	a.box(Vector3(x, 1.2, z), Vector3(2.2, 0.3, 1.6), Color("#ff6a1a"), 1.0)
	a.cyl(Vector3(x, 1.5, z - 0.4), 0.6, 4.0, STONE, 6, 0.4)


static func _anvil(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(0.6, 0.7, 0.6), DWOOD)
	a.box(Vector3(x, 0.7, z), Vector3(1.3, 0.4, 0.55), Color("#4a4a52"))
	a.cone(Vector3(x + 0.85, 0.75, z), 0.2, 0.3, Color("#4a4a52"), 5)


static func _rack(a: Architect, x: float, z: float, type: String) -> void:
	a.box(Vector3(x, 0, z), Vector3(0.4, 2.6, 4.0), DWOOD)
	for i in 5:
		var zz := z - 1.6 + i * 0.8
		if type == "armorsmith":
			a.cyl(Vector3(x - 0.3, 1.2, zz), 0.35, 0.1, Color("#9aa3ad"), 8)
		else:
			a.box(Vector3(x - 0.3, 0.3, zz), Vector3(0.08, 2.0, 0.12), Color("#cfd6de"))
			a.box(Vector3(x - 0.3, 0.6, zz), Vector3(0.1, 0.1, 0.5), GOLD)


static func _cauldron(a: Architect, x: float, z: float) -> void:
	a.ball(Vector3(x, 0.9, z), 1.1, Color("#2f2f36"), 0.0, 0.0, 0.8)
	a.cyl(Vector3(x, 1.5, z), 0.9, 0.08, Color("#8ef0c4"), 10, -1.0, 1.0)
	for ang in [0.6, 2.0, 3.6, 5.0]:
		a.ball(Vector3(x + cos(ang) * 0.4, 1.8 + ang * 0.1, z + sin(ang) * 0.4), 0.18, Color("#8ef0c4"), 1.0)


static func _desk(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(2.0, 0.75, 0.9), WOOD)
	a.box(Vector3(x, 0, z + 0.9), Vector3(0.6, 0.45, 0.5), DWOOD)
	a.box(Vector3(x - 0.4, 0.78, z), Vector3(0.6, 0.05, 0.45), Color("#f4ead0"))


static func _altar(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(3.0, 1.2, 1.4), Color("#ece6da"))
	a.box(Vector3(x, 1.2, z), Vector3(3.2, 0.12, 1.6), GOLD)
	a.crystal(Vector3(x, 1.3, z), 0.4, 1.6, Color("#fff1c4"))
	for dx in [-1.2, 1.2]:
		a.cyl(Vector3(x + dx, 1.3, z), 0.08, 0.6, Color("#f4ead0"), 6)
		a.ball(Vector3(x + dx, 2.0, z), 0.1, Color("#ffd27a"), 1.0)


static func _throne(a: Architect, x: float, z: float, col: Color, s: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(4.0 * s, 0.5, 3.0 * s), Color("#8d867c"))
	a.box(Vector3(x, 0.5, z), Vector3(1.6 * s, 1.0 * s, 1.4 * s), col)
	a.box(Vector3(x, 0.5, z - 0.6 * s), Vector3(1.6 * s, 3.2 * s, 0.3 * s), col)
	for dx in [-0.9, 0.9]:
		a.box(Vector3(x + dx * s, 0.5, z), Vector3(0.3 * s, 1.5 * s, 1.2 * s), col)
	a.crystal(Vector3(x, 0.5 + 3.2 * s, z - 0.6 * s), 0.25 * s, 0.7 * s, Color("#c9a7ff"))


static func _rug(a: Architect, x: float, z: float, w: float, d: float, col: Color) -> void:
	a.box(Vector3(x, 0.0, z), Vector3(w, 0.04, d), col)
	a.box(Vector3(x, 0.0, z), Vector3(w + 0.3, 0.03, d + 0.3), GOLD)


static func _bunk(a: Architect, x: float, z: float) -> void:
	for y in [0.0, 1.6]:
		a.box(Vector3(x, y + 0.3, z), Vector3(2.6, 0.3, 1.2), WOOD)
		a.box(Vector3(x, y + 0.6, z), Vector3(2.4, 0.2, 1.0), Color("#d9cdb3"))
	for dx in [-1.3, 1.3]:
		a.box(Vector3(x + dx, 0, z), Vector3(0.15, 3.0, 0.15), DWOOD)


static func _dummy(a: Architect, x: float, z: float) -> void:
	a.box(Vector3(x, 0, z), Vector3(0.15, 1.8, 0.15), DWOOD)
	a.ball(Vector3(x, 1.6, z), 0.45, Color("#d9c25a"))
	a.box(Vector3(x, 1.2, z), Vector3(1.4, 0.15, 0.15), DWOOD)
