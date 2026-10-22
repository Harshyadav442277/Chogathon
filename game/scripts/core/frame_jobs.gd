class_name FrameJobs
extends Node
## Frame-budgeted job queue: spreads heavy work (mesh builds, LOD refreshes, crowd updates, story
## processing) across frames so no single frame spikes. Each frame, queued jobs run in priority order
## until `budget_ms` is spent; whatever is left waits for the next frame. Single-threaded on purpose:
## the web build has no threads, so time-slicing is the way to keep frames smooth.
##
## Usage from any script (main.gd adds one instance):
##   FrameJobs.add(func() -> void: build_chunk(c), FrameJobs.PRIO_HIGH, "terrain:%d" % k)
##   A job that returns `true` is re-queued (for work done in slices across several frames).
##   A key de-duplicates: adding a job whose key is already queued does nothing.

const PRIO_HIGH := 0     # visible now (e.g. a chunk under the camera)
const PRIO_NORMAL := 1
const PRIO_IDLE := 2     # prefetch / pre-warm; only runs when the frame has time to spare

static var instance: FrameJobs

## Milliseconds of job work allowed per frame. Lowered automatically by AdaptiveQuality on slow devices.
var budget_ms := 4.0
## Idle jobs only run if the frame so far (delta) left headroom under this frame time.
var idle_frame_ms := 18.0

var _queues: Array = [[], [], []]
var _keys := {}
var _stats_jobs := 0
var _stats_us := 0


func _enter_tree() -> void:
	instance = self
	process_priority = -100  # before other nodes' _process, so their per-frame work sees fresh results


func _exit_tree() -> void:
	if instance == self:
		instance = null


## Queue `job` (a Callable). Returns false if a job with the same key is already waiting.
static func add(job: Callable, priority := PRIO_NORMAL, key := "") -> bool:
	if instance == null:
		job.call()  # no scheduler (e.g. a tool or test): run inline
		return true
	return instance._add(job, priority, key)


static func pending(key: String) -> bool:
	return instance != null and instance._keys.has(key)


static func queued() -> int:
	return 0 if instance == null else instance._queues[0].size() + instance._queues[1].size() + instance._queues[2].size()


func _add(job: Callable, priority: int, key: String) -> bool:
	if key != "":
		if _keys.has(key):
			return false
		_keys[key] = true
	(_queues[clampi(priority, 0, 2)] as Array).append([job, key])
	return true


func _process(delta: float) -> void:
	var start := Time.get_ticks_usec()
	var limit := int(budget_ms * 1000.0)
	for p in 3:
		if p == PRIO_IDLE and delta * 1000.0 > idle_frame_ms:
			break
		var q: Array = _queues[p]
		while not q.is_empty():
			if Time.get_ticks_usec() - start >= limit:
				_stats_us += Time.get_ticks_usec() - start
				return
			var item: Array = q.pop_front()
			var job: Callable = item[0]
			var key: String = item[1]
			var again = job.call() if job.is_valid() else false
			_stats_jobs += 1
			if again is bool and again:
				q.append(item)  # sliced job: continue next time
			elif key != "":
				_keys.erase(key)
	_stats_us += Time.get_ticks_usec() - start


## Jobs run and microseconds spent since the last call (for the dev profiler).
func take_stats() -> Vector2i:
	var s := Vector2i(_stats_jobs, _stats_us)
	_stats_jobs = 0
	_stats_us = 0
	return s
