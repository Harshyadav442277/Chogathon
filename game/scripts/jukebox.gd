class_name Jukebox
extends AudioStreamPlayer
## Background music: the original theme (built in, starts instantly), then a playlist of licensed tracks that
## the site serves from /music/*.mp3. They are streamed one at a time (the next one is fetched while the
## current one plays), so they add nothing to the game download. Credits are shown when a track starts.

signal track_changed(title: String, credit: String)

const TRACKS := [
	{"title": "Over the Floating Citadel", "credit": "Original theme (ChogSekai)", "res": "res://assets/music/monadia_theme.wav"},
	{"title": "Guardians", "credit": "Aylex - Guardians (freetouse.com)", "url": "/music/guardians.mp3"},
	{"title": "Glorious", "credit": "Aylex - Glorious (freetouse.com)", "url": "/music/glorious.mp3"},
	{"title": "There Be Dragons", "credit": "Pufino - There Be Dragons (freetouse.com)", "url": "/music/there_be_dragons.mp3"},
	{"title": "Dark Frequency", "credit": "Aylex - Dark Frequency (freetouse.com)", "url": "/music/dark_frequency.mp3"},
]

var _i := -1
var _cache := {}  # track index -> AudioStream
var _loading := {}


func _ready() -> void:
	volume_db = -9.0
	finished.connect(next)


## Starts the playlist (call from a user gesture: browsers only allow audio after one).
func start() -> void:
	if _i < 0:
		_play(0)


func next() -> void:
	_play((_i + 1) % TRACKS.size())


func _play(i: int) -> void:
	_i = i
	var s: AudioStream = _cache.get(i)
	if s == null:
		s = await _load(i)
	if _i != i:
		return  # skipped while loading
	if s == null:  # could not fetch it: skip ahead (the built-in theme always works)
		if i != 0:
			_play((i + 1) % TRACKS.size())
		return
	stream = s
	stream_paused = false
	play()
	track_changed.emit(str(TRACKS[i]["title"]), str(TRACKS[i]["credit"]))
	_load((i + 1) % TRACKS.size())  # prefetch the next track while this one plays


func _load(i: int) -> AudioStream:
	if _cache.has(i):
		return _cache[i]
	var t: Dictionary = TRACKS[i]
	if t.has("res"):
		var wav := (load(str(t["res"])) as AudioStreamWAV).duplicate() as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_DISABLED  # play once, then the playlist moves on
		_cache[i] = wav
		return wav
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
	_cache[i] = mp3
	return mp3
