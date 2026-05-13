#!/usr/bin/env python3
"""
BL2 Save Editor — interactive setup wizard.

Walks a fresh user through:
  1. Python version check (3.8+ required)
  2. Optional virtual environment creation
  3. Dependency install via pip
  4. Auto-detect or prompt for config.json paths
     (BL2 install, save folder, borderlands2-tool, Gibbed data)
  5. Optional clone of the external borderlands2-tool library
  6. Smoke-test the install
  7. Optional launch of the editor

Cross-platform (Windows / macOS / Linux). Idempotent — re-running picks up
where the previous run left off without clobbering existing config.

Usage:
    python setup_wizard.py            # interactive
    python setup_wizard.py --yes      # accept all auto-detected defaults
    python setup_wizard.py --no-venv  # skip venv creation
    python setup_wizard.py --launch   # launch the app at the end without asking
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Terminal colors (fall back gracefully)
# ---------------------------------------------------------------------------

_supports_color = (
    sys.stdout.isatty()
    and (platform.system() != "Windows" or os.environ.get("WT_SESSION") or "ANSICON" in os.environ)
)

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _supports_color else text

def green(s: str) -> str: return _c("32", s)
def yellow(s: str) -> str: return _c("33", s)
def red(s: str) -> str: return _c("31", s)
def cyan(s: str) -> str: return _c("36", s)
def bold(s: str) -> str: return _c("1", s)
def dim(s: str) -> str: return _c("2", s)


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
EXAMPLE_PATH = ROOT / "config.example.json"
REQUIREMENTS_PATH = ROOT / "requirements.txt"
BL2_TOOL_DIR = ROOT / "borderlands2-tool"
VENV_DIR = ROOT / ".venv"

REQUIRED_PY = (3, 8)


# ---------------------------------------------------------------------------
# Step helpers
# ---------------------------------------------------------------------------

def banner() -> None:
    print()
    print(bold(cyan("╔══════════════════════════════════════════════════╗")))
    print(bold(cyan("║         BL2 Save Editor — Setup Wizard           ║")))
    print(bold(cyan("╚══════════════════════════════════════════════════╝")))
    print()

def step(n: int, total: int, title: str) -> None:
    print()
    print(bold(f"[{n}/{total}] {title}"))

def ok(msg: str) -> None:
    print(f"  {green('✓')} {msg}")

def warn(msg: str) -> None:
    print(f"  {yellow('⚠')} {msg}")

def err(msg: str) -> None:
    print(f"  {red('✗')} {msg}")

def info(msg: str) -> None:
    print(f"  {dim('·')} {msg}")

def ask(prompt: str, default: str = "", yes: bool = False) -> str:
    if yes and default:
        print(f"  {prompt} {dim(f'[{default}] (auto-accepted)')}")
        return default
    suffix = f" [{default}]" if default else ""
    try:
        resp = input(f"  {prompt}{suffix}: ").strip()
    except EOFError:
        return default
    return resp or default

def confirm(prompt: str, default_yes: bool = True, yes: bool = False) -> bool:
    if yes:
        print(f"  {prompt} {dim(('[Y/n]' if default_yes else '[y/N]') + ' (auto-accepted)')}")
        return default_yes
    suffix = "[Y/n]" if default_yes else "[y/N]"
    try:
        resp = input(f"  {prompt} {suffix} ").strip().lower()
    except EOFError:
        return default_yes
    if not resp:
        return default_yes
    return resp in ("y", "yes")


# ---------------------------------------------------------------------------
# Step 1 — Python version
# ---------------------------------------------------------------------------

def step_python() -> bool:
    v = sys.version_info
    if (v.major, v.minor) >= REQUIRED_PY:
        ok(f"Python {v.major}.{v.minor}.{v.micro} (required: {REQUIRED_PY[0]}.{REQUIRED_PY[1]}+)")
        return True
    err(f"Python {v.major}.{v.minor}.{v.micro} found, but {REQUIRED_PY[0]}.{REQUIRED_PY[1]}+ is required.")
    info("Install a newer Python from https://python.org and re-run this wizard.")
    return False


# ---------------------------------------------------------------------------
# Step 2 — Virtual environment
# ---------------------------------------------------------------------------

def step_venv(yes: bool, skip: bool) -> Path | None:
    if skip:
        info("Skipping virtual environment (per --no-venv).")
        return None
    if VENV_DIR.exists():
        ok(f"Existing venv detected at {VENV_DIR.relative_to(ROOT)}")
        return VENV_DIR
    if not confirm(f"Create a virtual environment at .venv? (recommended)", default_yes=True, yes=yes):
        info("Skipping venv. Dependencies will install into system Python.")
        return None
    info(f"Creating {VENV_DIR.relative_to(ROOT)}...")
    try:
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    except subprocess.CalledProcessError as e:
        err(f"venv creation failed: {e}")
        return None
    ok("Virtual environment created.")
    return VENV_DIR


def _python_in_venv(venv: Path | None) -> str:
    if venv is None:
        return sys.executable
    if platform.system() == "Windows":
        return str(venv / "Scripts" / "python.exe")
    return str(venv / "bin" / "python")


# ---------------------------------------------------------------------------
# Step 3 — Dependencies
# ---------------------------------------------------------------------------

def step_deps(py: str) -> bool:
    if not REQUIREMENTS_PATH.exists():
        warn(f"{REQUIREMENTS_PATH.name} not found — skipping pip install.")
        return True
    info(f"Installing from {REQUIREMENTS_PATH.name}...")
    try:
        subprocess.run([py, "-m", "pip", "install", "--upgrade", "pip"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run([py, "-m", "pip", "install", "-r", str(REQUIREMENTS_PATH)], check=True)
    except subprocess.CalledProcessError as e:
        err(f"pip install failed: {e}")
        return False
    ok("Dependencies installed.")
    return True


# ---------------------------------------------------------------------------
# Step 4 — Configure
# ---------------------------------------------------------------------------

def _detect_steam_dir() -> str:
    candidates: list[str] = []
    if platform.system() == "Windows":
        candidates = [
            os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Steam", "steamapps", "common", "Borderlands 2"),
            os.path.join(os.environ.get("PROGRAMFILES", ""), "Steam", "steamapps", "common", "Borderlands 2"),
        ]
    elif platform.system() == "Linux":
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, ".steam", "steam", "steamapps", "common", "Borderlands 2"),
            os.path.join(home, ".local", "share", "Steam", "steamapps", "common", "Borderlands 2"),
        ]
    elif platform.system() == "Darwin":
        home = os.path.expanduser("~")
        candidates = [os.path.join(home, "Library", "Application Support", "Steam", "steamapps", "common", "Borderlands 2")]
    for c in candidates:
        if c and os.path.isdir(c):
            return c
    return ""

def _detect_save_dir() -> str:
    if platform.system() == "Windows":
        docs = os.path.join(os.environ.get("USERPROFILE", ""), "Documents", "My Games", "Borderlands 2", "WillowGame", "SaveData")
        if os.path.isdir(docs):
            for entry in sorted(os.listdir(docs)):
                subdir = os.path.join(docs, entry)
                if os.path.isdir(subdir) and entry.isdigit():
                    return subdir
    elif platform.system() == "Linux":
        home = os.path.expanduser("~")
        docs = os.path.join(home, ".local", "share", "aspyr-media", "borderlands 2", "willowgame", "savedata")
        if os.path.isdir(docs):
            for entry in sorted(os.listdir(docs)):
                subdir = os.path.join(docs, entry)
                if os.path.isdir(subdir):
                    return subdir
    return ""


def step_config(yes: bool) -> dict:
    existing: dict = {}
    if CONFIG_PATH.exists():
        try:
            existing = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            ok(f"Found existing {CONFIG_PATH.name}; missing fields will be auto-detected.")
        except json.JSONDecodeError:
            warn(f"{CONFIG_PATH.name} exists but is malformed; rebuilding from scratch.")
            existing = {}

    detected = {
        "game_dir": _detect_steam_dir(),
        "save_dir": _detect_save_dir(),
        "borderlands2_tool_dir": str(BL2_TOOL_DIR) if (BL2_TOOL_DIR / "borderlands" / "savefile.py").exists() else "",
        "gibbed_dir": "",
        "backup_generations": 5,
    }

    cfg: dict = {}
    for key in ("game_dir", "save_dir", "borderlands2_tool_dir", "gibbed_dir"):
        current = existing.get(key) or detected.get(key) or ""
        label = {
            "game_dir": "Borderlands 2 install directory",
            "save_dir": "Save folder (with .sav files)",
            "borderlands2_tool_dir": "apocalyptech/borderlands2 path (leave blank to clone next step)",
            "gibbed_dir": "Gibbed data folder (leave blank to skip; weapon codes will be unavailable)",
        }[key]
        cfg[key] = ask(label, default=current, yes=yes)

    cfg["backup_generations"] = existing.get("backup_generations", detected["backup_generations"])

    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    ok(f"Wrote {CONFIG_PATH.name}")
    return cfg


# ---------------------------------------------------------------------------
# Step 5 — Clone borderlands2-tool if missing
# ---------------------------------------------------------------------------

BL2_TOOL_REPO = "https://github.com/apocalyptech/borderlands2.git"

def step_bl2_tool(cfg: dict, yes: bool) -> dict:
    tool_dir = cfg.get("borderlands2_tool_dir") or ""
    if tool_dir and os.path.isfile(os.path.join(tool_dir, "borderlands", "savefile.py")):
        ok(f"borderlands2-tool ready at {tool_dir}")
        return cfg
    if shutil.which("git") is None:
        warn("git not on PATH — can't auto-clone apocalyptech/borderlands2.")
        info("Clone manually:")
        info(f"  git clone {BL2_TOOL_REPO} {BL2_TOOL_DIR}")
        info(f"  then set 'borderlands2_tool_dir' in {CONFIG_PATH.name}")
        return cfg
    if not confirm(f"Clone apocalyptech/borderlands2 into {BL2_TOOL_DIR.relative_to(ROOT)}?", default_yes=True, yes=yes):
        warn("Skipping clone. Save reading will fail until you point to a borderlands2-tool checkout.")
        return cfg
    info(f"Cloning {BL2_TOOL_REPO}...")
    try:
        subprocess.run(["git", "clone", "--depth", "1", BL2_TOOL_REPO, str(BL2_TOOL_DIR)], check=True)
    except subprocess.CalledProcessError as e:
        err(f"git clone failed: {e}")
        return cfg
    cfg["borderlands2_tool_dir"] = str(BL2_TOOL_DIR)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    ok(f"Cloned and registered at {BL2_TOOL_DIR.relative_to(ROOT)}")
    return cfg


# ---------------------------------------------------------------------------
# Step 6 — Smoke test
# ---------------------------------------------------------------------------

def step_smoke(cfg: dict, py: str) -> bool:
    all_ok = True

    if cfg.get("game_dir") and os.path.isdir(cfg["game_dir"]):
        ok(f"Game directory exists: {cfg['game_dir']}")
    else:
        warn("Game directory missing — exe patcher won't work until you fix this.")
        all_ok = False

    if cfg.get("save_dir") and os.path.isdir(cfg["save_dir"]):
        sav_count = sum(1 for f in os.listdir(cfg["save_dir"]) if f.lower().endswith(".sav"))
        ok(f"Save directory exists: {cfg['save_dir']} ({sav_count} .sav file{'s' if sav_count != 1 else ''})")
    else:
        warn("Save directory missing — the editor will start but no saves will be listed.")
        all_ok = False

    if cfg.get("borderlands2_tool_dir") and os.path.isfile(os.path.join(cfg["borderlands2_tool_dir"], "borderlands", "savefile.py")):
        ok("borderlands2-tool module locatable.")
    else:
        warn("borderlands2-tool not found — save reading will fail.")
        all_ok = False

    if cfg.get("gibbed_dir") and os.path.isdir(cfg["gibbed_dir"]):
        ok(f"Gibbed data: {cfg['gibbed_dir']}")
    else:
        info("Gibbed data not configured — weapon code import/export will be disabled (but everything else works).")

    # Verify Flask is importable in the chosen interpreter
    try:
        result = subprocess.run(
            [py, "-c", "import flask, sys; sys.exit(0)"],
            capture_output=True,
        )
        if result.returncode == 0:
            ok("Flask import check passed.")
        else:
            err("Flask not importable — re-run dep install.")
            all_ok = False
    except Exception as e:
        err(f"Flask import check failed: {e}")
        all_ok = False

    return all_ok


# ---------------------------------------------------------------------------
# Step 7 — Launch
# ---------------------------------------------------------------------------

def step_launch(py: str, yes: bool, force_launch: bool) -> None:
    if force_launch:
        do_launch = True
    elif yes:
        do_launch = False  # auto mode: don't launch unless explicitly requested
        info("Skipping launch in --yes mode. Pass --launch to start the editor.")
    else:
        do_launch = confirm("Launch the editor now?", default_yes=True)

    if not do_launch:
        print()
        print(bold("To start the editor later:"))
        if platform.system() == "Windows":
            print(f"  {cyan('start_editor.bat')}")
        print(f"  {cyan(f'{py} app.py')}")
        return

    print()
    print(bold("Starting BL2 Save Editor..."))
    print(dim("(Ctrl+C in this terminal stops the server.)"))
    print()
    try:
        subprocess.run([py, "app.py"], cwd=str(ROOT))
    except KeyboardInterrupt:
        print()
        info("Server stopped.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="BL2 Save Editor setup wizard.")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="Accept all auto-detected defaults without prompting.")
    parser.add_argument("--no-venv", action="store_true",
                        help="Skip virtual environment creation; install into system Python.")
    parser.add_argument("--launch", action="store_true",
                        help="Launch the editor automatically after setup.")
    args = parser.parse_args()

    banner()
    TOTAL = 7

    step(1, TOTAL, "Checking Python version")
    if not step_python():
        return 1

    step(2, TOTAL, "Virtual environment")
    venv = step_venv(yes=args.yes, skip=args.no_venv)
    py = _python_in_venv(venv)

    step(3, TOTAL, "Installing dependencies")
    if not step_deps(py):
        return 1

    step(4, TOTAL, "Configuring paths (config.json)")
    cfg = step_config(yes=args.yes)

    step(5, TOTAL, "Installing borderlands2-tool dependency")
    cfg = step_bl2_tool(cfg, yes=args.yes)

    step(6, TOTAL, "Smoke test")
    all_ok = step_smoke(cfg, py)

    print()
    if all_ok:
        print(bold(green("Setup complete — all checks passed.")))
    else:
        print(bold(yellow("Setup finished with warnings.")))
        info("The editor will start, but some features may be unavailable until you")
        info(f"correct the warnings above (edit {CONFIG_PATH.name} or re-run this wizard).")

    step(7, TOTAL, "Launch")
    step_launch(py, yes=args.yes, force_launch=args.launch)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
