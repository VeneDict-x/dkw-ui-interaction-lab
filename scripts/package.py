"""Package reviewed source and dist without dependencies, secrets or temporary files."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / "artifacts"
out.mkdir(exist_ok=True)
files = ["AGENTS.md", "README.md", "REPORT.md", ".gitignore", "index.html",
         "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
         "playwright.config.ts", ".prettierrc.json"]
dirs = ["src", "tests", "scripts", "docs", "dist"]
source = out / "DKW_UI_INTERACTION_LAB_source.zip"
static = out / "DKW_UI_INTERACTION_LAB_static.zip"

for f in files:
    if not (root / f).is_file():
        raise RuntimeError(f"Required recovery file missing: {f}")
if not (root / "dist/index.html").is_file():
    raise RuntimeError("Run npm run build first")

with zipfile.ZipFile(source, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(root / f, "DKW_UI_INTERACTION_LAB/" + f)
    for directory in dirs:
        for p in sorted((root / directory).rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc":
                z.write(p, "DKW_UI_INTERACTION_LAB/" + p.relative_to(root).as_posix())
with zipfile.ZipFile(static, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted((root / "dist").rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(root / "dist").as_posix())
for p in [source, static]:
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        assert not any("node_modules" in n or "/.env" in n for n in z.namelist())
    print(json.dumps({"file": str(p), "bytes": p.stat().st_size,
                      "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}))
