class_name Jukebox
extends AudioStreamPlayer
## Background music that follows the map: each region has its own track, picked by the region whose centre is
## nearest to the camera's focus, with a crossfade when you cross into another one. The title screen has its
## own track. The original theme is built in; the licensed tracks are served by the site at /music/*.mp3 and
## streamed on first use (they add nothing to the game download). "Next" plays another track until the
## camera enters a new region.

signal track_changed(title: String, credit: String)

const TRACKS := [
	{"title": "Over the Floating Citadel", "credit": "Original theme (ChogSekai)", "res": "res://assets/music/monadia_theme.wav"},
	{"title": "Guardians", "credit": "Aylex - Guardians (freetouse.com)", "url": "/music/guardians.mp3"},
	{"title": "Glorious", "credit": "Aylex - Glorious (freetouse.com)", "url": "/music/glorious.mp3"},
	{"title": "There Be Dragons", "credit": "Pufino - There Be Dragons (freetouse.com)", "url": "/music/there_be_dragons.mp3"},
	{"title": "Dark Frequency", "credit": "Aylex - Dark Frequency (freetouse.com)", "url": "/music/dark_frequency.mp3"},
]
const TITLE_TRACK := 2  # Glorious
## Region id -> track: calm heartland, heroic frontier, wild seas and caverns, the dark south.
const REGION_TRACK := {
	"capital": 0, "dreamveil": 0, "frogsong": 0,
	"emberforge": 1, "prism": 1, "tidecry": 1,
	"rugcoast": 3, "hollow": 3,
	"wastes": 4, "demon": 4,
}
const VOLUME_DB := -9.0
const FADE := 1.6

var rig: Node3D  ## the camera rig; its position is the point the camera looks at
var region := ""
var _i := -1
var _want := -1
var _cache := {}  # track index -> AudioStream
var _loading := {}
var _on := false
var _fade: Tween
var _regions: Array = []


func _ready() -> void:
	volume_db = VOLUME_DB
	_regions = GameState.world.get("regions", [])
	_load(TITLE_TRACK)  # fetch the title track right away so it is ready for the first click
	var t := Timer.new()
	t.wait_time = 1.0
	t.timeout.connect(_check_region)
	add_child(t)
	t.start()


## Title screen music (call from a user gesture: browsers only allow audio after one).
func title() -> void:
	_on = true
	_switch(TITLE_TRACK)


## Leaves the title screen: from now on the region decides.
func start() -> void:
	_on = true
	region = ""
	_check_region()


func next() -> void:
	_on = true
	stream_paused = false
	_switch((maxi(_i, _want) + 1) % TRACKS.size())


func _check_region() -> void:
	if not _on or rig == null or _regions.is_empty() or get_tree().get_nodes_in_group("title_screen").size() > 0:
		return
	var best := ""
	var best_d := INF
	for r in _regions:
		var d := Vector2(float(r["x"]) - rig.position.x, float(r["z"]) - rig.position.z).length_squared()
		if d < best_d:
			best_d = d
			best = str(r["id"])
	if best != region:
		region = best
		_switch(int(REGION_TRACK.get(best, 0)))


func _switch(i: int) -> void:
	if i == _i and playing:
		return
	_want = i
	var s: AudioStream = _cache.get(i)
	if s == null:
		s = await _load(i)
	if _want != i:
		return  # something else was asked for while this loaded
	if s == null:
		s = await _load(0)  # could not fetch it: the built-in theme always works
		i = 0
	if _i == i and playing:
		return
	if playing:
		await _fade_to(-40.0)
		if _want != i and _want != -1:
			return
	_i = i
	var muted := stream_paused  # the HUD's Music button pauses; a region change keeps it paused
	stream = s
	volume_db = -40.0
	play()
	stream_paused = muted
	_fade_to(VOLUME_DB)
	track_changed.emit(str(TRACKS[i]["title"]), str(TRACKS[i]["credit"]))


func _fade_to(db: float) -> void:
	if _fade and _fade.is_valid():
		_fade.kill()
	_fade = create_tween()
	_fade.tween_property(self, "volume_db", db, FADE)
	await _fade.finished


func _load(i: int) -> AudioStream:
	if _cache.has(i):
		return _cache[i]
	var t: Dictionary = TRACKS[i]
	if t.has("res"):
		_cache[i] = load(str(t["res"]))  # imported with a seamless loop
		return _cache[i]
	if _loading.has(i):
		while _loading.has(i):
			await get_tree().process_frame
		return _cache.get(i)
	_loading[i] = true
	var bytes := await Api.get_bytes(str(t["url"]), 120.0)
	_loading.erase(i)
	if bytes.is_empty():
		return null
	var mp3 := AudioStreamMP3.new()
	mp3.data = bytes
	mp3.loop = true  # a region's track repeats while you stay there
	_cache[i] = mp3
	return mp3
