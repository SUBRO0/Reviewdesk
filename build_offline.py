"""Build the double-clickable browser edition using only Python's standard library."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parent
assets = root / "dist"
html = (assets / "index.html").read_text(encoding="utf-8")
style = (assets / "style.css").read_text(encoding="utf-8")
engine = (assets / "engine.mjs").read_text(encoding="utf-8")
app = (assets / "app.mjs").read_text(encoding="utf-8")
icon = base64.b64encode((assets / "mark.svg").read_bytes()).decode("ascii")
html = html.replace("./mark.svg", "data:image/svg+xml;base64," + icon)
html = html.replace('<link rel="stylesheet" href="./style.css">', "<style>" + style + "</style>")
app = app.replace('import {review,samples} from "./engine.mjs";', "", 1)
script = engine.replace("export const ", "const ").replace("export function ", "function ") + "\n" + app
html = html.replace('<script type="module" src="./app.mjs"></script>',
                    '<script type="module">\n' + script + '\n</script>')
(root / "Open-Reviewdesk.html").write_text(html, encoding="utf-8")
