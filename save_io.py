"""
Save file I/O wrapper for the apocalyptech borderlands2 library.
Provides read/write/modify operations without CLI arg parsing.
"""
from __future__ import annotations

import sys
import os
import re
import json as _json
import struct
import math
import random
import shutil
import base64
import hashlib
import binascii
import logging
import threading
from typing import Any, Optional

from config import get_config

_cfg = get_config()
if _cfg["borderlands2_tool_dir"]:
    sys.path.insert(0, _cfg["borderlands2_tool_dir"])

from borderlands.savefile import BaseApp
from borderlands.datautil.protobuf import (
    read_protobuf, write_protobuf,
    read_repeated_protobuf_value, write_repeated_protobuf_value,
)
from borderlands.datautil.common import (
    rotate_data_right, xor_data,
    create_body, replace_raw_item_key,
)

SAVE_DIR = _cfg["save_dir"]
BACKUP_GENERATIONS = _cfg.get("backup_generations", 5)

# Per-file write locks to prevent concurrent modifications
_file_locks: dict[str, threading.Lock] = {}
_file_locks_guard = threading.Lock()

def _get_file_lock(filename: str) -> threading.Lock:
    """Get or create a lock for a specific save file."""
    with _file_locks_guard:
        if filename not in _file_locks:
            _file_locks[filename] = threading.Lock()
        return _file_locks[filename]

ITEM_SIZES = BaseApp.item_sizes
ITEM_HEADER_SIZES = BaseApp.item_header_sizes
ITEM_STRUCT_VERSION = 7

REQUIRED_XP = [
    0, 358, 1241, 2850, 5376, 8997, 13886, 20208, 28126, 37798,
    49377, 63016, 78861, 97061, 117757, 141092, 167206, 196238, 228322, 263595,
    302190, 344238, 389873, 439222, 492414, 549578, 610840, 676325, 746158, 820463,
    899363, 982980, 1071435, 1164850, 1263343, 1367034, 1476041, 1590483, 1710476, 1836137,
    1967582, 2104926, 2248285, 2397772, 2553501, 2715586, 2884139, 3059273, 3241098, 3429728,
    3625271, 3827840, 4037543, 4254491, 4478792, 4710556, 4949890, 5196902, 5451701, 5714393,
    5985086, 6263885, 6550897, 6846227, 7149982, 7462266, 7783184, 8112840, 8451340, 8798786,
    9155282, 9520931, 9895837, 10280103, 10673830, 11077120, 11490077, 11912801, 12345393, 12787955,
]

CLASS_NAMES = {
    b"GD_Soldier.Character.CharClass_Soldier": "Axton",
    b"GD_Assassin.Character.CharClass_Assassin": "Zer0",
    b"GD_Siren.Character.CharClass_Siren": "Maya",
    b"GD_Mercenary.Character.CharClass_Mercenary": "Salvador",
    b"GD_Tulip_Mechromancer.Character.CharClass_Mechromancer": "Gaige",
    b"GD_Lilac_PlayerClass.Character.CharClass_LilacPlayerClass": "Krieg",
}

# Ammo pool display names and max values (Normal mode, no SDU upgrades)
AMMO_POOLS = [
    ("Ammo_Combat_Rifle", "Assault Rifle", 280, 1120),
    ("Ammo_Combat_Shotgun", "Shotgun", 80, 320),
    ("Ammo_Grenade_Protean", "Grenades", 3, 10),
    ("Ammo_Combat_Launcher", "Rocket Launcher", 12, 48),
    ("Ammo_Patrol_SMG", "SMG", 360, 1440),
    ("Ammo_Repeater_Pistol", "Pistol", 200, 800),
    ("Ammo_Sniper_Rifle", "Sniper Rifle", 48, 192),
]
AMMO_DISPLAY = {a[0]: a[1] for a in AMMO_POOLS}
AMMO_MAXES = {a[0]: a[3] for a in AMMO_POOLS}

# Challenge categories for display
CHALLENGE_CATEGORIES = {
    "Weapons": "Weapons",
    "GeneralCombat": "General Combat",
    "Grenades": "Grenades",
    "Shields": "Shields",
    "elemental": "Elemental",
    "enemies": "Enemies",
    "Vehicles": "Vehicles",
    "Player": "Player",
    "Melee": "Melee",
    "Economy": "Economy",
    "Loot": "Loot",
    "Pickups": "Pickups",
    "Miscellaneous": "Miscellaneous",
    "Dueling": "Dueling",
    "Challenges": "Challenges",
    "LevelChallenges": "Area Challenges",
    "LevelECHOChallenges": "ECHO Logs",
}


def list_saves() -> list[dict[str, Any]]:
    """List all save files in the save directory."""
    saves = []
    for f in sorted(os.listdir(SAVE_DIR)):
        if f.startswith("Save") and f.endswith(".sav") and not f.endswith(".bak"):
            if "backup" in f or "modded" in f:
                continue
            path = os.path.join(SAVE_DIR, f)
            stat = os.stat(path)
            saves.append({
                "filename": f,
                "size_kb": round(stat.st_size / 1024, 1),
                "modified": int(stat.st_mtime),
            })
    return saves


def duplicate_save(filename: str) -> str:
    """Duplicate a save file with the next available Save number. Returns new filename."""
    src = os.path.join(SAVE_DIR, filename)
    if not os.path.exists(src):
        raise FileNotFoundError(f"Save file not found: {filename}")
    # Find next available Save number
    existing = set()
    for f in os.listdir(SAVE_DIR):
        if f.startswith("Save") and f.endswith(".sav") and not f.endswith(".bak"):
            try:
                num = int(f[4:-4])
                existing.add(num)
            except ValueError:
                pass
    next_num = 1
    while next_num in existing:
        next_num += 1
    # BUG-38: BL2 only recognizes Save0001-Save9999; reject overflow
    if next_num > 9999:
        raise RuntimeError("No available save slots (Save0001-Save9999 are all used)")
    new_name = f"Save{next_num:04d}.sav"
    dst = os.path.join(SAVE_DIR, new_name)
    shutil.copy2(src, dst)
    return new_name


def delete_save(filename: str) -> bool:
    """Delete a save file (moves to .deleted backup). Returns True on success."""
    path = os.path.join(SAVE_DIR, filename)
    if not os.path.exists(path):
        return False
    backup = path + ".deleted"
    shutil.move(path, backup)
    return True


def list_backups(filename: str) -> list[dict[str, Any]]:
    """List available backups for a save file."""
    path = os.path.join(SAVE_DIR, filename)
    backups = []
    # Check .bak
    bak = path + ".bak"
    if os.path.exists(bak):
        stat = os.stat(bak)
        backups.append({"name": filename + ".bak", "generation": 0,
                        "size": stat.st_size, "modified": stat.st_mtime})
    # Check .bak.1 through .bak.N
    for i in range(1, BACKUP_GENERATIONS + 1):
        bak_n = f"{path}.bak.{i}"
        if os.path.exists(bak_n):
            stat = os.stat(bak_n)
            backups.append({"name": f"{filename}.bak.{i}", "generation": i,
                            "size": stat.st_size, "modified": stat.st_mtime})
    # Check .deleted
    deleted = path + ".deleted"
    if os.path.exists(deleted):
        stat = os.stat(deleted)
        backups.append({"name": filename + ".deleted", "generation": -1,
                        "size": stat.st_size, "modified": stat.st_mtime})
    return backups


def restore_backup(filename: str, generation: int) -> bool:
    """Restore a save file from a backup generation. 0=.bak, 1-N=.bak.N, -1=.deleted"""
    path = os.path.join(SAVE_DIR, filename)
    if generation == 0:
        src = path + ".bak"
    elif generation == -1:
        src = path + ".deleted"
    else:
        src = f"{path}.bak.{generation}"
    if not os.path.exists(src):
        return False
    # Back up current before restoring
    if os.path.exists(path):
        _rotate_backups(path)
    shutil.copy2(src, path)
    return True


MAX_SAVE_SIZE = 10 * 1024 * 1024  # 10 MB

def read_save(filename: str) -> tuple[bytes, dict[int, Any]]:
    """Read and parse a save file. Returns (raw_bytes, player_dict)."""
    path = os.path.join(SAVE_DIR, filename)
    size = os.path.getsize(path)
    if size > MAX_SAVE_SIZE:
        raise ValueError(f"Save file too large ({size // 1024}KB). Max is {MAX_SAVE_SIZE // 1024 // 1024}MB.")
    with open(path, "rb") as f:
        raw = f.read()
    player_bytes = BaseApp.unwrap_player_data(raw)
    player = read_protobuf(player_bytes)
    return raw, player


def validate_items(player: dict[int, Any], warn_only: bool = False) -> None:
    """Pre-write validation: check all items for structural integrity.
    Raises ValueError if any item has out-of-range values.
    If warn_only=True, logs warnings instead of raising (Project Paris Bug 12:
    pre-existing corrupt items were blocking edits to unrelated items).
    """
    errors = []
    for field_num, category in [(54, "weapons"), (53, "items"), (41, "bank")]:
        if field_num not in player:
            continue
        for idx, entry in enumerate(player[field_num]):
            sub = read_protobuf(entry[1])
            if 1 not in sub:
                continue
            raw_item = sub[1][0][1]
            try:
                is_weapon, item_values, key = unwrap_item(raw_item)
            except Exception as e:
                errors.append(f"{category}[{idx}]: failed to unpack: {e}")
                continue

            if is_fake_item(is_weapon, item_values):
                continue

            # Check for fully empty/corrupted items (all None or all zero in critical fields)
            critical = item_values[1:4]  # type, balance, manufacturer
            if all(v is None for v in critical):
                errors.append(f"{category}[{idx}]: corrupted item (all critical fields are None)")
                continue

            sizes = ITEM_SIZES[is_weapon]
            for i, (val, size) in enumerate(zip(item_values, sizes)):
                if val is None:
                    continue
                max_val = (1 << size) - 1
                if val < 0 or val > max_val:
                    errors.append(f"{category}[{idx}] field {i}: value {val} exceeds {size}-bit max ({max_val})")

            # Check grade_index and game_stage are in sane range
            grade = item_values[4] if len(item_values) > 4 and item_values[4] is not None else 0
            stage = item_values[5] if len(item_values) > 5 and item_values[5] is not None else 0
            if grade > 127:
                errors.append(f"{category}[{idx}]: grade_index {grade} exceeds max 127")
            if stage > 127:
                errors.append(f"{category}[{idx}]: game_stage {stage} exceeds max 127")

    if errors:
        msg = f"Item validation ({len(errors)} errors): " + "; ".join(errors[:5])
        if warn_only:
            logging.getLogger("bl2editor").warning("Proceeding despite: " + msg)
        else:
            raise ValueError(msg)


def _rotate_backups(path: str) -> None:
    """Rotate backup files: .bak.N-1 -> .bak.N, .bak -> .bak.1, current -> .bak"""
    # Rotate existing numbered backups downward
    for i in range(BACKUP_GENERATIONS - 1, 0, -1):
        src = f"{path}.bak.{i}"
        dst = f"{path}.bak.{i + 1}"
        if os.path.exists(src):
            if os.path.exists(dst):
                os.remove(dst)
            os.rename(src, dst)

    # Rotate .bak -> .bak.1
    bak = path + ".bak"
    if os.path.exists(bak):
        dst = path + ".bak.1"
        if os.path.exists(dst):
            os.remove(dst)
        os.rename(bak, dst)

    # Current -> .bak
    if os.path.exists(path):
        shutil.copy2(path, bak)


def write_save(filename: str, player: dict[int, Any], warn_only_validation: bool = False) -> None:
    """Write player dict back to save file with rotating backups and atomic write."""
    lock = _get_file_lock(filename)
    if not lock.acquire(timeout=10):
        raise RuntimeError(f"Cannot write {filename}: another operation is in progress")
    try:
        _write_save_locked(filename, player, warn_only_validation)
    finally:
        lock.release()

def _write_save_locked(filename: str, player: dict[int, Any], warn_only_validation: bool = False) -> None:
    """Internal write — must be called with file lock held."""
    path = os.path.join(SAVE_DIR, filename)

    # Pre-write validation
    validate_items(player, warn_only=warn_only_validation)

    # Rotate backups before writing
    _rotate_backups(path)

    player_bytes = write_protobuf(player)

    # wrap_player_data logic (from savefile.py:423-442)
    crc = binascii.crc32(player_bytes) & 0xFFFFFFFF

    from borderlands.datautil.bitstreams import WriteBitstream
    from borderlands.datautil.huffman import make_huffman_tree, write_huffman_tree, huffman_compress, invert_tree

    bitstream = WriteBitstream()
    tree = make_huffman_tree(player_bytes)
    write_huffman_tree(tree, bitstream)
    huffman_compress(invert_tree(tree), player_bytes, bitstream)
    data = bitstream.getvalue() + b"\x00\x00\x00\x00"

    header = struct.pack(">I3s", len(data) + 15, b'WSG')
    header += struct.pack("<III", 2, crc, len(player_bytes))

    from borderlands.datautil.lzo1x import lzo1x_1_compress
    compressed = lzo1x_1_compress(header + data)[1:]

    save_bytes = hashlib.sha1(compressed).digest() + compressed

    # Atomic write: write to temp file, then rename
    tmp_path = path + ".tmp"
    with open(tmp_path, "wb") as f:
        f.write(save_bytes)
    os.replace(tmp_path, path)

    # Verify write: read back and check SHA1 + item count
    with open(path, "rb") as f:
        written = f.read()
    if written[:20] != hashlib.sha1(written[20:]).digest():
        raise RuntimeError("Save verification failed: SHA1 mismatch after write")
    readback = BaseApp.unwrap_player_data(written)
    rb_player = read_protobuf(readback)
    for fld in (54, 53, 41):
        orig_count = len(player.get(fld, []))
        rb_count = len(rb_player.get(fld, []))
        if orig_count != rb_count:
            raise RuntimeError(f"Save verification failed: field {fld} had {orig_count} items, readback has {rb_count}")


def pack_item_values(is_weapon: int, values: list[Optional[int]]) -> bytes:
    """Pack item values into bytes."""
    sizes = ITEM_SIZES[is_weapon]
    i = 0
    item_bytes = bytearray(32)
    for value, size in zip(values, sizes):
        if value is None:
            break
        j = i >> 3
        value = value << (i & 7)
        while value != 0:
            item_bytes[j] |= value & 0xFF
            value = value >> 8
            j = j + 1
        i = i + size
    if (i & 7) != 0:
        value = 0xFF << (i & 7)
        item_bytes[i >> 3] |= value & 0xFF
    return bytes(item_bytes[: (i + 7) >> 3])


def unpack_item_values(is_weapon: int, data: bytes) -> list[Optional[int]]:
    """Unpack item values from bytes."""
    sizes = ITEM_SIZES[is_weapon]
    i = 8
    data = b' ' + data
    end = len(data) * 8
    result = []
    for size in sizes:
        j = i + size
        if j > end:
            result.append(None)
            continue
        value = 0
        for b in data[j >> 3: (i >> 3) - 1: -1]:
            value = (value << 8) | b
        result.append((value >> (i & 7)) & ~(0xFF << size))
        i = j
    return result


def unwrap_item(data: bytes) -> tuple[int, list[Optional[int]], int]:
    """Decode packed item binary. Returns (is_weapon, values, key)."""
    version_type, key = struct.unpack(">Bi", data[:5])
    is_weapon = version_type >> 7
    raw = rotate_data_right(xor_data(data[5:], key >> 5), key & 31)
    return is_weapon, unpack_item_values(is_weapon, raw[2:]), key


def wrap_item(is_weapon: int, values: list[Optional[int]], key: int) -> bytes:
    """Encode item values to packed binary."""
    item = pack_item_values(is_weapon, values)
    header = struct.pack(">Bi", (is_weapon << 7) | ITEM_STRUCT_VERSION, key)
    return header + create_body(item=item, header=header, key=key)


def unwrap_item_info(value: bytes) -> dict[str, Any]:
    """High-level item decode with lib/asset split."""
    is_weapon, item, key = unwrap_item(value)
    data = {
        "is_weapon": is_weapon,
        "key": key,
        "set": item[0],
        "level": [item[4], item[5]],
        "_raw": base64.b64encode(value).decode("latin1"),
    }
    for i, (k, bits) in enumerate(ITEM_HEADER_SIZES[is_weapon]):
        x = item[1 + i]
        if x is None:
            data[k] = {"lib": 0, "asset": 0}
            continue
        lib = x >> bits
        asset = x & ~(lib << bits)
        data[k] = {"lib": lib, "asset": asset}
    bits = 10 + is_weapon
    parts = []
    for x in item[6:]:
        if x is None:
            parts.append(None)
        else:
            lib = x >> bits
            asset = x & ~(lib << bits)
            parts.append({"lib": lib, "asset": asset})
    data["parts"] = parts
    return data


def wrap_item_info(value: dict[str, Any]) -> bytes:
    """High-level item encode from dict."""
    parts = [value["set"]]
    for key, bits in ITEM_HEADER_SIZES[value["is_weapon"]]:
        v = value[key]
        parts.append((v["lib"] << bits) | v["asset"])
    parts.extend(value["level"])
    bits = 10 + value["is_weapon"]
    for v in value["parts"]:
        if v is None:
            parts.append(None)
        else:
            parts.append((v["lib"] << bits) | v["asset"])
    return wrap_item(value["is_weapon"], parts, value["key"])


def is_fake_item(is_weapon: int, item_values: list[Optional[int]]) -> bool:
    """Check if this is a 'virtual' DLC data item, not a real item."""
    return item_values[0] == 255 and all(val == 0 for val in item_values[1:] if val is not None)


def extract_character_info(player: dict[int, Any]) -> dict[str, Any]:
    """Extract character info from parsed player dict."""
    char_class = player[1][0][1] if 1 in player else b""
    if isinstance(char_class, bytes):
        class_name = CLASS_NAMES.get(char_class, char_class.decode("latin1", errors="replace"))
        char_class_str = char_class.decode("latin1", errors="replace")
    else:
        class_name = str(char_class)
        char_class_str = str(char_class)

    level = player[2][0][1] if 2 in player else 1
    xp = player[3][0][1] if 3 in player else 0
    skill_points = player[4][0][1] if 4 in player else 0

    # Currency
    money = eridium = seraph = torgue = 0
    if 6 in player:
        raw_currency = player[6][0][1]
        if isinstance(raw_currency, list):
            currency = raw_currency
        else:
            currency = read_repeated_protobuf_value(raw_currency, 0)
        money = currency[0] if len(currency) > 0 else 0
        eridium = currency[1] if len(currency) > 1 else 0
        seraph = currency[2] if len(currency) > 2 else 0
        torgue = currency[4] if len(currency) > 4 else 0

    # Sizes
    inventory_size = 12
    weapon_slots = 2
    if 13 in player:
        slots = read_protobuf(player[13][0][1])
        inventory_size = slots[1][0][1] if 1 in slots else 12
        weapon_slots = slots[2][0][1] if 2 in slots else 2

    # Bank size
    bank_size = player[56][0][1] if 56 in player else 6

    # Name and appearance colors
    name = ""
    appearance_colors = []
    if 19 in player:
        appearance = read_protobuf(player[19][0][1])
        if 1 in appearance:
            raw_name = appearance[1][0][1]
            name = raw_name.decode("utf-8", errors="replace") if isinstance(raw_name, bytes) else str(raw_name)
        # Extract ARGB colors from subfields 2, 3, 4
        for color_field in (2, 3, 4):
            if color_field in appearance:
                color_pb = read_protobuf(appearance[color_field][0][1])
                appearance_colors.append({
                    "a": color_pb[1][0][1] if 1 in color_pb else 255,
                    "r": color_pb[2][0][1] if 2 in color_pb else 127,
                    "g": color_pb[3][0][1] if 3 in color_pb else 127,
                    "b": color_pb[4][0][1] if 4 in color_pb else 127,
                })
            else:
                appearance_colors.append({"a": 255, "r": 127, "g": 127, "b": 127})

    # Head and skin customization (field 35)
    head_asset = ""
    skin_asset = ""
    if 35 in player:
        entries = player[35]
        if len(entries) > 0:
            val = entries[0][1]
            head_asset = val.decode("latin-1") if isinstance(val, bytes) else str(val)
        if len(entries) > 4:
            val = entries[4][1]
            skin_asset = val.decode("latin-1") if isinstance(val, bytes) else str(val)

    playthroughs = player[7][0][1] if 7 in player else 0
    time_played = player[25][0][1] if 25 in player else 0
    save_game_id = player[20][0][1] if 20 in player else 0

    # Golden keys (currency index 3, already parsed above)
    golden_keys = 0
    if 6 in player:
        golden_keys = currency[3] if len(currency) > 3 else 0

    # OP level — stored as a special virtual item in field 53
    # Bug 14b: must verify item is fake (set=255, all others 0) AND id byte is 4
    op_level = 0
    if 53 in player:
        for entry in player[53]:
            sub = read_protobuf(entry[1])
            if 1 not in sub or 2 not in sub:
                continue
            is_w, vals, _ = unwrap_item(sub[1][0][1])
            if not is_fake_item(is_w, vals):
                continue
            raw_val = sub[2][0][1]
            idnum = (-raw_val) & 0xFF
            if idnum == 4:
                op_level = max(0, (-raw_val) >> 8) & 0x7FFFFF
                break

    return {
        "class": char_class_str,
        "class_name": class_name,
        "level": level,
        "experience": xp,
        "skill_points": skill_points,
        "money": money,
        "eridium": eridium,
        "seraph": seraph,
        "torgue": torgue,
        "golden_keys": golden_keys,
        "inventory_size": inventory_size,
        "weapon_slots": weapon_slots,
        "bank_size": bank_size,
        "name": name,
        "playthroughs_completed": playthroughs,
        "time_played": time_played,
        "save_game_id": save_game_id,
        "op_level": op_level,
        "appearance_colors": appearance_colors,
        "head_asset": head_asset,
        "skin_asset": skin_asset,
        "skills": extract_skills(player),
        "ammo": extract_ammo(player),
    }


def extract_skills(player: dict[int, Any]) -> dict[str, int]:
    """Extract skill allocations from player data."""
    skills = {}
    if 8 not in player:
        return skills
    for entry in player[8]:
        sub = read_protobuf(entry[1])
        name = sub[1][0][1] if 1 in sub else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        level = sub[2][0][1] if 2 in sub else 0
        skills[name] = level
    return skills


# ─── Mission & Fast Travel ──────────────────────────────────

MISSION_STATUS_NAMES = {1: "Active", 4: "Complete"}
PLAYTHROUGH_LABELS = ["Normal", "TVHM", "UVHM"]

FAST_TRAVEL_STATIONS = {
    # Base game
    "Glacier": "Claptrap's Place",
    "SouthernShelf": "Southern Shelf",
    "SouthernShelfTown": "Liar's Berg",
    "GlacialIgloo": "Three Horns - Divide",
    "IceEast": "Three Horns - Valley",
    "Frost": "Three Horns - Valley",
    "Sanctuary": "Sanctuary",
    "SanctuaryAir": "Sanctuary (Flying)",
    "Grass": "The Highlands",
    "GrassCliffs": "Thousand Cuts",
    "GrassLynchwood": "Lynchwood",
    "Outwash": "The Highlands - Outwash",
    "IceCanyon": "Frostburn Canyon",
    "Interlude": "The Dust",
    "TundraExpress": "Tundra Express",
    "Dam": "Bloodshot Stronghold",
    "DamTop": "Bloodshot Ramparts",
    "Fridge": "The Fridge",
    "HypInterlude": "Friendship Gulag",
    "HyperionCity": "Opportunity",
    "PandoraPark": "Wildlife Exploitation Preserve",
    "Ash": "Eridium Blight",
    "BossCliffs": "The Bunker",
    "VOGChamber": "Control Core Angel",
    "CraterLake": "Sawtooth Cauldron",
    "Fyrestone": "Arid Nexus - Boneyard",
    "Stockade": "Arid Nexus - Badlands",
    "FinalBossAscent": "Hero's Pass",
    "BossVolcano": "Vault of the Warrior",
    "Cove": "Southern Shelf - Bay",
    "SouthpawFactory": "Southpaw Steam & Power",
    "ThresherRaid": "Terramorphous Peak",
    "Caverns": "Caustic Caverns",
    "SanctuaryHole": "Sanctuary Hole",
    "BanditSlaughter": "Fink's Slaughterhouse",
    "CreatureSlaughter": "Natural Selection Annex",
    "RobotSlaughter": "Ore Chasm",
    "Luckys": "The Holy Spirits",
    "TundraTrain": "End of the Line",
    "TestingZone": "Digistruct Peak",
    # Captain Scarlett DLC
    "Orchid_OasisTown": "Oasis",
    "Orchid_SaltFlats": "Wurmwater",
    "Orchid_Caves": "Hayter's Folly",
    "Orchid_ShipGraveyard": "The Rustyards",
    "Orchid_Refinery": "Washburne Refinery",
    "Orchid_Spire": "Magnys Lighthouse",
    "Orchid_WormBelly": "The Leviathan's Lair",
    # Torgue DLC
    "Iris_Hub": "Badass Crater of Badassitude",
    "Iris_Hub2": "Southern Raceway",
    "Iris_DL1": "The Beatdown",
    "Iris_DL2": "Pyro Pete's Bar",
    "Iris_DL3": "Forge",
    "Iris_Moxxi": "Badass Crater Bar",
    # Hammerlock DLC
    "Sage_Underground": "Hunter's Grotto",
    "Sage_RockForest": "Scylla's Grove",
    "Sage_Cliffs": "Candlerakk's Crag",
    "Sage_HyperionShip": "H.S.S. Terminus",
    "Sage_PowerStation": "Ardorton Station",
    # Tiny Tina DLC
    "Dark_Forest": "The Forest",
    "Village": "Flamerock Refuge",
    "CastleExterior": "Hatred's Shadow",
    "CastleKeep": "Dragon Keep",
    "Dead_Forest": "Immortal Woods",
    "Dungeon": "Lair of Infinite Agony",
    "DungeonRaid": "The Winged Storm",
    "Mines": "Mines of Avarice",
    "TempleSlaughter": "Murderlin's Temple",
    # Fight for Sanctuary DLC
    "SanctIntro": "Fight for Sanctuary",
    "ResearchCenter": "Mt. Scarab Research Center",
    "BackBurner": "The Backburner",
    "OldDust": "Dahl Abandon",
    "Sandworm": "The Burrows",
    "SandwormLair": "Writhing Deep",
    "GaiusSanctuary": "Paradise Sanctum",
    "Helios": "Helios Fallen",
    # Headhunter DLCs
    "Pumpkin_Patch": "Hallowed Hollow",
    "Xmas": "Marcus's Mercenary Shop",
    "Distillery": "Rotgut Distillery",
    "Easter": "Wam Bam Island",
    "Hunger": "Gluttony Gulch",
    "Docks": "Unassuming Docks",
}

ALL_BASE_STATIONS = [
    "Glacier", "SouthernShelf", "SouthernShelfTown", "Cove",
    "GlacialIgloo", "IceEast", "Frost",
    "IceCanyon", "Sanctuary", "Dam", "DamTop",
    "TundraExpress", "Interlude",
    "Fridge", "HypInterlude", "Grass", "GrassCliffs",
    "GrassLynchwood", "Outwash", "HyperionCity",
    "PandoraPark", "SouthpawFactory",
    "Ash", "BossCliffs", "VOGChamber",
    "CraterLake", "Fyrestone", "Stockade",
    "FinalBossAscent", "BossVolcano",
    "SanctuaryHole", "ThresherRaid", "Caverns",
    "BanditSlaughter", "CreatureSlaughter", "RobotSlaughter",
    "Luckys", "TundraTrain", "TestingZone",
]

# DLC station sets keyed by DLC name
DLC_STATIONS = {
    "Captain Scarlett": [
        "Orchid_OasisTown", "Orchid_SaltFlats", "Orchid_Caves",
        "Orchid_ShipGraveyard", "Orchid_Refinery", "Orchid_Spire", "Orchid_WormBelly",
    ],
    "Mr. Torgue": [
        "Iris_Hub", "Iris_Hub2", "Iris_DL1", "Iris_DL2", "Iris_DL3", "Iris_Moxxi",
    ],
    "Hammerlock": [
        "Sage_Underground", "Sage_RockForest", "Sage_Cliffs",
        "Sage_HyperionShip", "Sage_PowerStation",
    ],
    "Tiny Tina": [
        "Dark_Forest", "Village", "CastleExterior", "CastleKeep",
        "Dead_Forest", "Dungeon", "DungeonRaid", "Mines", "TempleSlaughter",
    ],
    "Fight for Sanctuary": [
        "SanctIntro", "ResearchCenter", "BackBurner", "OldDust",
        "Sandworm", "SandwormLair", "GaiusSanctuary", "Helios",
    ],
    "Headhunter Packs": [
        "Pumpkin_Patch", "Xmas", "Distillery", "Easter", "Hunger", "Docks",
    ],
}

ALL_DLC_STATIONS = [s for dlc in DLC_STATIONS.values() for s in dlc]
ALL_KNOWN_STATIONS = ALL_BASE_STATIONS + ALL_DLC_STATIONS

# (path, display_name, num_objectives, is_story)
MISSION_DB = [
    # (path, display_name, num_objectives, is_story, normal_level)
    # Story Missions
    ("GD_Episode01.M_Ep1_Champion", "My First Gun", 1, True, 1),
    ("GD_Episode02.M_Ep2_Henchman", "Blindsided", 9, True, 3),
    ("GD_Episode02.M_Ep2a_MoreGuns", "Cleaning Up the Berg", 7, True, 4),
    ("GD_Episode02.M_Ep2b_Henchman", "The Flynt Job", 5, True, 5),
    ("GD_Episode02.M_Ep2c_Henchman", "Best Minion Ever", 14, True, 6),
    ("GD_Episode03.M_Ep3_CatchARide", "The Road to Sanctuary", 14, True, 8),
    ("GD_Episode04.M_Ep4_WelcomeToSanctuary", "Plan B", 12, True, 8),
    ("GD_Episode05.M_Ep5_GatherArms", "Hunting the Firehawk", 12, True, 8),
    ("GD_Episode06.M_Ep6_RolandFindHQ", "A Dam Fine Rescue", 14, True, 11),
    ("GD_Episode07.M_Ep7_DestroyBandits", "A Train to Catch", 8, True, 13),
    ("GD_Episode08.M_Ep8_RiseOfThePhoenix", "Rising Action", 10, True, 16),
    ("GD_Episode09.M_Ep9_TheGateKeeper", "Bright Lights, Flying City", 15, True, 17),
    ("GD_Episode09a.M_Ep9a_Wildlife", "Wildlife Preservation", 12, True, 19),
    ("GD_Episode10.M_Ep10_TheWarehouse", "The Once and Future Slab", 10, True, 21),
    ("GD_Episode11.M_Ep11_TheManWhoWouldBeJack", "The Man Who Would Be Jack", 8, True, 24),
    ("GD_Episode12.M_Ep12_WhereToBuyAngels", "Where Angels Fear to Tread", 14, True, 26),
    ("GD_Episode12a.M_Ep12a_SayGoodbye", "Where Angels Fear to Tread (Part 2)", 6, True, 28),
    ("GD_Episode13.M_Ep13_TheTalon", "The Talon of God", 10, True, 30),
    ("GD_Episode14.M_Ep14_TheEndOfTheBeginning", "Data Mining", 8, True, 30),
    # Side Missions - Southern Shelf / Three Horns
    ("GD_Z1_ThisTown.M_ThisTown", "This Town Ain't Big Enough", 6, False, 5),
    ("GD_Z1_BadHairDay.M_BadHairDay", "Bad Hair Day", 4, False, 5),
    ("GD_Z1_Handsome.M_HandsomestJack", "Handsome Jack Here!", 3, False, 8),
    ("GD_Z1_Symbiosis.M_Symbiosis", "Symbiosis", 5, False, 6),
    ("GD_Z1_ShieldedFavors.M_ShieldedFavors", "Shielded Favors", 3, False, 7),
    # Side Missions - Sanctuary
    ("GD_Z2_ClaptrapStash.M_ClaptrapStash", "Claptrap's Secret Stash", 3, False, 8),
    ("GD_Z2_RockPaperGenocide.M_RockPaperGenocide", "Rock Paper Genocide", 8, False, 12),
    ("GD_Z2_MedicalMystery.M_MedicalMystery", "Medical Mystery", 5, False, 16),
    ("GD_Z2_SplinterGroup.M_SplinterGroup", "Splinter Group", 6, False, 15),
    ("GD_Z2_DoctorsOrders.M_DoctorsOrders", "Doctor's Orders", 6, False, 19),
    ("GD_Z2_SafeAndSound.M_SafeAndSound", "Safe and Sound", 3, False, 16),
    # Side Missions - Frostburn / Highlands
    ("GD_Z2_Cult.M_CultFollowing", "Cult Following", 8, False, 10),
    ("GD_Z2_ArmsDeal.M_ArmsDeal", "Arms Dealing", 5, False, 12),
    ("GD_Z2_PizzaDelivery.M_PizzaDelivery", "Bandit Slaughter", 4, False, 12),
    ("GD_Z3_MightyMorphin.M_MightyMorphin", "Mighty Morphin'", 5, False, 12),
    ("GD_Z3_PositivelyBeastly.M_MonsterHunt", "Positive Self Image", 4, False, 17),
    ("GD_Z3_MineAllMine.M_MineAllMine", "Mine All Mine", 4, False, 16),
    # Side Missions - Dust / Lynchwood
    ("GD_Z2_TheGoodTheBadAndTheMordecai.M_GoodBadMord", "The Good, the Bad, and the Mordecai", 5, False, 16),
    ("GD_Z2_Assassinate.M_AssassinateTheAssassins", "Assassinate the Assassins", 6, False, 10),
    ("GD_Z2_YouAreCordiouslyInvited.M_CordiouslyInvited", "You Are Cordially Invited", 6, False, 15),
    ("GD_Z3_TheIceMan.M_IceManCometh", "The Ice Man Cometh", 5, False, 17),
    ("GD_Z3_ToArms.M_ToArms", "To Arms!", 4, False, 19),
    # Side Missions - Tundra Express / Frostburn
    ("GD_Z2_NoVacancy.M_NoVacancy", "No Vacancy", 4, False, 13),
    ("GD_Z2_YouDontKnowJack.M_YouDontKnowJack", "You. Will. Die. (Seriously.)", 3, False, 13),
    ("GD_Z2_CultFollowing2.M_CultFollowing2", "Cult Following: Eternal Flame", 5, False, 10),
    ("GD_Z2_CultFollowing3.M_CultFollowing3", "Cult Following: Lighting the Match", 4, False, 10),
    ("GD_Z2_CultFollowing4.M_CultFollowing4", "Cult Following: The Enkindling", 6, False, 10),
    ("GD_Z2_IncineratorClayton.M_IncineratorClayton", "Incinerator Clayton", 3, False, 10),
    # Side Missions - Highlands / Thousand Cuts
    ("GD_Z3_Slap.M_SlapHappy", "Slap Happy", 4, False, 17),
    ("GD_Z3_ArmsDealer.M_ArmsDealer", "Arms Dealer", 4, False, 17),
    ("GD_Z3_HuntersGrotto.M_HuntersGrotto", "Stalker of Stalkers", 4, False, 19),
    ("GD_Z3_Prisoner.M_Prisoner", "The Overlooked: Shields Up", 4, False, 21),
    ("GD_Z3_MedicineMan.M_MedicineMan", "The Overlooked: Medicine Man", 5, False, 21),
    ("GD_Z3_ThisJustIn.M_ThisJustIn", "This Just In", 4, False, 19),
    ("GD_Z3_Hyperion.M_HomeMovies", "Home Movies", 4, False, 19),
    ("GD_Z3_RakManHasEnemies.M_RakManHasEnemies", "Rakkaholics Anonymous", 3, False, 17),
    # Side Missions - Wildlife Preserve / Opportunity
    ("GD_Z3_DocMercy.M_DocMercy", "Medical Mystery: X-Com-municate", 3, False, 19),
    ("GD_Z3_AnimalRights.M_AnimalRights", "Animal Rights", 5, False, 19),
    ("GD_Z3_WritersBlock.M_WritersBlock", "Written by the Victor", 6, False, 21),
    ("GD_Z3_Uncle.M_UncleTeddy", "Uncle Teddy", 4, False, 21),
    # Side Missions - Eridium Blight / Sawtooth
    ("GD_Z3_RockosMWS.M_RockosMWS", "Rocko's Modern Strife", 4, False, 21),
    ("GD_Z3_CustomerService.M_CustomerService", "Customer Service", 4, False, 23),
    ("GD_Z3_FakingDeath.M_FakingDeath", "Kill Yourself", 1, False, 21),
    ("GD_Z3_BoatMission.M_BoatMission", "A Real Boy: Clothes Make the Man", 4, False, 24),
    ("GD_Z3_DemonsOfTheHorse.M_DemonHorse", "The Cold Shoulder", 4, False, 24),
    # Side Missions - Arid Nexus / Endgame
    ("GD_Z3_GetToKnowJack.M_GetToKnowJack", "Get to Know Jack", 6, False, 25),
    ("GD_Z3_TreasureOfTheSands.M_TreasureOfTheSands", "The Bane", 6, False, 18),
    ("GD_Z3_MonsterMash.M_MonsterMash", "Monster Mash", 5, False, 20),
    ("GD_Z3_Overlooked.M_Overlooked", "Overlooked", 4, False, 21),
    ("GD_Z3_WrittenByTinyTina.M_WrittenByTinyTina", "Tiny Tina's Tea Party", 5, False, 24),
    ("GD_Z3_ShootMeInTheFace.M_ShootMeInTheFace", "Shoot This Guy in the Face", 1, False, 24),
    ("GD_Z3_ClaptrapBday.M_ClaptrapBday", "Claptrap's Birthday Bash!", 3, False, 26),
    ("GD_Z3_RaidBoss.M_TerramorphousRaid", "You. Will. Die. (Seriously.)", 1, False, 30),
    # Caustic Caverns / Other
    ("GD_Z3_MinecartMischief.M_MinecartMischief", "Minecart Mischief", 4, False, 18),
    ("GD_Z3_FollowTheGlow.M_FollowTheGlow", "The Lost Treasure", 5, False, 18),
    ("GD_Z3_BreakingTheBank.M_BreakingTheBank", "Breaking the Bank", 3, False, 24),
    ("GD_Z3_NoteForSelf.M_NoteForSelf", "Note for Self-Person", 3, False, 16),
]

STORY_MISSIONS = [m[0] for m in MISSION_DB if m[3]]

MISSION_DISPLAY_NAMES = {m[0]: m[1] for m in MISSION_DB}
MISSION_OBJECTIVES = {m[0]: m[2] for m in MISSION_DB}
MISSION_LEVELS = {m[0]: m[4] for m in MISSION_DB}


def _format_mission_name(path: str) -> str:
    """Convert mission path to display name. Uses DB if available, else parses."""
    if not path:
        return ""
    if path in MISSION_DISPLAY_NAMES:
        return MISSION_DISPLAY_NAMES[path]
    # Fallback: parse from path
    name = path.rsplit(".", 1)[-1]
    if name.startswith("M_"):
        name = name[2:]
    name = re.sub(r'^Ep\d+[a-z]?_', '', name)
    name = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
    name = name.replace('_', ' ')
    return name


def extract_missions(player: dict[int, Any]) -> dict[str, Any]:
    """Extract mission data per playthrough."""
    active_pt = player[49][0][1] if 49 in player else 0
    result: dict[str, Any] = {"active_playthrough": active_pt, "playthroughs": []}
    for pt_idx, pt_entry in enumerate(player.get(18, [])):
        pt_data = read_protobuf(pt_entry[1])
        active_mission = pt_data[2][0][1] if 2 in pt_data else b""
        if isinstance(active_mission, bytes):
            active_mission = active_mission.decode("latin1", errors="replace")
        missions = []
        for m_entry in pt_data.get(3, []):
            md = read_protobuf(m_entry[1])
            name = md[1][0][1] if 1 in md else b""
            if isinstance(name, bytes):
                name = name.decode("latin1", errors="replace")
            status = md[2][0][1] if 2 in md else 0
            level = md[11][0][1] if 11 in md else 0
            is_dlc = md[3][0][1] if 3 in md else 0
            dlc_id = md[4][0][1] if 4 in md else 0
            missions.append({
                "name": name,
                "display_name": _format_mission_name(name),
                "status": status,
                "status_text": MISSION_STATUS_NAMES.get(status, f"Unknown ({status})"),
                "level": level,
                "is_dlc": bool(is_dlc),
                "dlc_id": dlc_id,
            })
        label = PLAYTHROUGH_LABELS[pt_idx] if pt_idx < 3 else f"PT{pt_idx + 1}"
        result["playthroughs"].append({
            "index": pt_idx,
            "label": label,
            "active_mission": active_mission,
            "active_mission_display": _format_mission_name(active_mission),
            "missions": missions,
        })
    return result


def extract_fast_travel(player: dict[int, Any]) -> dict[str, Any]:
    """Extract fast travel station data."""
    stations = []
    for entry in player.get(16, []):
        val = entry[1]
        if isinstance(val, bytes):
            val = val.decode("latin1", errors="replace")
        stations.append({
            "name": val,
            "display_name": FAST_TRAVEL_STATIONS.get(val, val),
        })
    last = ""
    if 17 in player:
        last = player[17][0][1]
        if isinstance(last, bytes):
            last = last.decode("latin1", errors="replace")
    return {
        "stations": stations,
        "last_visited": last,
        "last_visited_display": FAST_TRAVEL_STATIONS.get(last, last),
    }


def set_mission_status(filename: str, playthrough: int, mission_name: str,
                       new_status: int) -> bool:
    """Change a mission's status (1=Active, 4=Complete)."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return False
    pt_data = read_protobuf(player[18][playthrough][1])
    missions = pt_data.get(3, [])
    found = False
    for m_entry in missions:
        md = read_protobuf(m_entry[1])
        name = md[1][0][1] if 1 in md else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        if name == mission_name:
            md[2] = [[0, new_status]]
            m_entry[1] = write_protobuf(md)
            found = True
            break
    if not found:
        return False
    pt_data[3] = missions
    player[18][playthrough][1] = write_protobuf(pt_data)
    write_save(filename, player)
    return True


def complete_all_missions(filename: str, playthrough: int) -> int:
    """Mark all missions in a playthrough as complete. Returns count changed."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return 0
    pt_data = read_protobuf(player[18][playthrough][1])
    missions = pt_data.get(3, [])
    count = 0
    for m_entry in missions:
        md = read_protobuf(m_entry[1])
        status = md[2][0][1] if 2 in md else 0
        if status != 4:
            md[2] = [[0, 4]]
            m_entry[1] = write_protobuf(md)
            count += 1
    if count > 0:
        pt_data[3] = missions
        player[18][playthrough][1] = write_protobuf(pt_data)
        write_save(filename, player)
    return count


def update_fast_travel(filename: str, stations: list[str]) -> bool:
    """Replace the fast travel station list."""
    _, player = read_save(filename)
    player[16] = [[2, s.encode("latin1") if isinstance(s, str) else s]
                  for s in stations]
    write_save(filename, player)
    return True


def unlock_all_fast_travel(filename: str) -> int:
    """Unlock all base game fast travel stations. Returns count added."""
    _, player = read_save(filename)
    existing = set()
    for entry in player.get(16, []):
        val = entry[1]
        if isinstance(val, bytes):
            val = val.decode("latin1", errors="replace")
        existing.add(val)
    added = 0
    for station in ALL_BASE_STATIONS:
        if station not in existing:
            player.setdefault(16, []).append([2, station.encode("latin1")])
            added += 1
    if added > 0:
        write_save(filename, player)
    return added



def unlock_achievements(filename: str) -> dict[str, Any]:
    """Set save state to satisfy all save-trackable achievement conditions.
    Completes all story missions in PT1, completes all challenges,
    sets level to max, unlocks TVHM/UVHM, unlocks all fast travel.
    Returns summary of changes made."""
    _, player = read_save(filename)
    changes = {}

    # 1. Max level and XP
    max_level = len(REQUIRED_XP)
    player[2] = [[0, max_level]]
    player[3] = [[0, REQUIRED_XP[max_level - 1]]]
    changes["level"] = max_level

    # 2. Unlock all playthroughs (TVHM + UVHM)
    player[7] = [[0, 2]]  # 2 = both TVHM and UVHM unlocked
    changes["playthroughs_unlocked"] = 2

    # 3. Complete all story missions in PT1 (playthrough 0)
    missions_completed = 0
    if 18 in player and len(player[18]) > 0:
        pt_data = read_protobuf(player[18][0][1])
        existing_missions = set()
        for m_entry in pt_data.get(3, []):
            md = read_protobuf(m_entry[1])
            name = md[1][0][1] if 1 in md else b""
            if isinstance(name, bytes):
                name = name.decode("latin1", errors="replace")
            existing_missions.add(name)
            status = md[2][0][1] if 2 in md else 0
            if status != 4:
                md[2] = [[0, 4]]
                m_entry[1] = write_protobuf(md)
                missions_completed += 1
        # Add missing story missions as completed
        for mission_path in STORY_MISSIONS:
            if mission_path not in existing_missions:
                level = MISSION_LEVELS.get(mission_path, 30)
                m_data = write_protobuf({
                    1: [[2, mission_path.encode("latin1")]],
                    2: [[0, 4]],
                    3: [[0, 0]],
                    4: [[0, 0]],
                    11: [[0, level]],
                })
                pt_data.setdefault(3, []).append([2, m_data])
                missions_completed += 1
        pt_data[3] = pt_data.get(3, [])
        player[18][0][1] = write_protobuf(pt_data)
    changes["missions_completed"] = missions_completed

    # 4. Complete all challenges
    challenges_completed = 0
    for entry in player.get(38, []):
        sub = read_protobuf(entry[1])
        old_completed = sub[3][0][1] if 3 in sub else 0
        if old_completed < 1:
            sub[2] = [[0, 99999]]
            sub[3] = [[0, 1]]
            entry[1] = write_protobuf(sub)
            challenges_completed += 1
    changes["challenges_completed"] = challenges_completed

    # 5. Unlock all base + DLC fast travel stations
    existing_stations = set()
    for entry in player.get(16, []):
        val = entry[1]
        if isinstance(val, bytes):
            val = val.decode("latin1", errors="replace")
        existing_stations.add(val)
    stations_added = 0
    for station in ALL_KNOWN_STATIONS:
        if station not in existing_stations:
            player.setdefault(16, []).append([2, station.encode("latin1")])
            existing_stations.add(station)
            stations_added += 1
    changes["stations_unlocked"] = stations_added

    # 6. Ensure Slaughterdome unlocked (field 23)
    if 23 in player:
        unlocks = player[23][0][1]
        if isinstance(unlocks, bytes) and b"\x01" not in unlocks:
            player[23] = [[2, unlocks + b"\x01"]]
    else:
        player[23] = [[2, b"\x01"]]

    write_save(filename, player)
    return changes


def add_mission(filename: str, playthrough: int, mission_name: str,
                 status: int = 1, level: int = 1) -> bool:
    """Add a mission to a playthrough. status=1 for active, 4 for complete."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return False
    pt_data = read_protobuf(player[18][playthrough][1])
    # Check if mission already exists
    for m_entry in pt_data.get(3, []):
        md = read_protobuf(m_entry[1])
        name = md[1][0][1] if 1 in md else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        if name == mission_name:
            return False  # already exists
    num_obj = MISSION_OBJECTIVES.get(mission_name, 5)
    if status == 4:
        obj_bytes = bytes([1] * num_obj)
    else:
        obj_bytes = bytes([0] * num_obj)
    mission_pb = write_protobuf({
        1: [[2, mission_name.encode("latin1")]],
        2: [[0, status]],
        3: [[0, 0]],   # is_from_dlc
        4: [[0, 0]],   # dlc_id
        5: [[2, obj_bytes]],
        6: [[0, len(obj_bytes) if status == 4 else 0]],
        8: [[0, 0]],
        10: [[0, 1]],
        11: [[0, level]],
    })
    pt_data.setdefault(3, []).append([2, mission_pb])
    player[18][playthrough][1] = write_protobuf(pt_data)
    write_save(filename, player)
    return True


def remove_mission(filename: str, playthrough: int, mission_name: str) -> bool:
    """Remove a mission from a playthrough."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return False
    pt_data = read_protobuf(player[18][playthrough][1])
    missions = pt_data.get(3, [])
    new_missions = []
    found = False
    for m_entry in missions:
        md = read_protobuf(m_entry[1])
        name = md[1][0][1] if 1 in md else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        if name == mission_name:
            found = True
        else:
            new_missions.append(m_entry)
    if not found:
        return False
    pt_data[3] = new_missions
    # BUG-31: clear active mission if the removed mission was being tracked
    if 2 in pt_data:
        active = pt_data[2][0][1]
        if isinstance(active, bytes):
            active = active.decode("latin1", errors="replace")
        if active == mission_name:
            pt_data[2] = [[2, b""]]
    player[18][playthrough][1] = write_protobuf(pt_data)
    write_save(filename, player)
    return True


def add_all_story_missions(filename: str, playthrough: int,
                           status: int = 1) -> int:
    """Add all story missions to a playthrough. Returns count added.
    Uses per-mission levels from MISSION_DB."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return 0
    pt_data = read_protobuf(player[18][playthrough][1])
    existing = set()
    for m_entry in pt_data.get(3, []):
        md = read_protobuf(m_entry[1])
        name = md[1][0][1] if 1 in md else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        existing.add(name)
    count = 0
    for mission_path in STORY_MISSIONS:
        if mission_path in existing:
            continue
        num_obj = MISSION_OBJECTIVES.get(mission_path, 5)
        level = MISSION_LEVELS.get(mission_path, 1)
        if status == 4:
            obj_bytes = bytes([1] * num_obj)
        else:
            obj_bytes = bytes([0] * num_obj)
        mission_pb = write_protobuf({
            1: [[2, mission_path.encode("latin1")]],
            2: [[0, status]],
            3: [[0, 0]],
            4: [[0, 0]],
            5: [[2, obj_bytes]],
            6: [[0, len(obj_bytes) if status == 4 else 0]],
            8: [[0, 0]],
            10: [[0, 1]],
            11: [[0, level]],
        })
        pt_data.setdefault(3, []).append([2, mission_pb])
        count += 1
    if count > 0:
        player[18][playthrough][1] = write_protobuf(pt_data)
        write_save(filename, player)
    return count


def set_active_mission(filename: str, playthrough: int, mission_name: str) -> bool:
    """Set the active/tracked mission for a playthrough.
    BUG-34: verifies mission exists in the playthrough before setting."""
    _, player = read_save(filename)
    if 18 not in player or playthrough < 0 or playthrough >= len(player[18]):
        return False
    pt_data = read_protobuf(player[18][playthrough][1])
    # Verify the mission exists in this playthrough
    found = False
    for m_entry in pt_data.get(3, []):
        md = read_protobuf(m_entry[1])
        name = md[1][0][1] if 1 in md else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        if name == mission_name:
            found = True
            break
    if not found:
        return False
    pt_data[2] = [[2, mission_name.encode("latin1")]]
    player[18][playthrough][1] = write_protobuf(pt_data)
    write_save(filename, player)
    return True


def unlock_playthrough(filename: str, target: str) -> bool:
    """Unlock TVHM or UVHM. target is 'tvhm' or 'uvhm'."""
    _, player = read_save(filename)
    if target == "uvhm":
        if player[7][0][1] < 2:
            player[7][0][1] = 2
    elif target == "tvhm":
        if player[7][0][1] < 1:
            player[7][0][1] = 1
    else:
        return False
    write_save(filename, player)
    return True


def set_active_playthrough(filename: str, playthrough: int) -> bool:
    """Set which playthrough is active (0=NVHM, 1=TVHM, 2=UVHM)."""
    _, player = read_save(filename)
    if playthrough < 0 or playthrough > 2:
        return False
    player[49] = [[0, playthrough]]
    write_save(filename, player)
    return True


def get_mission_db() -> list[dict[str, Any]]:
    """Return the mission database for the frontend."""
    return [{"path": m[0], "name": m[1], "objectives": m[2], "is_story": m[3],
             "level": m[4]} for m in MISSION_DB]


# ─── Ammo ──────────────────────────────────────────────────────

def extract_ammo(player: dict[int, Any]) -> list[dict[str, Any]]:
    """Extract ammo pool data from field 11."""
    result = []
    for entry in player.get(11, []):
        sub = read_protobuf(entry[1])
        res_name = ""
        if 1 in sub:
            raw = sub[1][0][1]
            res_name = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
        short = res_name.rsplit(".", 1)[-1] if res_name else ""
        raw_qty = sub[3][0][1] if 3 in sub else 0
        qty = struct.unpack("<f", struct.pack("<I", raw_qty & 0xFFFFFFFF))[0]
        upgrade = sub[4][0][1] if 4 in sub else 0
        result.append({
            "resource": res_name,
            "key": short,
            "display_name": AMMO_DISPLAY.get(short, short),
            "quantity": round(qty),
            "max": AMMO_MAXES.get(short, 999),
            "upgrade_level": upgrade,
        })
    return result


def set_ammo(filename: str, ammo_updates: dict[str, int]) -> bool:
    """Set ammo quantities. ammo_updates maps resource key to quantity."""
    _, player = read_save(filename)
    if 11 not in player:
        return False
    changed = False
    for entry in player[11]:
        sub = read_protobuf(entry[1])
        res_name = ""
        if 1 in sub:
            raw = sub[1][0][1]
            res_name = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
        short = res_name.rsplit(".", 1)[-1] if res_name else ""
        if short in ammo_updates:
            qty = max(0, int(ammo_updates[short]))
            packed = struct.unpack("<I", struct.pack("<f", float(qty)))[0]
            sub[3] = [[5, packed]]
            entry[1] = write_protobuf(sub)
            changed = True
    if changed:
        write_save(filename, player)
    return changed


def fill_all_ammo(filename: str) -> bool:
    """Fill all ammo pools to their max values. BUG-37: only writes if changed."""
    _, player = read_save(filename)
    if 11 not in player:
        return False
    changed = False
    for entry in player[11]:
        sub = read_protobuf(entry[1])
        res_name = ""
        if 1 in sub:
            raw = sub[1][0][1]
            res_name = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
        short = res_name.rsplit(".", 1)[-1] if res_name else ""
        max_val = AMMO_MAXES.get(short, 999)
        packed = struct.unpack("<I", struct.pack("<f", float(max_val)))[0]
        old_packed = sub[3][0][1] if 3 in sub else 0
        if old_packed != packed:
            sub[3] = [[5, packed]]
            entry[1] = write_protobuf(sub)
            changed = True
    if changed:
        write_save(filename, player)
    return True


# ─── OP Level ──────────────────────────────────────────────────

def set_op_level(filename: str, op_level: int) -> bool:
    """Set the overpower level (0-10). Stored as fake item in field 53.
    BUG-28: creates the fake item if it doesn't exist."""
    _, player = read_save(filename)
    op_level = max(0, min(10, int(op_level)))
    # Search for existing OP level fake item
    for entry in player.get(53, []):
        sub = read_protobuf(entry[1])
        if 1 not in sub or 2 not in sub:
            continue
        is_w, vals, _ = unwrap_item(sub[1][0][1])
        if not is_fake_item(is_w, vals):
            continue
        raw_val = sub[2][0][1]
        idnum = (-raw_val) & 0xFF
        if idnum == 4:
            new_raw = -((op_level << 8) | 4) & 0xFFFFFFFFFFFFFFFF
            sub[2] = [[0, new_raw]]
            entry[1] = write_protobuf(sub)
            write_save(filename, player)
            return True
    # No existing OP item — create one if op_level > 0
    if op_level > 0:
        fake_vals = [255] + [0] * (len(ITEM_SIZES[0]) - 1)
        fake_key = random.randrange(0x100000000) - 0x80000000
        fake_raw = wrap_item(0, fake_vals, fake_key)
        op_raw = -((op_level << 8) | 4) & 0xFFFFFFFFFFFFFFFF
        fake_entry = write_protobuf({
            1: [[2, fake_raw]],
            2: [[0, op_raw]],
        })
        player.setdefault(53, []).append([2, fake_entry])
        write_save(filename, player)
        return True
    return False


# ─── Challenges ────────────────────────────────────────────────

def _format_challenge_name(path: str) -> str:
    """Convert challenge path to display name."""
    name = path.rsplit(".", 1)[-1] if path else ""
    # Remove common prefixes
    for prefix in ("Challenge_Kill_", "Challenge_", "General_", "Player_",
                   "Enemies_Kill", "Enemies_", "MapECHO_"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    # Split camelCase
    name = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
    name = name.replace('_', ' ')
    return name


def extract_challenges(player: dict[int, Any]) -> dict[str, Any]:
    """Extract challenge data from field 38, grouped by category."""
    categories = {}
    for entry in player.get(38, []):
        sub = read_protobuf(entry[1])
        path = ""
        if 1 in sub:
            raw = sub[1][0][1]
            path = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
        progress = sub[2][0][1] if 2 in sub else 0
        completed = sub[3][0][1] if 3 in sub else 0
        # Determine category from path
        parts = path.split(".")
        cat_key = parts[1] if len(parts) > 1 else "Other"
        cat_display = CHALLENGE_CATEGORIES.get(cat_key, cat_key)
        categories.setdefault(cat_display, []).append({
            "path": path,
            "display_name": _format_challenge_name(path),
            "category": cat_display,
            "progress": progress,
            "completed_count": completed,
        })
    return {
        "categories": categories,
        "total": len(player.get(38, [])),
    }


def set_challenge_progress(filename: str, challenge_path: str,
                           progress: int, completed: int) -> bool:
    """Set a single challenge's progress and completion count."""
    _, player = read_save(filename)
    if 38 not in player:
        return False
    for entry in player[38]:
        sub = read_protobuf(entry[1])
        path = ""
        if 1 in sub:
            raw = sub[1][0][1]
            path = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
        if path == challenge_path:
            sub[2] = [[0, max(0, int(progress))]]
            sub[3] = [[0, max(0, int(completed))]]
            entry[1] = write_protobuf(sub)
            write_save(filename, player)
            return True
    return False


def complete_all_challenges(filename: str) -> int:
    """Mark all challenges as completed with high progress. Returns count changed.
    BUG-32: sets progress=99999 instead of 1 so in-game display is realistic."""
    _, player = read_save(filename)
    if 38 not in player:
        return 0
    count = 0
    for entry in player[38]:
        sub = read_protobuf(entry[1])
        old_completed = sub[3][0][1] if 3 in sub else 0
        if old_completed < 1:
            sub[2] = [[0, 99999]]
            sub[3] = [[0, 1]]
            entry[1] = write_protobuf(sub)
            count += 1
    if count > 0:
        write_save(filename, player)
    return count


def reset_all_challenges(filename: str) -> int:
    """Reset all challenges to 0 progress. Returns count changed."""
    _, player = read_save(filename)
    if 38 not in player:
        return 0
    count = 0
    for entry in player[38]:
        sub = read_protobuf(entry[1])
        progress = sub[2][0][1] if 2 in sub else 0
        completed = sub[3][0][1] if 3 in sub else 0
        if progress > 0 or completed > 0:
            sub[2] = [[0, 0]]
            sub[3] = [[0, 0]]
            entry[1] = write_protobuf(sub)
            count += 1
    if count > 0:
        write_save(filename, player)
    return count


def set_skills(filename: str, skill_updates: dict[str, int]) -> int:
    """Set skill levels. skill_updates is {skill_path: level}."""
    _, player = read_save(filename)
    if 8 not in player:
        return 0
    count = 0
    for entry in player[8]:
        sub = read_protobuf(entry[1])
        name = sub[1][0][1] if 1 in sub else b""
        if isinstance(name, bytes):
            name = name.decode("latin1", errors="replace")
        if name in skill_updates:
            new_level = max(0, int(skill_updates[name]))
            sub[2] = [[0, new_level]]
            entry[1] = write_protobuf(sub)
            count += 1
    if count > 0:
        write_save(filename, player)
    return count


def extract_inventory(player: dict[int, Any]) -> dict[str, list[dict[str, Any]]]:
    """Extract all items from inventory, bank, and weapons."""
    result = {"weapons": [], "items": [], "bank": []}

    for field_num, category in [(54, "weapons"), (53, "items"), (41, "bank")]:
        if field_num not in player:
            continue
        for idx, entry in enumerate(player[field_num]):
            sub = read_protobuf(entry[1])
            if 1 not in sub:
                continue
            raw_item = sub[1][0][1]
            is_weapon, item_values, key = unwrap_item(raw_item)

            if is_fake_item(is_weapon, item_values):
                continue

            info = unwrap_item_info(raw_item)
            item_data = {
                "index": idx,
                "field": field_num,
                "info": info,
            }

            if field_num == 54:  # weapons
                item_data["slot"] = sub[2][0][1] if 2 in sub else 0
                item_data["star"] = sub[3][0][1] if 3 in sub else 0
            elif field_num == 53:  # items
                item_data["is_equipped"] = sub[3][0][1] if 3 in sub else 0
                item_data["star"] = sub[4][0][1] if 4 in sub else 0

            result[category].append(item_data)

    return result


def update_character(filename: str, changes: dict[str, Any]) -> dict[str, Any]:
    """Update character properties. Returns new character info."""
    _, player = read_save(filename)

    if "level" in changes:
        new_level = int(changes["level"])
        # Bug 13: was hardcoded to 80, now uses XP table length
        if 1 <= new_level <= len(REQUIRED_XP):
            player[2] = [[0, new_level]]
            player[3] = [[0, REQUIRED_XP[new_level - 1]]]

    if "skill_points" in changes:
        player[4] = [[0, max(0, int(changes["skill_points"]))]]

    if any(k in changes for k in ("money", "eridium", "seraph", "torgue", "golden_keys")) and 6 in player:
        raw = player[6][0][1]
        if isinstance(raw, list):
            values = raw
        else:
            values = read_repeated_protobuf_value(raw, 0)
        while len(values) < 5:
            values.append(0)
        # Bug 14: all currency values must be non-negative (negative breaks varint encoding)
        if "money" in changes:
            values[0] = max(0, int(changes["money"]))
        if "eridium" in changes:
            values[1] = max(0, int(changes["eridium"]))
        if "seraph" in changes:
            values[2] = max(0, int(changes["seraph"]))
        if "golden_keys" in changes:
            values[3] = max(0, int(changes["golden_keys"]))
        if "torgue" in changes:
            values[4] = max(0, int(changes["torgue"]))
        player[6][0] = [0, values]

    if "name" in changes and 19 in player:
        appearance = read_protobuf(player[19][0][1])
        appearance[1] = [[2, changes["name"].encode("utf-8")]]
        player[19][0][1] = write_protobuf(appearance)

    if "inventory_size" in changes and 13 in player and 36 in player:
        size = int(changes["inventory_size"])
        size = max(12, min(39, size))
        sdu_size = int(math.ceil((size - 12) / 3.0))
        actual = 12 + sdu_size * 3
        slots = read_protobuf(player[13][0][1])
        slots[1][0][1] = actual
        player[13][0][1] = write_protobuf(slots)
        s = read_repeated_protobuf_value(player[36][0][1], 0)
        player[36][0][1] = write_repeated_protobuf_value(s[:7] + [sdu_size] + s[8:], 0)

    if "bank_size" in changes and 36 in player:
        size = int(changes["bank_size"])
        size = max(6, min(24, size))
        sdu_size = int(min(255, math.ceil((size - 6) / 2.0)))
        actual = 6 + sdu_size * 2
        if 56 in player:
            player[56][0][1] = actual
        else:
            player[56] = [[0, actual]]
        s = read_repeated_protobuf_value(player[36][0][1], 0)
        if len(s) < 9:
            s = s + (9 - len(s)) * [0]
        player[36][0][1] = write_repeated_protobuf_value(s[:8] + [sdu_size] + s[9:], 0)

    if "weapon_slots" in changes and 13 in player:
        n = int(changes["weapon_slots"])
        n = max(2, min(4, n))
        slots = read_protobuf(player[13][0][1])
        slots[2][0][1] = n
        if slots[3][0][1] > n - 2:
            slots[3][0][1] = n - 2
        player[13][0][1] = write_protobuf(slots)

    # Head/skin customization (field 35)
    # Bug 26: extend field 35 if truncated, instead of silently discarding changes
    if "head_asset" in changes and changes["head_asset"]:
        if 35 not in player:
            player[35] = []
        while len(player[35]) < 1:
            player[35].append([2, b""])
        player[35][0] = [2, changes["head_asset"].encode("latin-1")]

    if "skin_asset" in changes and changes["skin_asset"]:
        if 35 not in player:
            player[35] = []
        while len(player[35]) < 5:
            player[35].append([2, b""])
        player[35][4] = [2, changes["skin_asset"].encode("latin-1")]

    # Appearance colors (field 19, subfields 2/3/4)
    if "appearance_colors" in changes and len(changes["appearance_colors"]) >= 3 and 19 in player:
        appearance = read_protobuf(player[19][0][1])
        for i, color_field in enumerate((2, 3, 4)):
            c = changes["appearance_colors"][i]
            color_bytes = write_protobuf({
                1: [[0, max(0, min(255, int(c.get("a", 255))))]],
                2: [[0, max(0, min(255, int(c.get("r", 127))))]],
                3: [[0, max(0, min(255, int(c.get("g", 127))))]],
                4: [[0, max(0, min(255, int(c.get("b", 127))))]],
            })
            appearance[color_field] = [[2, color_bytes]]
        player[19][0][1] = write_protobuf(appearance)

    # OP level (field 53 fake item with id_byte=4)
    # BUG-28: create the fake item if it doesn't exist
    if "op_level" in changes:
        op = max(0, min(10, int(changes["op_level"])))
        found_op = False
        if 53 in player:
            for entry in player[53]:
                sub = read_protobuf(entry[1])
                if 1 not in sub or 2 not in sub:
                    continue
                is_w, vals, _ = unwrap_item(sub[1][0][1])
                if not is_fake_item(is_w, vals):
                    continue
                raw_val = sub[2][0][1]
                idnum = (-raw_val) & 0xFF
                if idnum == 4:
                    new_raw = -((op << 8) | 4) & 0xFFFFFFFFFFFFFFFF
                    sub[2] = [[0, new_raw]]
                    entry[1] = write_protobuf(sub)
                    found_op = True
                    break
        if not found_op and op > 0:
            # Create a fake item (set=255, all zeros) with OP level data
            fake_vals = [255] + [0] * (len(ITEM_SIZES[0]) - 1)
            fake_key = random.randrange(0x100000000) - 0x80000000
            fake_raw = wrap_item(0, fake_vals, fake_key)
            op_raw = -((op << 8) | 4) & 0xFFFFFFFFFFFFFFFF
            fake_entry = write_protobuf({
                1: [[2, fake_raw]],
                2: [[0, op_raw]],
            })
            player.setdefault(53, []).append([2, fake_entry])

    # BUG-29: handle ammo in same write cycle to avoid double write_save
    if "ammo" in changes and isinstance(changes["ammo"], dict) and 11 in player:
        for entry in player[11]:
            sub = read_protobuf(entry[1])
            res_name = ""
            if 1 in sub:
                raw = sub[1][0][1]
                res_name = raw.decode("latin1") if isinstance(raw, bytes) else str(raw)
            short = res_name.rsplit(".", 1)[-1] if res_name else ""
            if short in changes["ammo"]:
                qty = max(0, int(changes["ammo"][short]))
                packed = struct.unpack("<I", struct.pack("<f", float(qty)))[0]
                sub[3] = [[5, packed]]
                entry[1] = write_protobuf(sub)

    write_save(filename, player)
    return extract_character_info(player)


def delete_item(filename: str, field: int, index: int) -> bool:
    """Remove an item from inventory/weapons/bank."""
    _, player = read_save(filename)
    if field in player and 0 <= index < len(player[field]):
        player[field].pop(index)
        write_save(filename, player)
        return True
    return False


def transfer_item(filename: str, from_field: int, index: int, to_field: int) -> bool:
    """Move an item from one inventory section to another (e.g. backpack to bank)."""
    _, player = read_save(filename)
    if from_field not in player or index < 0 or index >= len(player[from_field]):
        return False
    if from_field == to_field:
        return False
    # Validate source isn't a fake item
    entry = player[from_field][index]
    sub = read_protobuf(entry[1])
    if 1 in sub:
        is_w, vals, _ = unwrap_item(sub[1][0][1])
        if is_fake_item(is_w, vals):
            return False
    item = player[from_field].pop(index)
    player.setdefault(to_field, []).append(item)
    write_save(filename, player)
    return True


def reorder_item(filename: str, field: int, from_index: int, to_index: int) -> bool:
    """Move an item from one position to another within the same field."""
    _, player = read_save(filename)
    if field not in player:
        return False
    items = player[field]
    if from_index < 0 or from_index >= len(items) or to_index < 0 or to_index >= len(items):
        return False
    if from_index == to_index:
        return True
    item = items.pop(from_index)
    items.insert(to_index, item)
    write_save(filename, player)
    return True


def set_item_level(filename: str, field: int, index: int, new_level: int) -> bool:
    """Change an item's level."""
    _, player = read_save(filename)
    # Bug 25: also reject negative indices (Python silently wraps them)
    if field not in player or index < 0 or index >= len(player[field]):
        return False
    entry = player[field][index]
    sub = read_protobuf(entry[1])
    raw_item = sub[1][0][1]
    is_weapon, item_values, key = unwrap_item(raw_item)
    # BUG-P54: skip fake items (OP level markers) to prevent data corruption
    if is_fake_item(is_weapon, item_values):
        return False
    new_level = max(0, min(127, new_level))
    # Project Paris Bug 7: grade_index was capped at 80 but patched exe supports higher
    item_values[4] = new_level
    item_values[5] = new_level
    sub[1][0][1] = wrap_item(is_weapon, item_values, key)
    entry[1] = write_protobuf(sub)
    write_save(filename, player)
    return True


def add_weapon(filename: str, values_list: list[dict[str, Any]]) -> int:
    """Add a weapon to inventory from packed values list."""
    _, player = read_save(filename)
    key = random.randrange(0x100000000) - 0x80000000
    raw = wrap_item(1, values_list, key)
    entry = {
        1: [[2, raw]],
        2: [[0, 0]],
        3: [[0, 1]],
    }
    player.setdefault(54, []).append([2, write_protobuf(entry)])
    write_save(filename, player)
    return True


def add_item(filename: str, values_list: list) -> bool:
    """Add a non-weapon item (shield, grenade, etc.) to inventory from packed values."""
    _, player = read_save(filename)
    key = random.randrange(0x100000000) - 0x80000000
    raw = wrap_item(0, values_list, key)
    # BUG-P47: field 3 is is_equipped for items (not star like weapons) — must be 0
    entry = {
        1: [[2, raw]],
        2: [[0, 1]],
        3: [[0, 0]],
        4: [[0, 1]],
    }
    player.setdefault(53, []).append([2, write_protobuf(entry)])
    write_save(filename, player, warn_only_validation=True)
    return True


def preview_gibbed_codes(codes_text: str) -> list[dict[str, Any]]:
    """Decode Gibbed codes and return item info without importing. For preview UI."""
    results = []
    for line_num, line in enumerate(codes_text.strip().splitlines(), 1):
        line = line.strip()
        if not line or not line.startswith("BL2("):
            continue
        code_bytes, err = validate_gibbed_code(line)
        if err:
            results.append({"line": line_num, "error": err})
            continue
        info = unwrap_item_info(code_bytes)
        is_weapon = (code_bytes[0] & 0x80) != 0
        results.append({
            "line": line_num,
            "info": info,
            "is_weapon": is_weapon,
            "code": line,
        })
    return results


def validate_gibbed_code(code_str: str) -> tuple[Optional[bytes], Optional[str]]:
    """Validate a single BL2(...) Gibbed code. Returns (code_bytes, error_msg)."""
    code_str = code_str.strip()
    if not (code_str.startswith("BL2(") and code_str.endswith(")")):
        return None, "Not a valid BL2(...) code"
    b64 = code_str[4:-1]
    try:
        code_bytes = base64.b64decode(b64)
    except Exception:
        return None, "Invalid base64 encoding"
    if len(code_bytes) < 5:
        return None, f"Code too short ({len(code_bytes)} bytes, minimum 5)"
    # Try to unpack — if it fails, the item data is corrupt
    try:
        is_weapon, item_values, key = unwrap_item(code_bytes)
    except Exception as e:
        return None, f"Failed to decode item data: {e}"
    # Check for obviously empty items
    if all(v is None or v == 0 for v in item_values[1:4]):
        return None, "Item has no type, balance, or manufacturer"
    return code_bytes, None


def import_gibbed_codes(filename: str, codes_text: str) -> dict[str, Any]:
    """Import BL2(...) Gibbed codes into the save. Validates each code first."""
    _, player = read_save(filename)
    count = 0
    errors = []
    for line_num, line in enumerate(codes_text.strip().splitlines(), 1):
        line = line.strip()
        if not line or not line.startswith("BL2("):
            continue
        code_bytes, err = validate_gibbed_code(line)
        if err:
            errors.append(f"Line {line_num}: {err}")
            continue
        key = random.randrange(0x100000000) - 0x80000000
        code_bytes = replace_raw_item_key(code_bytes, key)
        if (code_bytes[0] & 0x80) == 0:
            entry = {1: [[2, code_bytes]], 2: [[0, 1]], 3: [[0, 0]], 4: [[0, 1]]}
            player.setdefault(53, []).append([2, write_protobuf(entry)])
        else:
            entry = {1: [[2, code_bytes]], 2: [[0, 0]], 3: [[0, 1]]}
            player.setdefault(54, []).append([2, write_protobuf(entry)])
        count += 1
    if count > 0:
        write_save(filename, player)
    return {"imported": count, "errors": errors}


def duplicate_item(filename: str, field: int, index: int) -> bool:
    """Duplicate an item within the same inventory section."""
    _, player = read_save(filename)
    # Bug 25: also reject negative indices
    if field not in player or index < 0 or index >= len(player[field]):
        return False
    import copy
    original = player[field][index]
    clone = copy.deepcopy(original)
    # Give the clone a new random key
    sub = read_protobuf(clone[1])
    if 1 in sub:
        raw = sub[1][0][1]
        is_weapon, item_values, _ = unwrap_item(raw)
        new_key = random.randrange(0x100000000) - 0x80000000
        sub[1][0][1] = wrap_item(is_weapon, item_values, new_key)
        clone[1] = write_protobuf(sub)
    player[field].append(clone)
    write_save(filename, player)
    return True


def bulk_set_level(filename: str, field: int, new_level: int) -> int:
    """Set all items in a field (54=weapons, 53=items, 41=bank) to the given level."""
    _, player = read_save(filename)
    if field not in player:
        return 0
    new_level = max(0, min(127, new_level))
    count = 0
    for entry in player[field]:
        sub = read_protobuf(entry[1])
        if 1 not in sub:
            continue
        raw_item = sub[1][0][1]
        is_weapon, item_values, key = unwrap_item(raw_item)
        if is_fake_item(is_weapon, item_values):
            continue
        item_values[4] = new_level
        item_values[5] = new_level
        sub[1][0][1] = wrap_item(is_weapon, item_values, key)
        entry[1] = write_protobuf(sub)
        count += 1
    if count > 0:
        write_save(filename, player)
    return count


def export_gibbed_code(filename: str, field: int, index: int) -> Optional[str]:
    """Export a single item as a Gibbed code."""
    _, player = read_save(filename)
    # Bug 25: also reject negative indices
    if field not in player or index < 0 or index >= len(player[field]):
        return None
    entry = player[field][index]
    sub = read_protobuf(entry[1])
    raw = sub[1][0][1]
    is_weapon, item_values, key = unwrap_item(raw)
    if is_fake_item(is_weapon, item_values):
        return None
    zeroed = replace_raw_item_key(raw, 0)
    return "BL2(" + base64.b64encode(zeroed).decode("latin1") + ")"


def export_all_codes(filename: str) -> dict[str, list[str]]:
    """Export all items as Gibbed codes."""
    _, player = read_save(filename)
    sections = {"weapons": [], "items": [], "bank": []}
    for field_num, category in [(54, "weapons"), (53, "items"), (41, "bank")]:
        if field_num not in player:
            continue
        for entry in player[field_num]:
            sub = read_protobuf(entry[1])
            if 1 not in sub:
                continue
            raw = sub[1][0][1]
            is_weapon, item_values, key = unwrap_item(raw)
            if is_fake_item(is_weapon, item_values):
                continue
            zeroed = replace_raw_item_key(raw, 0)
            code = "BL2(" + base64.b64encode(zeroed).decode("latin1") + ")"
            sections[category].append(code)
    return sections


# ─── Loadout Save / Restore ─────────────────────────────────

LOADOUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loadouts")


def _ensure_loadout_dir() -> None:
    os.makedirs(LOADOUT_DIR, exist_ok=True)


def save_loadout(filename: str, name: str) -> dict[str, Any]:
    """Save current weapons + items (backpack) as a named loadout snapshot."""
    _ensure_loadout_dir()
    codes = export_all_codes(filename)
    _, player = read_save(filename)
    char_info = extract_character_info(player)

    loadout = {
        "name": name,
        "character": char_info.get("class_name", "Unknown"),
        "level": char_info.get("level", 0),
        "save_file": filename,
        "weapons": codes.get("weapons", []),
        "items": codes.get("items", []),
    }

    safe_name = re.sub(r'[^\w\s\-]', '', name).strip().replace(" ", "_")
    if not safe_name:
        safe_name = "loadout"
    path = os.path.join(LOADOUT_DIR, safe_name + ".json")
    # Avoid overwriting — append number if exists
    counter = 1
    while os.path.exists(path):
        path = os.path.join(LOADOUT_DIR, safe_name + "_" + str(counter) + ".json")
        counter += 1

    with open(path, "w") as f:
        _json.dump(loadout, f, indent=2)
    return {"file": os.path.basename(path), "name": name,
            "weapons": len(loadout["weapons"]), "items": len(loadout["items"])}


def list_loadouts() -> list[dict[str, Any]]:
    """List all saved loadouts."""
    _ensure_loadout_dir()
    results = []
    for fname in sorted(os.listdir(LOADOUT_DIR)):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(LOADOUT_DIR, fname)) as f:
                data = _json.load(f)
            results.append({
                "file": fname,
                "name": data.get("name", fname),
                "character": data.get("character", "?"),
                "level": data.get("level", 0),
                "weapons": len(data.get("weapons", [])),
                "items": len(data.get("items", [])),
            })
        except Exception:
            continue
    return results


def load_loadout(filename: str, loadout_file: str, replace: bool = False) -> dict[str, Any]:
    """Restore a loadout into the save file. If replace=True, clears existing weapons+items first.
    Project Paris Bug 8: combined clear+import into single read-write cycle."""
    _ensure_loadout_dir()
    path = os.path.join(LOADOUT_DIR, loadout_file)
    if not os.path.exists(path):
        raise FileNotFoundError("Loadout not found: " + loadout_file)
    with open(path) as f:
        loadout = _json.load(f)

    all_codes = loadout.get("weapons", []) + loadout.get("items", [])
    if not all_codes:
        return {"imported": 0}

    _, player = read_save(filename)

    if replace:
        for field_num in [54, 53]:
            if field_num in player:
                kept = []
                for entry in player[field_num]:
                    sub = read_protobuf(entry[1])
                    if 1 not in sub:
                        kept.append(entry)
                        continue
                    raw = sub[1][0][1]
                    is_w, vals, _ = unwrap_item(raw)
                    if is_fake_item(is_w, vals):
                        kept.append(entry)
                player[field_num] = kept

    # Import codes into the same player dict (single write)
    count = 0
    errors = []
    for line_num, line in enumerate(("\n".join(all_codes)).strip().splitlines(), 1):
        line = line.strip()
        if not line or not line.startswith("BL2("):
            continue
        code_bytes, err = validate_gibbed_code(line)
        if err:
            errors.append(f"Line {line_num}: {err}")
            continue
        key = random.randrange(0x100000000) - 0x80000000
        code_bytes = replace_raw_item_key(code_bytes, key)
        if (code_bytes[0] & 0x80) == 0:
            entry = {1: [[2, code_bytes]], 2: [[0, 1]], 3: [[0, 0]], 4: [[0, 1]]}
            player.setdefault(53, []).append([2, write_protobuf(entry)])
        else:
            entry = {1: [[2, code_bytes]], 2: [[0, 0]], 3: [[0, 1]]}
            player.setdefault(54, []).append([2, write_protobuf(entry)])
        count += 1

    if count > 0 or replace:
        write_save(filename, player)
    return {"imported": count, "name": loadout.get("name", loadout_file)}


def delete_loadout(loadout_file: str) -> bool:
    """Delete a saved loadout."""
    _ensure_loadout_dir()
    safe = os.path.basename(loadout_file)
    path = os.path.join(LOADOUT_DIR, safe)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False
