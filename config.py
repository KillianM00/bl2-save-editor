"""
Configuration loader for BL2 Save Editor.
Reads paths from config.json, falling back to auto-detection.
"""
from __future__ import annotations

import os
import json
import platform
from typing import Any

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def _detect_steam_dir() -> str:
    """Try to find the Steam BL2 installation directory."""
    candidates = []
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
        candidates = [
            os.path.join(home, "Library", "Application Support", "Steam", "steamapps", "common", "Borderlands 2"),
        ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return ""


def _detect_save_dir() -> str:
    """Try to find the BL2 save directory."""
    if platform.system() == "Windows":
        docs = os.path.join(os.environ.get("USERPROFILE", ""), "Documents", "My Games", "Borderlands 2", "WillowGame", "SaveData")
        if os.path.isdir(docs):
            # Pick the first Steam ID subfolder
            for entry in os.listdir(docs):
                subdir = os.path.join(docs, entry)
                if os.path.isdir(subdir):
                    return subdir
    elif platform.system() == "Linux":
        home = os.path.expanduser("~")
        docs = os.path.join(home, ".local", "share", "aspyr-media", "borderlands 2", "willowgame", "savedata")
        if os.path.isdir(docs):
            for entry in os.listdir(docs):
                subdir = os.path.join(docs, entry)
                if os.path.isdir(subdir):
                    return subdir
    return ""


def _detect_gibbed_dir() -> str:
    """Try to find the Gibbed data directory (shipped with the editor or nearby)."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(project_root, "gibbed_data"),
        os.path.join(project_root, "..", "gibbed_data"),
    ]
    if platform.system() == "Windows":
        candidates.append(os.path.join(os.environ.get("USERPROFILE", ""), "gibbed_data"))
    for c in candidates:
        if os.path.isdir(c):
            return c
    return ""


def _detect_borderlands2_tool_dir() -> str:
    """Try to find the apocalyptech borderlands2-tool library."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(project_root, "borderlands2-tool"),
        os.path.join(project_root, "..", "borderlands2-tool"),
    ]
    for c in candidates:
        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "borderlands", "savefile.py")):
            return c
    return ""


def load_config() -> dict[str, Any]:
    """Load config from config.json, auto-detecting missing values."""
    config = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)

    defaults = {
        "save_dir": _detect_save_dir(),
        "gibbed_dir": _detect_gibbed_dir(),
        "borderlands2_tool_dir": _detect_borderlands2_tool_dir(),
        "game_dir": _detect_steam_dir(),
        "backup_generations": 5,
    }

    for key, default in defaults.items():
        if key not in config or not config[key]:
            config[key] = default

    # Derive exe path from game_dir
    if "exe_path" not in config and config["game_dir"]:
        if platform.system() == "Windows":
            config["exe_path"] = os.path.join(config["game_dir"], "Binaries", "Win32", "Borderlands2.exe")
        else:
            config["exe_path"] = os.path.join(config["game_dir"], "Binaries", "Linux", "Borderlands2")

    return config



# Singleton
_config = None

def get_config() -> dict[str, Any]:
    global _config
    if _config is None:
        _config = load_config()
    return _config
