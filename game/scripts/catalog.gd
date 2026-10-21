class_name Catalog
extends RefCounted
## Procedural meshes for every building and prop type in world.json.
## Local space: ground at y = 0, the front (door) faces +Z, roughly 1 unit = 1 m.

const A := preload("res://scripts/architect.gd")

const STONE := Color("#b9b2a6")
const DSTONE := Color("#8d867c")
const WOOD := Color("#8a5a3a")
const DWOOD := Color("#5c3b26")
const PLASTER := Color("#efe6d2")
const CREAM := Color("#f4ead0")
const DARK := Color("#3a2a24")
const GOLD := Color("#e8b84a")
const RED := Color("#c0392b")
const TINT := Color(1, 1, 1)
const LEAF := Color("#4f8f4a")


static func building(type: String) -> ArrayMesh:
	var a := A.new()
	match type:
		"house_small":
			a.house(4.0, 3.4, 3.0, PLASTER, 2.0)
			a.box(Vector3(1.2, 3.6, -0.6), Vector3(0.5, 1.6, 0.5), DSTONE)  # chimney
		"house_large":
			a.house(5.6, 4.0, 4.6, CREAM, 2.4, 2)
			a.box(Vector3(-1.8, 5.2, 0.4), Vector3(0.6, 2.0, 0.6), DSTONE)
		"keep":
			a.box(Vector3.ZERO, Vector3(8, 9, 8), STONE)
			a.windows(5.5, 4.0, 6, 3, 0.8)
			a.box(Vector3(0, 0, 4.0), Vector3(2.2, 3.2, 0.3), DARK)
			for x in [-4.0, 4.0]:
				for z in [-4.0, 4.0]:
					a.cyl(Vector3(x, 0, z), 1.5, 11, DSTONE, 8)
					a.cone(Vector3(x, 11, z), 1.9, 3.5, TINT, 8, 0.0, 1.0)
			_crenel(a, 8, 8, 9, STONE)
			a.box(Vector3(0, 9, 0), Vector3(0.15, 4, 0.15), DWOOD)
			a.box(Vector3(0.9, 11.6, 0), Vector3(1.6, 1.0, 0.08), TINT, 0.0, 1.0)  # banner
		"castle":
			a.box(Vector3.ZERO, Vector3(14, 6, 12), STONE)
			_crenel(a, 14, 12, 6, STONE)
			a.box(Vector3(0, 6, -1), Vector3(8, 8, 7), STONE)
			a.windows(9.5, 2.5, 6, 3, 0.9)
			a.box(Vector3(0, 0, 6.0), Vector3(3, 4, 0.4), DARK)
			for x in [-7.0, 7.0]:
				for z in [-6.0, 6.0]:
					a.cyl(Vector3(x, 0, z), 1.8, 10, DSTONE, 8)
					a.cone(Vector3(x, 10, z), 2.3, 4, TINT, 8, 0.0, 1.0)
			a.cyl(Vector3(0, 14, -1), 2.2, 6, DSTONE, 8)
			a.cone(Vector3(0, 20, -1), 2.8, 6, TINT, 8, 0.0, 1.0)
			a.crystal(Vector3(0, 26, -1), 0.6, 2.0, Color("#c9a7ff"))
		"barracks":
			a.box(Vector3.ZERO, Vector3(10, 3.6, 5), DSTONE)
			_crenel(a, 10, 5, 3.6, DSTONE)
			a.windows(2.0, 2.5, 8, 5, 0.5)
			a.box(Vector3(0, 0, 2.5), Vector3(1.6, 2.4, 0.2), DARK)
			for x in [-3.0, 3.0]:
				a.box(Vector3(x, 3.6, 0), Vector3(0.12, 3, 0.12), DWOOD)
				a.box(Vector3(x + 0.6, 5.4, 0), Vector3(1.2, 1.0, 0.06), TINT, 0.0, 1.0)
			a.box(Vector3(4.2, 0, 3.4), Vector3(1.8, 1.4, 0.3), DWOOD)  # weapon rack
		"guild_hall":
			a.box(Vector3.ZERO, Vector3(9, 5, 7), CREAM)
			a.box(Vector3(-4.5, 0, 0), Vector3(0.4, 5, 7), DWOOD)
			a.box(Vector3(4.5, 0, 0), Vector3(0.4, 5, 7), DWOOD)
			a.windows(3.0, 3.5, 7.5, 4, 0.8)
			a.box(Vector3(0, 0, 3.5), Vector3(2, 3, 0.3), DARK)
			a.gable(Vector3(0, 5, 0), 9, 7, 3.4, TINT, 1.0)
			a.box(Vector3(0, 5.2, 3.9), Vector3(3.6, 1.1, 0.2), GOLD)  # big sign
			a.cyl(Vector3(0, 6.9, 3.95), 0.7, 0.15, RED, 8)  # shield emblem
			a.box(Vector3(5.5, 0, 3), Vector3(0.15, 7, 0.15), DWOOD)
			a.box(Vector3(6.3, 5.6, 3), Vector3(1.6, 1.2, 0.06), TINT, 0.0, 1.0)
		"blacksmith":
			a.house(4.6, 4.0, 3.2, PLASTER, 2.0)
			a.box(Vector3(0, 0, 3.2), Vector3(4.6, 0.15, 2.6), DSTONE)  # yard
			a.box(Vector3(-1.4, 0, 3.4), Vector3(1.4, 1.1, 1.2), DSTONE)  # forge
			a.box(Vector3(-1.4, 1.1, 3.4), Vector3(0.9, 0.3, 0.7), Color("#ff6a1a"), 1.0)  # embers
			a.box(Vector3(1.1, 0, 3.5), Vector3(0.5, 0.7, 0.5), DARK)  # anvil stand
			a.box(Vector3(1.1, 0.7, 3.5), Vector3(1.0, 0.35, 0.45), Color("#4a4a52"))
			a.box(Vector3(-1.5, 3.0, -1.0), Vector3(0.8, 3.0, 0.8), DSTONE)  # tall chimney
		"weaponsmith":
			a.house(4.4, 3.8, 3.2, CREAM, 2.0)
			a.box(Vector3(0, 2.4, 2.1), Vector3(0.2, 1.6, 0.08), Color("#cfd6de"))  # sword sign
			a.box(Vector3(0, 2.6, 2.1), Vector3(0.9, 0.15, 0.1), GOLD)
			for x in [-1.6, -1.0, 1.0, 1.6]:
				a.box(Vector3(x, 0, 2.5), Vector3(0.12, 1.6, 0.12), Color("#cfd6de"))
		"armorsmith":
			a.house(4.4, 3.8, 3.2, PLASTER, 2.0)
			a.cyl(Vector3(0, 2.3, 2.0), 0.7, 0.12, Color("#9aa3ad"), 8)  # shield sign
			a.box(Vector3(1.6, 0, 2.6), Vector3(0.5, 1.1, 0.4), Color("#9aa3ad"))  # armour stand
			a.ball(Vector3(1.6, 1.4, 2.6), 0.3, Color("#9aa3ad"))
		"alchemist":
			a.cyl(Vector3.ZERO, 2.4, 4.0, Color("#d8cfe8"), 8)
			a.ball(Vector3(0, 4.0, 0), 2.5, TINT, 0.0, 1.0, 0.8)
			a.crystal(Vector3(0, 5.8, 0), 0.4, 1.4, Color("#8ef0c4"))
			a.box(Vector3(0, 0, 2.3), Vector3(1.0, 1.7, 0.2), DARK)
			for i in 3:
				a.ball(Vector3(-1.2 + i * 1.2, 0.35, 3.2), 0.3, [Color("#8ef0c4"), Color("#c9a7ff"), Color("#ff7aa8")][i], 1.0)
			a.windows(2.4, 2.35, 2.5, 2, 0.6)
		"general_store":
			a.house(5.0, 4.0, 3.2, CREAM, 2.0)
			_awning(a, 5.0, 2.0, 2.4, Color("#e85d5d"), Color("#fff3e0"))
			for x in [-1.8, 1.8]:
				a.cyl(Vector3(x, 0, 3.4), 0.4, 0.9, WOOD, 8)  # barrels
			a.box(Vector3(0.4, 0, 3.6), Vector3(0.8, 0.8, 0.8), Color("#b98a5a"))  # crate
		"library":
			a.box(Vector3.ZERO, Vector3(8, 5, 6), STONE)
			for i in 5:
				a.cyl(Vector3(-3.2 + i * 1.6, 0, 3.4), 0.35, 4.6, Color("#e9e4da"), 8)
			a.box(Vector3(0, 4.6, 3.2), Vector3(8.4, 0.5, 1.6), STONE)
			a.gable(Vector3(0, 5, 0), 8, 6.6, 2.6, TINT, 1.0)
			a.windows(2.6, 3.05, 6, 4, 0.7)
		"academy":
			a.box(Vector3(-1.5, 0, 0), Vector3(6, 4, 5), Color("#e6dcf3"))
			a.gable(Vector3(-1.5, 4, 0), 6, 5, 2, TINT, 1.0)
			a.cyl(Vector3(2.8, 0, 0), 1.8, 8, Color("#e6dcf3"), 8)
			a.ball(Vector3(2.8, 8, 0), 1.9, Color("#7b4dff"), 0.0, 0.0, 0.9)
			a.crystal(Vector3(2.8, 9.5, 0), 0.35, 1.3, Color("#c9a7ff"))
			a.windows(2.2, 2.55, 5, 3, 0.6)
		"temple":
			a.box(Vector3.ZERO, Vector3(6, 5, 8), Color("#f5f1e6"))
			a.gable(Vector3(0, 5, 0), 6, 8, 2.6, TINT, 1.0)
			a.box(Vector3(0, 0, -3), Vector3(2.4, 9, 2.4), Color("#f5f1e6"))
			a.pyramid(Vector3(0, 9, -3), 2.6, 2.6, 4, TINT, 1.0)
			a.box(Vector3(0, 2.6, 4.05), Vector3(1.4, 2.2, 0.1), Color("#ffe8a3"), 0.5)  # glowing window
			a.box(Vector3(0, 0, 4.0), Vector3(1.6, 2.2, 0.2), DARK)
		"tavern":
			a.house(5.6, 4.6, 5.0, CREAM, 2.6, 2)
			a.box(Vector3(2.0, 2.6, 2.6), Vector3(0.1, 0.1, 1.0), DWOOD)
			a.box(Vector3(2.0, 1.9, 3.0), Vector3(0.1, 1.0, 1.2), GOLD)  # hanging sign
			for x in [-2.0, 2.4]:
				a.cyl(Vector3(x, 0, 2.9), 0.45, 1.0, WOOD, 8)
			a.ball(Vector3(-1.0, 2.6, 2.5), 0.25, Color("#ffb84d"), 0.5)
			a.ball(Vector3(1.0, 2.6, 2.5), 0.25, Color("#ffb84d"), 0.5)
		"restaurant":
			a.house(5.2, 4.2, 3.4, PLASTER, 2.0)
			_awning(a, 5.2, 2.1, 2.5, Color("#2e8b57"), Color("#f4ead0"))
			for x in [-1.6, 1.6]:
				a.cyl(Vector3(x, 0, 3.8), 0.5, 0.75, Color("#f4ead0"), 8)  # tables
				a.cone(Vector3(x, 0.75, 3.8), 0.9, 1.4, Color("#e85d5d"), 6)  # parasols
		"bakery":
			a.house(4.4, 3.8, 3.2, Color("#fbe4c4"), 2.0)
			a.ball(Vector3(-1.4, 0.6, 2.6), 0.9, Color("#c9774a"), 0.0, 0.0, 0.8)  # oven
			a.box(Vector3(0.6, 2.4, 1.95), Vector3(1.2, 0.6, 0.1), Color("#e0a95c"))  # bread sign
		"flower_shop":
			a.house(4.2, 3.6, 3.0, Color("#fdf0f4"), 2.0)
			_awning(a, 4.2, 1.8, 2.2, Color("#6fbf73"), Color("#fdf0f4"))
			var fc := [Color("#ff7aa8"), Color("#ffd43b"), Color("#b197fc"), Color("#ff9f6a")]
			for i in 6:
				var x := -1.8 + i * 0.72
				a.box(Vector3(x, 0, 2.9), Vector3(0.6, 0.4, 0.6), DWOOD)
				a.ball(Vector3(x, 0.65, 2.9), 0.32, fc[i % 4])
		"toyshop":
			a.house(4.2, 3.6, 3.2, Color("#fff4c2"), 2.0)
			var bc := [Color("#ff4d6d"), Color("#4dabf7"), Color("#ffd43b"), Color("#8ef0c4")]
			for i in 4:
				a.box(Vector3(-1.5 + i, 3.4, 2.0), Vector3(0.04, 1.6, 0.04), Color.WHITE)
				a.ball(Vector3(-1.5 + i, 5.1, 2.0), 0.4, bc[i])
			a.box(Vector3(1.3, 0, 2.7), Vector3(0.8, 0.8, 0.8), Color("#ff4d6d"))
			a.box(Vector3(1.3, 0.8, 2.7), Vector3(0.5, 0.5, 0.5), Color("#4dabf7"))
		"tailor":
			a.house(4.0, 3.6, 3.2, PLASTER, 2.0)
			for i in 3:
				a.box(Vector3(-1.2 + i * 1.2, 1.4, 2.1), Vector3(0.7, 1.4, 0.05), [Color("#b197fc"), Color("#4dabf7"), Color("#ff7aa8")][i])
		"jeweler":
			a.house(3.8, 3.4, 3.0, Color("#f1ecff"), 1.9)
			a.crystal(Vector3(0, 2.4, 1.95), 0.3, 0.9, Color("#7fe7ff"))
		"post_office":
			a.house(4.6, 3.8, 3.2, CREAM, 2.0)
			a.box(Vector3(1.8, 0, 2.6), Vector3(0.5, 1.1, 0.4), Color("#2f6f9f"))
			a.box(Vector3(-2.6, 0, 2.0), Vector3(0.12, 4.5, 0.12), DWOOD)
			a.box(Vector3(-2.0, 3.8, 2.0), Vector3(1.1, 0.7, 0.05), TINT, 0.0, 1.0)
		"stables":
			a.box(Vector3.ZERO, Vector3(8, 3, 4), WOOD)
			a.gable(Vector3(0, 3, 0), 8, 4, 1.8, TINT, 1.0)
			for i in 4:
				a.box(Vector3(-3 + i * 2, 0.4, 2.05), Vector3(1.2, 1.6, 0.1), DWOOD)
			_fence(a, 9, 3.5, 4.5)
			a.box(Vector3(3.2, 0, 4.5), Vector3(1.2, 0.8, 1.0), Color("#e8cf6a"))  # hay
		"market":
			var tc := [Color("#e85d5d"), Color("#4dabf7"), Color("#ffd43b")]
			for i in 3:
				var x := -4.0 + i * 4.0
				for cx in [-1.2, 1.2]:
					for cz in [-1.0, 1.0]:
						a.box(Vector3(x + cx, 0, cz), Vector3(0.15, 2.0, 0.15), DWOOD)
				a.box(Vector3(x, 0, 0.9), Vector3(2.6, 0.9, 0.6), WOOD)
				a.pyramid(Vector3(x, 2.0, 0), 3.0, 2.6, 1.0, tc[i], 0.0)
				a.box(Vector3(x, 0.9, 0.9), Vector3(2.0, 0.25, 0.4), [Color("#ff9f6a"), Color("#8ef0c4"), Color("#f2a6c8")][i])
		"farm":
			a.box(Vector3.ZERO, Vector3(6, 4, 4.5), Color("#b03a2e"))
			a.gable(Vector3(0, 4, 0), 6, 4.5, 2.5, Color("#5c3b26"), 0.0)
			a.box(Vector3(0, 0, 2.3), Vector3(2.2, 2.6, 0.15), Color("#f4ead0"))
			a.cyl(Vector3(4.2, 0, -0.5), 1.3, 6, Color("#cfd6de"), 8)
			a.ball(Vector3(4.2, 6, -0.5), 1.3, Color("#8d867c"), 0.0, 0.0, 0.6)
			for i in 3:
				a.box(Vector3(-2 + i * 2.2, 0, 6.5), Vector3(1.8, 0.35, 3.5), [Color("#d9c25a"), Color("#6fa34a"), Color("#c9a24a")][i])
			_fence(a, 8, 2.5, 8.5)
		"windmill":
			a.cyl(Vector3.ZERO, 2.0, 7, Color("#f1e7d0"), 8, 1.4)
			a.cone(Vector3(0, 7, 0), 1.8, 2.2, TINT, 8, 0.0, 1.0)
			a.box(Vector3(0, 0, 1.9), Vector3(0.9, 1.6, 0.2), DARK)
			for i in 4:
				var ang := PI * 0.5 * i + 0.4
				var v := Vector3(cos(ang), sin(ang), 0)
				a.box(Vector3(0, 6.2, 2.1) + v * 2.6 - Vector3(0, 1.6 * 0.0, 0), Vector3(0.6 + absf(v.x) * 4.4, 0.6 + absf(v.y) * 4.4, 0.08), Color("#f4ead0"))
		"mine":
			a.pyramid(Vector3(0, 0, -2), 9, 7, 5, Color("#6d675e"), 0.0)
			a.box(Vector3(-1.2, 0, 1.0), Vector3(0.4, 2.8, 0.4), DWOOD)
			a.box(Vector3(1.2, 0, 1.0), Vector3(0.4, 2.8, 0.4), DWOOD)
			a.box(Vector3(0, 2.8, 1.0), Vector3(3.0, 0.4, 0.5), DWOOD)
			a.box(Vector3(0, 0, 0.6), Vector3(2.0, 2.6, 0.2), DARK)
			a.box(Vector3(2.4, 0, 2.6), Vector3(1.4, 0.8, 0.9), Color("#4a4a52"))  # cart
			a.box(Vector3(2.4, 0.8, 2.6), Vector3(1.2, 0.3, 0.7), Color("#c9a24a"), 0.0)  # ore
		"fishery":
			for cx in [-2.0, 2.0]:
				for cz in [-1.5, 1.5]:
					a.box(Vector3(cx, 0, cz), Vector3(0.3, 1.5, 0.3), DWOOD)
			a.box(Vector3(0, 1.5, 0), Vector3(5, 0.3, 4), WOOD)
			a.box(Vector3(0, 1.8, 0), Vector3(4, 2.4, 3), Color("#d9cdb3"))
			a.gable(Vector3(0, 4.2, 0), 4, 3, 1.6, TINT, 1.0)
			a.box(Vector3(0, 0, 4), Vector3(1.6, 0.6, 3.6), DWOOD)  # boat
		"lumberyard":
			a.house(5.0, 4.0, 3.2, WOOD, 2.0)
			for i in 4:
				a.cyl(Vector3(-2.0 + (i % 2) * 0.8, 0.4 + (i / 2) * 0.8, 3.6), 0.4, 3.4, Color("#a0703f"), 6)
			a.box(Vector3(2.0, 0, 3.6), Vector3(1.6, 1.0, 1.2), Color("#c9a26a"))
		"tower":
			a.cyl(Vector3.ZERO, 1.8, 8, DSTONE, 8)
			a.cyl(Vector3(0, 8, 0), 2.2, 1.0, STONE, 8)
			a.cone(Vector3(0, 9, 0), 2.4, 3.4, TINT, 8, 0.0, 1.0)
			a.box(Vector3(0, 5, 1.75), Vector3(0.5, 0.8, 0.1), Color("#ffd27a"), 0.5)
		"wall":
			a.box(Vector3.ZERO, Vector3(1.6, 4.2, 7.2), STONE)
			for z in [-2.6, -0.9, 0.9, 2.6]:
				a.box(Vector3(0, 4.2, z), Vector3(1.6, 0.8, 0.9), STONE)
		"gate":
			for z in [-3.2, 3.2]:
				a.cyl(Vector3(0, 0, z), 1.8, 7.5, DSTONE, 8)
				a.cone(Vector3(0, 7.5, z), 2.2, 3, TINT, 8, 0.0, 1.0)
			a.box(Vector3(0, 4.4, 0), Vector3(2.2, 2.0, 5.0), STONE)
			a.box(Vector3(0, 6.4, 0), Vector3(0.1, 2.0, 1.2), TINT, 0.0, 1.0)
		"dock":
			a.box(Vector3(0, 0.3, 4), Vector3(3, 0.3, 10), WOOD)
			for z in [0.0, 3.0, 6.0, 9.0]:
				for x in [-1.4, 1.4]:
					a.box(Vector3(x, -1.5, z), Vector3(0.3, 2.2, 0.3), DWOOD)
			a.box(Vector3(2.8, 0.1, 6), Vector3(1.6, 0.7, 4.2), DWOOD)  # moored boat
			a.box(Vector3(2.8, 0.8, 6), Vector3(0.12, 4, 0.12), DWOOD)
			a.box(Vector3(2.8, 2.6, 6.8), Vector3(0.06, 2.4, 1.6), Color("#f4ead0"))  # sail
		"lighthouse":
			for i in 5:
				a.cyl(Vector3(0, i * 2.6, 0), 1.9 - i * 0.18, 2.6, Color("#f5f5f5") if i % 2 == 0 else Color("#d64545"), 8, 1.9 - (i + 1) * 0.18)
			a.cyl(Vector3(0, 13, 0), 1.2, 1.6, Color("#fff3b0"), 8, -1.0, 1.0)
			a.cone(Vector3(0, 14.6, 0), 1.4, 1.6, Color("#2f2f2f"), 8)
		"obelisk":
			a.box(Vector3.ZERO, Vector3(3, 0.6, 3), STONE)
			a.box(Vector3(0, 0.6, 0), Vector3(1.4, 9, 1.4), Color("#2b2740"))
			a.box(Vector3(0, 2.0, 0.72), Vector3(0.4, 6, 0.05), Color("#8ef0c4"), 1.0)
			a.crystal(Vector3(0, 10.2, 0), 0.9, 2.2, Color("#8ef0c4"))
		"dungeon":
			a.box(Vector3(-2.4, 0, 0), Vector3(1.6, 5, 2), Color("#3d3a4a"))
			a.box(Vector3(2.4, 0, 0), Vector3(1.6, 5, 2), Color("#3d3a4a"))
			a.box(Vector3(0, 5, 0), Vector3(6.4, 1.2, 2.2), Color("#2e2b38"))
			a.box(Vector3(0, 0, 0.2), Vector3(3.2, 4.6, 0.2), Color("#8ef0c4"), 1.0)  # portal
			a.pyramid(Vector3(0, 6.2, 0), 3, 2, 2, Color("#2e2b38"), 0.0)
		"demon_castle":
			var dk := Color("#2a1f33")
			a.box(Vector3.ZERO, Vector3(16, 8, 14), dk)
			_crenel(a, 16, 14, 8, dk)
			a.box(Vector3(0, 8, -2), Vector3(8, 12, 7), Color("#352646"))
			a.windows(15, 1.55, 6, 3, 0.9)
			for x in [-8.0, 8.0]:
				for z in [-7.0, 7.0]:
					a.cyl(Vector3(x, 0, z), 2.0, 14, dk, 6, 1.2)
					a.cone(Vector3(x, 14, z), 1.6, 7, Color("#5a1f6a"), 6)
			a.cone(Vector3(0, 20, -2), 3.2, 12, Color("#5a1f6a"), 6)
			a.crystal(Vector3(0, 32, -2), 1.0, 3.5, Color("#ff3df2"))
			a.box(Vector3(0, 0, 7.0), Vector3(4, 6, 0.4), Color("#ff3df2"), 1.0)  # gate glow
		"colosseum":
			for i in 16:
				var ang := TAU * i / 16
				var p := Vector3(cos(ang), 0, sin(ang)) * 9.5
				a.box(p, Vector3(2.4, 6, 2.4), STONE)
				a.box(p + Vector3(0, 6, 0), Vector3(2.0, 1.6, 2.0), DSTONE)
			a.cyl(Vector3.ZERO, 8, 0.2, Color("#d9c7a0"), 16)
			a.box(Vector3(0, 7.6, -9.5), Vector3(0.12, 3, 0.12), DWOOD)
			a.box(Vector3(0.8, 9.6, -9.5), Vector3(1.6, 1.0, 0.06), TINT, 0.0, 1.0)
		"spire":
			a.cyl(Vector3.ZERO, 9, 1.4, Color("#cfc3ea"), 12)
			a.cyl(Vector3(0, 1.4, 0), 3.4, 22, Color("#e9e1ff"), 8, 2.6)
			for i in 6:
				var ang := TAU * i / 6
				var p := Vector3(cos(ang), 0, sin(ang)) * 6.5
				a.cyl(p + Vector3(0, 1.4, 0), 1.0, 7, Color("#e9e1ff"), 8)
				a.cone(p + Vector3(0, 8.4, 0), 1.4, 2.6, Color("#7b4dff"), 8)
			a.cone(Vector3(0, 23.4, 0), 3.6, 9, Color("#7b4dff"), 8)
			a.crystal(Vector3(0, 32, 0), 1.2, 4, Color("#c9a7ff"))
			a.windows(8, 2.9, 3, 2, 0.8)
		"fountain":
			a.cyl(Vector3.ZERO, 3.0, 0.8, STONE, 12)
			a.cyl(Vector3(0, 0.8, 0), 2.6, 0.05, Color("#5aa9e6"), 12, -1.0, 0.0)
			a.cyl(Vector3(0, 0.8, 0), 0.5, 2.2, STONE, 8)
			a.ball(Vector3(0, 3.4, 0), 0.7, Color("#a97bff"), 1.0)
		_:
			a.house(4, 3.4, 3, PLASTER, 2)
	return a.commit()


static func prop(type: String) -> ArrayMesh:
	var a := A.new()
	match type:
		"pine":
			a.cyl(Vector3.ZERO, 0.3, 1.4, DWOOD, 5)
			a.cone(Vector3(0, 1.0, 0), 1.8, 2.8, Color("#2f6b4f"), 7)
			a.cone(Vector3(0, 2.6, 0), 1.4, 2.4, Color("#3a7d5a"), 7)
			a.cone(Vector3(0, 4.0, 0), 0.9, 2.0, Color("#468f66"), 7)
		"oak":
			a.cyl(Vector3.ZERO, 0.35, 2.0, DWOOD, 5)
			a.ball(Vector3(0, 3.0, 0), 1.9, Color("#5a9a4a"))
			a.ball(Vector3(0.9, 2.6, 0.4), 1.2, Color("#4f8f42"))
		"goldtree":
			a.cyl(Vector3.ZERO, 0.35, 2.0, DWOOD, 5)
			a.ball(Vector3(0, 3.0, 0), 2.0, Color("#f2c94c"))
			a.ball(Vector3(-0.8, 2.6, 0.5), 1.2, Color("#e9b83a"))
		"palm":
			for i in 4:
				a.cyl(Vector3(i * 0.25, i * 1.1, 0), 0.28 - i * 0.03, 1.1, Color("#9a7348"), 5)
			for i in 5:
				var ang := TAU * i / 5
				a.box(Vector3(1.0 + cos(ang) * 1.3, 4.3, sin(ang) * 1.3), Vector3(absf(cos(ang)) * 2.2 + 0.4, 0.12, absf(sin(ang)) * 2.2 + 0.4), Color("#4caf50"))
		"deadtree":
			a.cyl(Vector3.ZERO, 0.3, 3.2, Color("#3b302b"), 5, 0.12)
			a.box(Vector3(0.6, 2.0, 0), Vector3(1.4, 0.15, 0.15), Color("#3b302b"))
			a.box(Vector3(-0.4, 2.6, 0.2), Vector3(0.15, 0.15, 1.2), Color("#3b302b"))
		"rock":
			a.ball(Vector3(0, 0.3, 0), 0.8, Color("#8d867c"), 0.0, 0.0, 0.7)
		"boulder":
			a.ball(Vector3(0, 0.6, 0), 1.6, Color("#6d675e"), 0.0, 0.0, 0.75)
			a.ball(Vector3(1.0, 0.3, 0.6), 0.8, Color("#7d776d"), 0.0, 0.0, 0.7)
		"crystal":
			a.crystal(Vector3.ZERO, 0.6, 3.0, Color("#c9a7ff"))
			a.crystal(Vector3(0.7, 0, 0.3), 0.4, 1.8, Color("#9fe6ff"))
			a.crystal(Vector3(-0.5, 0, -0.4), 0.35, 1.4, Color("#e7c6ff"))
		"flowers":
			var fc := [Color("#ff7aa8"), Color("#ffd43b"), Color("#b197fc"), Color("#ffffff")]
			for i in 6:
				var ang := TAU * i / 6
				a.cyl(Vector3(cos(ang) * 0.7, 0, sin(ang) * 0.7), 0.05, 0.5, LEAF, 4)
				a.ball(Vector3(cos(ang) * 0.7, 0.55, sin(ang) * 0.7), 0.2, fc[i % 4])
		"reeds":
			for i in 5:
				a.box(Vector3(-0.6 + i * 0.3, 0, (i % 2) * 0.3), Vector3(0.08, 1.6 + (i % 3) * 0.4, 0.08), Color("#7a9a4a"))
		"lily":
			a.cyl(Vector3(0, 0.02, 0), 0.9, 0.05, Color("#4caf50"), 7)
			a.ball(Vector3(0.2, 0.15, 0.1), 0.18, Color("#ff9fc8"))
		"mushroom":
			a.cyl(Vector3.ZERO, 0.2, 0.9, Color("#e9e4da"), 6)
			a.ball(Vector3(0, 1.0, 0), 0.6, Color("#5fe0c0"), 1.0, 0.0, 0.5)
		"bonespike":
			a.cone(Vector3.ZERO, 0.45, 2.6, Color("#e7e1d3"), 6)
		"lavarock":
			a.ball(Vector3(0, 0.4, 0), 1.0, Color("#2c2427"), 0.0, 0.0, 0.7)
			a.box(Vector3(0, 0.75, 0), Vector3(0.9, 0.1, 0.2), Color("#ff6a1a"), 1.0)
		"demonspike":
			a.cone(Vector3.ZERO, 0.7, 4.0, Color("#2a1f33"), 5)
			a.crystal(Vector3(0, 3.6, 0), 0.2, 0.8, Color("#ff3df2"))
	return a.commit()


static func _crenel(a: Architect, w: float, d: float, y: float, col: Color) -> void:
	var n := int(w / 1.6)
	for i in n:
		var x := -w / 2.0 + w * (i + 0.5) / n
		a.box(Vector3(x, y, d / 2.0 - 0.3), Vector3(0.8, 0.7, 0.6), col)
		a.box(Vector3(x, y, -d / 2.0 + 0.3), Vector3(0.8, 0.7, 0.6), col)


static func _awning(a: Architect, w: float, depth: float, y: float, c1: Color, c2: Color) -> void:
	var n := 6
	for i in n:
		a.box(Vector3(-w / 2.0 + w * (i + 0.5) / n, y, 1.8 + depth / 2.0 - 0.2), Vector3(w / n, 0.15, depth), c1 if i % 2 == 0 else c2)


static func _fence(a: Architect, w: float, z0: float, z1: float) -> void:
	for x in [-w / 2.0, w / 2.0]:
		a.box(Vector3(x, 0, (z0 + z1) / 2.0), Vector3(0.12, 0.9, z1 - z0), DWOOD)
	a.box(Vector3(0, 0, z1), Vector3(w, 0.9, 0.12), DWOOD)
