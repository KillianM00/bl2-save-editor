"""
BL2 Save Editor — Flask web application.
"""
import os
import re
import subprocess
import mimetypes
import logging
import platform
import socket
import threading
import webbrowser
from flask import Flask, render_template, jsonify, request

import save_io
import asset_db
import steam_achievements

log = logging.getLogger("bl2editor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Register glTF MIME types for 3D model serving
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("application/octet-stream", ".bin")

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.jinja_env.auto_reload = True


import time as _time

_game_running_cache = {"value": False, "ts": 0.0}

def _is_game_running():
    """Check if BL2 process is active. Cached for 3 seconds to avoid
    spawning tasklist on every rapid write."""
    now = _time.monotonic()
    if now - _game_running_cache["ts"] < 3.0:
        return _game_running_cache["value"]
    try:
        if platform.system() == "Windows":
            result = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq Borderlands2.exe"],
                capture_output=True, text=True, timeout=5
            )
            running = "Borderlands2.exe" in result.stdout
        else:
            result = subprocess.run(
                ["pgrep", "-f", "Borderlands2"],
                capture_output=True, text=True, timeout=5
            )
            running = result.returncode == 0
    except Exception:
        running = False
    _game_running_cache["value"] = running
    _game_running_cache["ts"] = now
    return running


def require_game_not_running(f):
    """Decorator: block write operations while BL2 is running."""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if _is_game_running():
            return jsonify({"error": "Borderlands 2 is running. Close the game before editing saves."}), 409
        return f(*args, **kwargs)
    return wrapper


_SAVE_FILENAME_RE = re.compile(r'^Save\d{4}\.sav$')

def validate_save_filename(f):
    """Decorator: reject filenames that don't match SaveNNNN.sav pattern."""
    from functools import wraps
    @wraps(f)
    def wrapper(filename, *args, **kwargs):
        if not _SAVE_FILENAME_RE.match(filename):
            return jsonify({"error": "Invalid save filename"}), 400
        return f(filename, *args, **kwargs)
    return wrapper


# Bug 15: whitelist valid item field numbers to prevent player dict corruption
_VALID_ITEM_FIELDS = {41, 53, 54}  # bank, items, weapons



@app.errorhandler(404)
def not_found_json(e):
    """Return JSON for 404 errors so API callers never get HTML."""
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return e  # let Flask render HTML for non-API pages

@app.errorhandler(500)
def server_error_json(e):
    """Return JSON for 500 errors so API callers never get HTML."""
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error"}), 500
    return e

@app.after_request
def fix_gltf_mime(response):
    """Ensure .gltf files are served with correct MIME type for Three.js."""
    if request.path.endswith('.gltf'):
        response.headers['Content-Type'] = 'model/gltf+json'
    return response


@app.route("/")
def index():
    from config import get_config, CONFIG_PATH
    cfg = get_config()
    # Show setup wizard if config.json doesn't exist or critical paths are missing
    if not os.path.exists(CONFIG_PATH) or not cfg.get("save_dir"):
        return render_template("setup.html")
    return render_template("index.html")


@app.route("/setup")
def setup_page():
    return render_template("setup.html")


@app.route("/api/setup/detect")
def api_setup_detect():
    """Auto-detect all paths for the setup wizard."""
    from config import _detect_save_dir, _detect_steam_dir, _detect_gibbed_dir, _detect_borderlands2_tool_dir
    return jsonify({
        "save_dir": _detect_save_dir(),
        "game_dir": _detect_steam_dir(),
        "gibbed_dir": _detect_gibbed_dir(),
        "borderlands2_tool_dir": _detect_borderlands2_tool_dir(),
    })


@app.route("/api/setup/save", methods=["POST"])
def api_setup_save():
    """Save config from setup wizard."""
    import json as _json
    from config import CONFIG_PATH
    data = request.get_json()
    config = {
        "save_dir": data.get("save_dir", ""),
        "gibbed_dir": data.get("gibbed_dir", ""),
        "borderlands2_tool_dir": data.get("borderlands2_tool_dir", ""),
        "game_dir": data.get("game_dir", ""),
        "backup_generations": 5,
    }
    # Validate save_dir exists
    if not config["save_dir"] or not os.path.isdir(config["save_dir"]):
        return jsonify({"error": "Save directory not found. Please check the path."}), 400
    with open(CONFIG_PATH, "w") as f:
        _json.dump(config, f, indent=2)
    # Reload config
    import config as config_mod
    config_mod._config = None
    return jsonify({"ok": True})


@app.route("/api/saves")
def api_saves():
    return jsonify(save_io.list_saves())


@app.route("/api/game-status")
def api_game_status():
    """Check if BL2 is running — edits while game is open will be overwritten."""
    return jsonify({"running": _is_game_running()})


@app.route("/api/save/<filename>/duplicate", methods=["POST"])
@validate_save_filename
def api_duplicate_save(filename):
    """Duplicate a save file."""
    try:
        new_name = save_io.duplicate_save(filename)
        return jsonify({"ok": True, "new_filename": new_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/delete", methods=["DELETE"])
@validate_save_filename
def api_delete_save(filename):
    """Delete a save file (moves to .deleted backup)."""
    try:
        ok = save_io.delete_save(filename)
        if ok:
            _preview_cache.pop(filename, None)
            return jsonify({"ok": True})
        return jsonify({"error": "Save not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/backups")
@validate_save_filename
def api_list_backups(filename):
    """List available backups for a save file."""
    try:
        backups = save_io.list_backups(filename)
        return jsonify({"ok": True, "backups": backups})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/backups/restore", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_restore_backup(filename):
    """Restore a save file from a backup generation."""
    try:
        data = request.get_json()
        generation = int(data.get("generation", 0))
        ok = save_io.restore_backup(filename, generation)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Backup not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


_preview_cache = {}  # {filename: (mtime, preview_data)}

@app.route("/api/saves/previews")
def api_saves_previews():
    """Lightweight endpoint: returns class + level for all saves in one call.
    Project Paris Bug 4: loadSaveList was firing N full-parse API calls.
    BUG-36 fix: cache previews by mtime so unchanged saves aren't re-parsed."""
    results = {}
    for s in save_io.list_saves():
        fname = s["filename"]
        mtime = s.get("modified", 0)
        cached = _preview_cache.get(fname)
        if cached and cached[0] == mtime:
            results[fname] = cached[1]
            continue
        try:
            _, player = save_io.read_save(fname)
            char_class = player[1][0][1] if 1 in player else b""
            if isinstance(char_class, bytes):
                class_name = save_io.CLASS_NAMES.get(char_class, char_class.decode("latin1", errors="replace"))
            else:
                class_name = str(char_class)
            level = player[2][0][1] if 2 in player else 1
            preview = {"class_name": class_name, "level": level}
            _preview_cache[fname] = (mtime, preview)
            results[fname] = preview
        except Exception:
            results[fname] = {"class_name": "?", "level": 0}
    return jsonify(results)


@app.route("/api/save/<filename>")
@validate_save_filename
def api_load_save(filename):
    try:
        _, player = save_io.read_save(filename)
        char_info = save_io.extract_character_info(player)
        inventory = save_io.extract_inventory(player)

        db = asset_db.get_db()
        # Resolve all item names
        for category in ("weapons", "items", "bank"):
            for item in inventory[category]:
                item["resolved"] = db.resolve_item_parts(item["info"])

        missions = save_io.extract_missions(player)
        fast_travel = save_io.extract_fast_travel(player)
        challenges = save_io.extract_challenges(player)

        return jsonify({"character": char_info, "inventory": inventory,
                        "missions": missions, "fast_travel": fast_travel,
                        "challenges": challenges})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/missions/<int:playthrough>/<path:mission_name>", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_mission_status(filename, playthrough, mission_name):
    try:
        data = request.get_json()
        new_status = int(data.get("status", 4))
        if new_status not in (1, 4):
            return jsonify({"error": "Status must be 1 (Active) or 4 (Complete)"}), 400
        ok = save_io.set_mission_status(filename, playthrough, mission_name, new_status)
        if not ok:
            return jsonify({"error": "Mission not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/missions/<int:playthrough>/complete-all", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_complete_all_missions(filename, playthrough):
    try:
        count = save_io.complete_all_missions(filename, playthrough)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/fast-travel", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_update_fast_travel(filename):
    try:
        data = request.get_json()
        stations = data.get("stations", [])
        if not isinstance(stations, list):
            return jsonify({"error": "stations must be a list"}), 400
        invalid = [s for s in stations if s not in save_io.ALL_KNOWN_STATIONS]
        if invalid:
            return jsonify({"error": f"Unknown stations: {invalid[:5]}"}), 400
        save_io.update_fast_travel(filename, stations)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/fast-travel/unlock-all", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_unlock_all_fast_travel(filename):
    try:
        count = save_io.unlock_all_fast_travel(filename)
        return jsonify({"ok": True, "added": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/unlock-achievements", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_unlock_achievements(filename):
    """Set save state for all save-trackable achievements."""
    try:
        result = save_io.unlock_achievements(filename)
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/fast-travel/all-stations")
def api_all_stations():
    """Get all known stations (base + DLC) with display names."""
    return jsonify([{"name": s, "display_name": save_io.FAST_TRAVEL_STATIONS.get(s, s)}
                    for s in save_io.ALL_KNOWN_STATIONS])


@app.route("/api/missions/db")
def api_mission_db():
    return jsonify(save_io.get_mission_db())


@app.route("/api/save/<filename>/missions/<int:playthrough>/add", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_add_mission(filename, playthrough):
    try:
        data = request.get_json()
        mission = data.get("mission", "")
        status = int(data.get("status", 1))
        level = int(data.get("level", 1))
        if not mission:
            return jsonify({"error": "Mission name required"}), 400
        # BUG-33: validate status like api_set_mission_status does
        if status not in (1, 4):
            return jsonify({"error": "Status must be 1 (Active) or 4 (Complete)"}), 400
        if level < 1 or level > 127:
            return jsonify({"error": "Level must be 1-127"}), 400
        ok = save_io.add_mission(filename, playthrough, mission, status, level)
        if not ok:
            return jsonify({"error": "Mission already exists or invalid playthrough"}), 400
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/missions/<int:playthrough>/remove", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_remove_mission(filename, playthrough):
    try:
        data = request.get_json()
        mission = data.get("mission", "")
        ok = save_io.remove_mission(filename, playthrough, mission)
        if not ok:
            return jsonify({"error": "Mission not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/missions/<int:playthrough>/add-all-story", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_add_all_story(filename, playthrough):
    try:
        data = request.get_json() or {}
        status = int(data.get("status", 1))
        if status not in (1, 4):
            return jsonify({"error": "Status must be 1 (Active) or 4 (Complete)"}), 400
        count = save_io.add_all_story_missions(filename, playthrough, status)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/missions/<int:playthrough>/set-active", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_active_mission(filename, playthrough):
    try:
        data = request.get_json()
        mission = data.get("mission", "")
        ok = save_io.set_active_mission(filename, playthrough, mission)
        if not ok:
            return jsonify({"error": "Mission not found in this playthrough"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/playthrough", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_playthrough(filename):
    try:
        data = request.get_json()
        action = data.get("action", "")
        if action == "unlock_tvhm":
            save_io.unlock_playthrough(filename, "tvhm")
        elif action == "unlock_uvhm":
            save_io.unlock_playthrough(filename, "uvhm")
        elif action == "set_active":
            pt = int(data.get("playthrough", 0))
            save_io.set_active_playthrough(filename, pt)
        else:
            return jsonify({"error": "Unknown action"}), 400
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/character", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_update_character(filename):
    try:
        changes = request.get_json()
        new_info = save_io.update_character(filename, changes)
        return jsonify(new_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/skills", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_skills(filename):
    try:
        data = request.get_json()
        skills = data.get("skills", {})
        count = save_io.set_skills(filename, skills)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/<int:idx>", methods=["DELETE"])
@validate_save_filename
@require_game_not_running
def api_delete_item(filename, field, idx):
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        ok = save_io.delete_item(filename, field, idx)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Item not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/reorder", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_reorder_item(filename, field):
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        data = request.get_json()
        from_idx = int(data["from"])
        to_idx = int(data["to"])
        ok = save_io.reorder_item(filename, field, from_idx, to_idx)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Invalid indices"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/<int:idx>/level", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_item_level(filename, field, idx):
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        data = request.get_json()
        new_level = int(data["level"])
        log.info(f"SET LEVEL: {filename} field={field} idx={idx} level={new_level}")
        ok = save_io.set_item_level(filename, field, idx, new_level)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Item not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/<int:idx>/duplicate", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_duplicate_item(filename, field, idx):
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        ok = save_io.duplicate_item(filename, field, idx)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Item not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/bulk-level", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_bulk_set_level(filename, field):
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        data = request.get_json()
        new_level = int(data["level"])
        count = save_io.bulk_set_level(filename, field, new_level)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/<int:idx>/transfer", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_transfer_item(filename, field, idx):
    """Move an item between inventory sections (e.g. backpack to bank)."""
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid source field: {field}"}), 400
    data = request.get_json()
    to_field = int(data.get("to_field", 0))
    if to_field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid target field: {to_field}"}), 400
    try:
        ok = save_io.transfer_item(filename, field, idx, to_field)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": "Transfer failed"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/preview-codes", methods=["POST"])
def api_preview_codes():
    """Preview Gibbed codes without importing — returns decoded item info."""
    try:
        data = request.get_json()
        codes = data.get("codes", "")
        results = save_io.preview_gibbed_codes(codes)
        # Resolve names for valid items
        db = asset_db.get_db()
        for r in results:
            if "info" in r:
                r["resolved"] = db.resolve_item_parts(r["info"])
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/import", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_import_codes(filename):
    try:
        data = request.get_json()
        codes = data.get("codes", "")
        result = save_io.import_gibbed_codes(filename, codes)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/export/<int:field>/<int:idx>")
@validate_save_filename
def api_export_code(filename, field, idx):
    # Bug 24: validate field like all other item endpoints
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        code = save_io.export_gibbed_code(filename, field, idx)
        if code:
            return jsonify({"code": code})
        return jsonify({"error": "Item not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/export-all")
@validate_save_filename
def api_export_all(filename):
    try:
        sections = save_io.export_all_codes(filename)
        return jsonify(sections)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/add", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_add_weapon(filename):
    try:
        data = request.get_json()
        db = asset_db.get_db()

        balance_path = data["balance"]
        level = max(0, min(127, int(data.get("level", 1))))
        selected_parts = data.get("parts", {})

        # Resolve weapon type and manufacturer from balance
        wtype_path = db.get_weapon_type_for_balance(balance_path)
        mfr_path = db.get_manufacturer_for_balance(balance_path)

        if not wtype_path or not mfr_path:
            return jsonify({"error": "Cannot resolve weapon type or manufacturer"}), 400

        # Pack header references
        type_ref = db.pack_reference(wtype_path, "WeaponTypes")
        bal_ref = db.pack_reference(balance_path, "BalanceDefs")
        mfr_ref = db.pack_reference(mfr_path, "Manufacturers")

        if not type_ref or not bal_ref or not mfr_ref:
            return jsonify({"error": "Cannot resolve asset references"}), 400

        # Weapon sizes: (8, 13, 20, 11, 7, 7, 17*11)
        # Values: [set, type, balance, manufacturer, grade, stage, body, grip, barrel, sight, stock, element, acc1, acc2, material, prefix, title]

        cfg_type = asset_db.CONFIGS["WeaponTypes"]
        cfg_bal = asset_db.CONFIGS["BalanceDefs"]
        cfg_mfr = asset_db.CONFIGS["Manufacturers"]

        type_packed = (type_ref[0] << cfg_type["asset_bits"]) | type_ref[1]
        bal_packed = (bal_ref[0] << cfg_bal["asset_bits"]) | bal_ref[1]
        mfr_packed = (mfr_ref[0] << cfg_mfr["asset_bits"]) | mfr_ref[1]

        # Bug 16: determine correct set_id from balance (DLC weapons use non-zero sets)
        set_id = db.get_set_id_for_path(balance_path, "BalanceDefs")

        NONE_17 = (1 << 17) - 1
        slot_order = ["body", "grip", "barrel", "sight", "stock",
                      "elemental", "accessory1", "accessory2",
                      "material", "prefix", "title"]
        part_values = []
        for slot in slot_order:
            part_path = selected_parts.get(slot)
            if part_path:
                ref = db.pack_reference(part_path, "WeaponParts")
                if ref:
                    cfg_wp = asset_db.CONFIGS["WeaponParts"]
                    part_values.append((ref[0] << cfg_wp["asset_bits"]) | ref[1])
                else:
                    part_values.append(NONE_17)
            else:
                part_values.append(NONE_17)

        values = [set_id, type_packed, bal_packed, mfr_packed, level, level] + part_values
        save_io.add_weapon(filename, values)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/items/<int:field>/<int:idx>/edit", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_edit_weapon(filename, field, idx):
    """Full weapon editor: change type, balance, manufacturer, all parts, level, element."""
    if field not in _VALID_ITEM_FIELDS:
        return jsonify({"error": f"Invalid item field: {field}"}), 400
    try:
        data = request.get_json()
        db = asset_db.get_db()

        log.info(f"EDIT REQUEST: {filename} field={field} idx={idx}")

        _, player = save_io.read_save(filename)
        if field not in player or idx >= len(player[field]):
            return jsonify({"error": "Item not found"}), 404

        from borderlands.datautil.protobuf import read_protobuf, write_protobuf
        entry = player[field][idx]
        sub = read_protobuf(entry[1])
        raw_item = sub[1][0][1]
        is_weapon, item_values, key = save_io.unwrap_item(raw_item)

        log.debug(f"BEFORE: values={item_values}")

        # game_stage (index 5) = level requirement + base damage scaling
        # grade_index (index 4) = quality/damage multiplier
        # Both are 7-bit fields: valid range 0-127.
        if "game_stage" in data:
            item_values[5] = max(0, min(127, int(data["game_stage"])))
        if "grade_index" in data:
            item_values[4] = max(0, min(127, int(data["grade_index"])))
        if "level" in data and "game_stage" not in data and "grade_index" not in data:
            level = max(0, min(127, int(data["level"])))
            item_values[4] = level
            item_values[5] = level

        # Update type if provided
        if "type" in data and data["type"]:
            ref = db.pack_reference(data["type"], "WeaponTypes" if is_weapon else "ItemTypes")
            if ref:
                cfg = asset_db.CONFIGS["WeaponTypes" if is_weapon else "ItemTypes"]
                item_values[1] = (ref[0] << cfg["asset_bits"]) | ref[1]

        # Update balance if provided
        if "balance" in data and data["balance"]:
            ref = db.pack_reference(data["balance"], "BalanceDefs")
            if ref:
                cfg = asset_db.CONFIGS["BalanceDefs"]
                item_values[2] = (ref[0] << cfg["asset_bits"]) | ref[1]
                # Bug 17: update set field when balance changes (DLC assets need correct set)
                item_values[0] = db.get_set_id_for_path(data["balance"], "BalanceDefs")

        # Update manufacturer if provided
        if "manufacturer" in data and data["manufacturer"]:
            ref = db.pack_reference(data["manufacturer"], "Manufacturers")
            if ref:
                cfg = asset_db.CONFIGS["Manufacturers"]
                item_values[3] = (ref[0] << cfg["asset_bits"]) | ref[1]

        # Update parts
        part_group = "WeaponParts" if is_weapon else "ItemParts"
        cfg_parts = asset_db.CONFIGS[part_group]
        NONE = (1 << (cfg_parts["sublibrary_bits"] + cfg_parts["asset_bits"])) - 1
        slot_order = ["body", "grip", "barrel", "sight", "stock",
                      "elemental", "accessory1", "accessory2",
                      "material", "prefix", "title"]
        parts_data = data.get("parts", {})
        for i, slot in enumerate(slot_order):
            if slot in parts_data:
                part_path = parts_data[slot]
                # Skip empty strings (unloaded dropdowns) — preserve original value
                if part_path in ("", "__keep__", "__loading__") or part_path is None:
                    continue
                if part_path == "none":
                    item_values[6 + i] = NONE
                else:
                    ref = db.pack_reference(part_path, part_group)
                    if ref:
                        item_values[6 + i] = (ref[0] << cfg_parts["asset_bits"]) | ref[1]

        sub[1][0][1] = save_io.wrap_item(is_weapon, item_values, key)
        entry[1] = write_protobuf(sub)
        # Project Paris Bug 12: warn_only so pre-existing corrupt items don't block this edit
        save_io.write_save(filename, player, warn_only_validation=True)
        log.info(f"EDIT SAVED: {filename} field={field} idx={idx}")
        return jsonify({"ok": True})
    except Exception as e:
        log.exception(f"Edit failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/assets/weapon-types")
def api_weapon_types():
    db = asset_db.get_db()
    return jsonify(db.get_weapon_categories())


@app.route("/api/assets/balances")
def api_balances():
    db = asset_db.get_db()
    wtype = request.args.get("type", "")
    return jsonify(db.get_balances_for_type(wtype))


@app.route("/api/assets/parts")
def api_parts():
    db = asset_db.get_db()
    balance = request.args.get("balance", "")
    return jsonify(db.get_parts_for_balance(balance))


@app.route("/api/assets/item-categories")
def api_item_categories():
    """Get non-weapon item categories: Shield, Grenade, Class Mod, Relic."""
    db = asset_db.get_db()
    return jsonify(db.get_item_categories())


@app.route("/api/assets/item-balances")
def api_item_balances():
    """Get all item balances for a category."""
    db = asset_db.get_db()
    category = request.args.get("category", "")
    return jsonify(db.get_item_balances_for_category(category))


@app.route("/api/assets/item-parts")
def api_item_parts():
    """Get available parts for an item balance."""
    db = asset_db.get_db()
    balance = request.args.get("balance", "")
    return jsonify(db.get_item_parts_for_balance(balance))


@app.route("/api/save/<filename>/items/add-item", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_add_item(filename):
    """Add a non-weapon item (shield, grenade, class mod, relic) to inventory."""
    try:
        data = request.get_json()
        db = asset_db.get_db()

        balance_path = data["balance"]
        level = max(0, min(127, int(data.get("level", 1))))
        selected_parts = data.get("parts", {})

        item_type_path = db.get_item_type_for_balance(balance_path)
        mfr_path = db.get_manufacturer_for_item_balance(balance_path)

        if not item_type_path:
            return jsonify({"error": "Cannot resolve item type"}), 400

        # Pack references using same approach as weapon builder
        type_ref = db.pack_reference(item_type_path, "ItemTypes")
        bal_ref = db.pack_reference(balance_path, "BalanceDefs")
        mfr_ref = db.pack_reference(mfr_path, "Manufacturers") if mfr_path else None

        if not type_ref or not bal_ref:
            return jsonify({"error": "Cannot resolve asset references"}), 400

        cfg_type = asset_db.CONFIGS["ItemTypes"]
        cfg_bal = asset_db.CONFIGS["BalanceDefs"]
        cfg_mfr = asset_db.CONFIGS["Manufacturers"]

        type_packed = (type_ref[0] << cfg_type["asset_bits"]) | type_ref[1]
        bal_packed = (bal_ref[0] << cfg_bal["asset_bits"]) | bal_ref[1]
        mfr_packed = 0
        if mfr_ref:
            mfr_packed = (mfr_ref[0] << cfg_mfr["asset_bits"]) | mfr_ref[1]

        set_id = db.get_set_id_for_path(balance_path, "BalanceDefs")

        # Item parts use 16-bit slots (vs 17-bit for weapons)
        NONE_16 = (1 << 16) - 1
        slot_order = ["alpha", "beta", "gamma", "delta", "epsilon",
                      "zeta", "eta", "theta", "material", "prefix", "title"]
        part_values = []
        for slot in slot_order:
            part_path = selected_parts.get(slot)
            if part_path:
                ref = db.pack_reference(part_path, "ItemParts")
                if ref:
                    cfg_ip = asset_db.CONFIGS["ItemParts"]
                    part_values.append((ref[0] << cfg_ip["asset_bits"]) | ref[1])
                else:
                    part_values.append(NONE_16)
            else:
                part_values.append(NONE_16)

        values = [set_id, type_packed, bal_packed, mfr_packed, level, level] + part_values
        save_io.add_item(filename, values)
        return jsonify({"ok": True})
    except Exception as e:
        log.exception(f"Add item failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/assets/all-parts/<slot>")
def api_all_parts_for_slot(slot):
    """Get ALL available parts for a given slot (not filtered by balance)."""
    db = asset_db.get_db()
    kind = request.args.get("kind", "weapon")
    if kind == "item":
        return jsonify(db.get_all_item_parts_for_slot(slot))
    return jsonify(db.get_all_parts_for_slot(slot))


@app.route("/api/assets/all-parts-batch")
def api_all_parts_batch():
    """Get ALL parts for multiple slots in one call. Query: ?slots=body,grip,...&kind=weapon"""
    db = asset_db.get_db()
    kind = request.args.get("kind", "weapon")
    slots_str = request.args.get("slots", "")
    if not slots_str:
        return jsonify({}), 400
    slots = [s.strip() for s in slots_str.split(",") if s.strip()]
    result = {}
    for slot in slots:
        if kind == "item":
            result[slot] = db.get_all_item_parts_for_slot(slot)
        else:
            result[slot] = db.get_all_parts_for_slot(slot)
    return jsonify(result)


@app.route("/api/assets/all-balances")
def api_all_balances():
    """Get all weapon balance definitions."""
    db = asset_db.get_db()
    return jsonify(db.get_all_balances())


_customization_cache = {}  # class_name -> {heads, skins}

@app.route("/api/assets/customizations/<class_name>")
def api_customizations(class_name):
    """Get all available heads and skins for a character class."""
    if class_name in _customization_cache:
        return jsonify(_customization_cache[class_name])
    import json as _json
    from config import get_config
    gibbed_dir = get_config().get("gibbed_dir", "")
    if not gibbed_dir or not os.path.isdir(gibbed_dir):
        return jsonify({"heads": [], "skins": []})
    gibbed_items_path = os.path.join(gibbed_dir, "Items.json")
    if not os.path.exists(gibbed_items_path):
        return jsonify({"heads": [], "skins": []})
    with open(gibbed_items_path) as f:
        items = _json.load(f)

    CLASS_PREFIXES = {
        "Axton": ["Soldier"], "Zer0": ["Assassin"],
        "Maya": ["Siren"], "Salvador": ["Mercenary", "Merc"],
        "Gaige": ["Mechro"], "Krieg": ["Psycho"],
    }
    prefixes = CLASS_PREFIXES.get(class_name, [])
    heads = []
    skins = []
    for path, info in items.items():
        if not isinstance(info, dict):
            continue
        # Match class by prefix in path
        if not any(p in path for p in prefixes):
            continue
        name = info.get("name", path.split(".")[-1])
        is_head = ".Head_" in path
        is_skin = ".Skin_" in path
        if is_head:
            heads.append({"path": path, "name": name})
        elif is_skin:
            skins.append({"path": path, "name": name})

    heads.sort(key=lambda x: x["name"])
    skins.sort(key=lambda x: x["name"])
    result = {"heads": heads, "skins": skins}
    _customization_cache[class_name] = result
    return jsonify(result)


@app.route("/api/assets/manufacturers")
def api_manufacturers():
    """Get all manufacturer definitions."""
    db = asset_db.get_db()
    return jsonify(db.get_all_manufacturers())


@app.route("/api/loadouts")
def api_list_loadouts():
    """List all saved loadouts."""
    return jsonify(save_io.list_loadouts())


@app.route("/api/loadouts/save", methods=["POST"])
def api_save_loadout():
    """Save current inventory as a named loadout."""
    data = request.get_json()
    filename = data.get("filename", "")
    name = data.get("name", "").strip()
    if not filename or not name:
        return jsonify({"error": "filename and name required"}), 400
    if not _SAVE_FILENAME_RE.match(filename):
        return jsonify({"error": "Invalid save filename"}), 400
    try:
        result = save_io.save_loadout(filename, name)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/loadouts/<loadout_file>/restore", methods=["POST"])
@require_game_not_running
def api_restore_loadout(loadout_file):
    """Restore a loadout into a save file."""
    data = request.get_json()
    filename = data.get("filename", "")
    replace = data.get("replace", False)
    if not filename:
        return jsonify({"error": "filename required"}), 400
    if not _SAVE_FILENAME_RE.match(filename):
        return jsonify({"error": "Invalid save filename"}), 400
    if not re.match(r'^[A-Za-z0-9_\-. ]+\.json$', loadout_file):
        return jsonify({"error": "Invalid loadout file"}), 400
    try:
        result = save_io.load_loadout(filename, loadout_file, replace=replace)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/loadouts/<loadout_file>", methods=["DELETE"])
def api_delete_loadout(loadout_file):
    """Delete a saved loadout."""
    if not re.match(r'^[A-Za-z0-9_\-. ]+\.json$', loadout_file):
        return jsonify({"error": "Invalid loadout file"}), 400
    if save_io.delete_loadout(loadout_file):
        return jsonify({"ok": True})
    return jsonify({"error": "Loadout not found"}), 404


@app.route("/api/save/<filename>/spawn-test-weapons", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_spawn_test_weapons(filename):
    """Spawn a set of test weapons with varying grade/stage combos to find game limits."""
    try:
        _, player = save_io.read_save(filename)
        from borderlands.datautil.protobuf import read_protobuf, write_protobuf

        # Use first weapon as template
        if 54 not in player or not player[54]:
            return jsonify({"error": "No weapons to use as template"}), 400

        template_entry = player[54][0]
        sub = read_protobuf(template_entry[1])
        raw = sub[1][0][1]
        is_w, base_vals, _ = save_io.unwrap_item(raw)
        if save_io.is_fake_item(is_w, base_vals):
            return jsonify({"error": "Template weapon is empty"}), 400

        # Test matrix: grade values above old cap (80) to verify exe patch
        tests = [
            (1, 85,   "grade85_stage1"),
            (1, 100,  "grade100_stage1"),
            (1, 110,  "grade110_stage1"),
            (1, 120,  "grade120_stage1"),
            (1, 127,  "grade127_stage1"),
        ]

        import random
        count = 0
        for stage, grade, label in tests:
            vals = list(base_vals)
            vals[4] = grade
            vals[5] = stage
            key = random.randrange(0x100000000) - 0x80000000
            raw_item = save_io.wrap_item(is_w, vals, key)
            entry = {
                1: [[2, raw_item]],
                2: [[0, 0]],
                3: [[0, 1]],
            }
            player.setdefault(54, []).append([2, write_protobuf(entry)])
            count += 1
            log.info(f"Spawned test weapon: {label} (grade={grade}, stage={stage})")

        save_io.write_save(filename, player)
        return jsonify({"ok": True, "count": count,
            "tests": [{"stage": t[0], "grade": t[1], "label": t[2]} for t in tests]})
    except Exception as e:
        log.exception(f"Spawn test weapons failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/docs")
def api_docs():
    """Auto-generated API documentation from Flask routes."""
    docs = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if rule.rule.startswith("/static") or rule.rule == "/":
            continue
        if not rule.rule.startswith("/api"):
            continue
        methods = sorted(rule.methods - {"OPTIONS", "HEAD"})
        func = app.view_functions.get(rule.endpoint)
        doc = func.__doc__.strip() if func and func.__doc__ else ""
        docs.append({
            "path": rule.rule,
            "methods": methods,
            "description": doc,
        })
    return jsonify(docs)


# ─── Ammo Endpoints ────────────────────────────────────────

@app.route("/api/save/<filename>/ammo", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_ammo(filename):
    """Set ammo quantities."""
    try:
        data = request.get_json()
        ammo = data.get("ammo", {})
        ok = save_io.set_ammo(filename, ammo)
        return jsonify({"ok": ok})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/ammo/fill", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_fill_ammo(filename):
    """Fill all ammo to max."""
    try:
        ok = save_io.fill_all_ammo(filename)
        return jsonify({"ok": ok})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Challenge Endpoints ───────────────────────────────────

@app.route("/api/save/<filename>/challenges", methods=["GET"])
@validate_save_filename
def api_get_challenges(filename):
    """Get challenge data."""
    try:
        _, player = save_io.read_save(filename)
        data = save_io.extract_challenges(player)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/challenges/update", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_set_challenge(filename):
    """Set a single challenge's progress."""
    try:
        data = request.get_json()
        path = data.get("path", "")
        progress = int(data.get("progress", 0))
        completed = int(data.get("completed", 0))
        if progress < 0 or progress > 999999:
            return jsonify({"error": "Progress must be 0-999999"}), 400
        if completed < 0 or completed > 999:
            return jsonify({"error": "Completed count must be 0-999"}), 400
        ok = save_io.set_challenge_progress(filename, path, progress, completed)
        if not ok:
            return jsonify({"error": "Challenge not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/challenges/complete-all", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_complete_all_challenges(filename):
    """Complete all challenges."""
    try:
        count = save_io.complete_all_challenges(filename)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save/<filename>/challenges/reset-all", methods=["POST"])
@validate_save_filename
@require_game_not_running
def api_reset_all_challenges(filename):
    """Reset all challenges to zero."""
    try:
        count = save_io.reset_all_challenges(filename)
        return jsonify({"ok": True, "count": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Steam Achievement Endpoints ──────────────────────────────

@app.route("/api/steam/status")
def api_steam_status():
    """Get Steam API connection status."""
    return jsonify(steam_achievements.get_steam_status())


@app.route("/api/steam/init", methods=["POST"])
def api_steam_init():
    """Initialize Steam API connection."""
    ok, msg = steam_achievements.init_steam()
    return jsonify({"ok": ok, "message": msg})


@app.route("/api/steam/achievements")
def api_steam_achievements():
    """List all BL2 achievements with current unlock status."""
    return jsonify(steam_achievements.get_all_achievements_status())


@app.route("/api/steam/achievements/unlock", methods=["POST"])
def api_steam_achievements_unlock():
    """Unlock selected achievements. Body: {achievements: ["BD2_1", ...]}"""
    data = request.get_json()
    names = data.get("achievements", [])
    if not names:
        return jsonify({"error": "No achievements specified"}), 400
    results = steam_achievements.unlock_achievements(names)
    unlocked = sum(1 for v in results.values() if v.get("ok"))
    return jsonify({"ok": True, "unlocked": unlocked, "total": len(names), "results": results})


@app.route("/api/steam/achievements/unlock-all", methods=["POST"])
def api_steam_achievements_unlock_all():
    """Unlock all BL2 achievements."""
    all_names = [a[0] for a in steam_achievements.BL2_ACHIEVEMENTS]
    results = steam_achievements.unlock_achievements(all_names)
    unlocked = sum(1 for v in results.values() if v.get("ok"))
    return jsonify({"ok": True, "unlocked": unlocked, "total": len(all_names)})


@app.route("/api/steam/achievements/clear", methods=["POST"])
def api_steam_achievements_clear():
    """Re-lock selected achievements. Body: {achievements: ["BD2_1", ...]}"""
    data = request.get_json()
    names = data.get("achievements", [])
    if not names:
        return jsonify({"error": "No achievements specified"}), 400
    results = {}
    for name in names:
        ok, msg = steam_achievements.clear_achievement(name)
        results[name] = {"ok": ok, "message": msg}
    cleared = sum(1 for v in results.values() if v.get("ok"))
    return jsonify({"ok": True, "cleared": cleared, "total": len(names)})



def _kill_old_servers(start=5000, end=5010):
    """Kill any existing server processes listening on our port range."""
    if platform.system() != "Windows":
        return
    try:
        out = subprocess.check_output(["netstat", "-ano"], text=True, stderr=subprocess.DEVNULL)
        pids = set()
        for line in out.splitlines():
            for port in range(start, end + 1):
                if f"127.0.0.1:{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        pids.add(parts[-1])
        for pid in pids:
            try:
                subprocess.run(["taskkill", "/F", "/PID", pid],
                               capture_output=True, text=True)
                log.info(f"Killed old server (PID {pid})")
            except Exception:
                pass
    except Exception:
        pass


def _find_free_port(start=5000, end=5010):
    """Find the first available port in range."""
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start


if __name__ == "__main__":
    # Kill any stale servers from previous runs
    _kill_old_servers()

    # Validate config paths at startup
    from config import get_config
    cfg = get_config()
    if not cfg.get("save_dir"):
        log.warning("Save directory not found. Set 'save_dir' in config.json or install BL2.")
    elif not os.path.isdir(cfg["save_dir"]):
        log.warning(f"Save directory does not exist: {cfg['save_dir']}")
    if not cfg.get("gibbed_dir"):
        log.warning("Gibbed data not found. Weapon import/export will be unavailable.")
    if not cfg.get("borderlands2_tool_dir"):
        log.warning("borderlands2-tool not found. Save reading may fail.")

    log.info("Loading asset database...")
    asset_db.get_db()
    log.info("Asset database loaded.")
    # Try to init Steam API at startup
    ok, msg = steam_achievements.init_steam()
    if ok:
        log.info("Steam API: connected")
    else:
        log.info(f"Steam API: {msg}")
    port = _find_free_port()
    url = f"http://localhost:{port}"
    log.info(f"Starting BL2 Save Editor at {url}")
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(debug=False, port=port)
