extends Node
## Live world state polled from the server. Scenes listen to the signals.

signal positions_updated
signal selection_changed(chog_id: int)

const POLL_SECONDS := 10.0
const HOUSE_COLORS: Array[Color] = [Color("#ff4d6d"), Color("#4dabf7"), Color("#b197fc"), Color("#ffd43b")]
const HOUSE_NAMES: Array[String] = ["House Laser", "House Teardrop", "House Glass", "House Moonbeam"]

var world: Dictionary = {}          # static map: regions, pois, roads
var positions: Dictionary = {}      # tick, ids, names, x, z, house, poi, mood, bubbles
var selected: int = -1
var ids := PackedInt32Array()     # JSON numbers arrive as floats; keep an int copy for lookups
var _timer: Timer


func _ready() -> void:
	world = _load_local_json("res://data/world.json")
	_timer = Timer.new()
	_timer.wait_time = POLL_SECONDS
	_timer.timeout.connect(refresh)
	add_child(_timer)
	_timer.start()
	refresh()


func refresh() -> void:
	var data = await Api.get_json_if_changed("/api/world/positions")  # unchanged between sim ticks -> skipped
	if data is Dictionary and data.has("ids"):
		positions = data
		ids = PackedInt32Array(data["ids"])
		positions_updated.emit()


func select(chog_id: int) -> void:
	selected = chog_id
	selection_changed.emit(chog_id)


func index_of(chog_id: int) -> int:
	return ids.find(chog_id)


func _load_local_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("missing %s" % path)
		return {}
	var parsed = JSON.parse_string(f.get_as_text())
	return parsed if parsed is Dictionary else {}
