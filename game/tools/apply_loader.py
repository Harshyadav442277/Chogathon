"""Copy game/web/loader.html (the adventure-style web loading screen, link-preview tags) into the Web export
preset's html/head_include in game/export_presets.cfg. Run after editing loader.html:
    python game/tools/apply_loader.py
The HTML must not contain double quotes (the preset stores it as one quoted string).
"""
import os
import re

here = os.path.dirname(__file__)
html = open(os.path.join(here, "..", "web", "loader.html"), encoding="utf-8").read()
assert '"' not in html, "loader.html must use single quotes only"
one_line = " ".join(line.strip() for line in html.splitlines() if line.strip())
p = os.path.join(here, "..", "export_presets.cfg")
cfg = open(p, encoding="utf-8").read()
cfg, n = re.subn(r'^html/head_include=".*"$', lambda m: 'html/head_include="' + one_line + '"', cfg, count=1, flags=re.M)
assert n == 1, "html/head_include not found"
open(p, "w", encoding="utf-8").write(cfg)
print("head_include updated:", len(one_line), "chars")
