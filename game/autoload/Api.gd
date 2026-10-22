extends Node
## Thin JSON client for the ChogSekai server (Next.js). Same origin when served from /play.

const DEV_BASE := "http://localhost:3000"

var base_url: String = DEV_BASE


func _ready() -> void:
	if OS.has_feature("web"):
		var origin = JavaScriptBridge.eval("window.location.origin", true)
		if typeof(origin) == TYPE_STRING and origin != "":
			base_url = origin
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--api="):  # dev: point a native run at another server, e.g. the deployed site
			base_url = arg.trim_prefix("--api=")


## GET a JSON endpoint. Returns the parsed Variant, or null on any failure.
func get_json(path: String) -> Variant:
	var req := HTTPRequest.new()
	req.timeout = 30.0
	add_child(req)
	var err := req.request(base_url + path, ["Accept: application/json"])
	if err != OK:
		req.queue_free()
		push_warning("GET %s failed to start: %s" % [path, error_string(err)])
		return null
	var res: Array = await req.request_completed
	req.queue_free()
	var code: int = res[1]
	if res[0] != HTTPRequest.RESULT_SUCCESS or code < 200 or code >= 300:
		push_warning("GET %s -> result %s, HTTP %s" % [path, res[0], code])
		return null
	return JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())


## Returned by get_json_if_changed() when the server says nothing changed since the last call.
const NOT_MODIFIED := &"not_modified"
var _etags := {}  # path -> last ETag


## GET a polled endpoint with its last ETag. Returns NOT_MODIFIED when the data is unchanged (HTTP 304 or
## the same ETag), so callers skip the download, the JSON parse and their own reprocessing; else the parsed
## Variant, or null on failure.
func get_json_if_changed(path: String) -> Variant:
	var req := HTTPRequest.new()
	req.timeout = 30.0
	add_child(req)
	var headers := PackedStringArray(["Accept: application/json"])
	if _etags.has(path):
		headers.append("If-None-Match: " + str(_etags[path]))
	var err := req.request(base_url + path, headers)
	if err != OK:
		req.queue_free()
		return null
	var res: Array = await req.request_completed
	req.queue_free()
	var code: int = res[1]
	if code == 304:
		return NOT_MODIFIED
	if res[0] != HTTPRequest.RESULT_SUCCESS or code < 200 or code >= 300:
		push_warning("GET %s -> result %s, HTTP %s" % [path, res[0], code])
		return null
	for h in (res[2] as PackedStringArray):
		if h.to_lower().begins_with("etag:"):
			var tag := h.substr(5).strip_edges()
			if _etags.get(path, "") == tag:
				return NOT_MODIFIED  # the browser revalidated from its own cache: same data
			_etags[path] = tag
	return JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())


## GET raw bytes (images). Returns an empty array on failure.
func get_bytes(path: String) -> PackedByteArray:
	var req := HTTPRequest.new()
	req.timeout = 30.0
	add_child(req)
	if req.request(base_url + path) != OK:
		req.queue_free()
		return PackedByteArray()
	var res: Array = await req.request_completed
	req.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS or int(res[1]) != 200:
		return PackedByteArray()
	return res[3]


## POST JSON. Returns {status, data}.
func post_json(path: String, body: Dictionary) -> Dictionary:
	var req := HTTPRequest.new()
	req.timeout = 30.0
	add_child(req)
	var err := req.request(base_url + path, ["Content-Type: application/json"], HTTPClient.METHOD_POST, JSON.stringify(body))
	if err != OK:
		req.queue_free()
		return {"status": 0, "data": null}
	var res: Array = await req.request_completed
	req.queue_free()
	return {"status": res[1], "data": JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())}
