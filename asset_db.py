"""
Asset database for resolving packed BL2 item indices to human-readable names.
Loads Gibbed JSON data and builds forward/reverse lookup tables.
"""
from __future__ import annotations

import os
import json
import re
from typing import Any, Optional

from config import get_config
GIBBED_DIR = get_config()["gibbed_dir"]

CONFIGS = {
    "WeaponTypes": {"sublibrary_bits": 7, "asset_bits": 6},
    "WeaponParts": {"sublibrary_bits": 6, "asset_bits": 11},
    "ItemTypes": {"sublibrary_bits": 9, "asset_bits": 8},
    "ItemParts": {"sublibrary_bits": 6, "asset_bits": 10},
    "Manufacturers": {"sublibrary_bits": 4, "asset_bits": 7},
    "BalanceDefs": {"sublibrary_bits": 10, "asset_bits": 10},
}

FIELD_GROUPS = {
    "type": {"weapon": "WeaponTypes", "item": "ItemTypes"},
    "balance": {"weapon": "BalanceDefs", "item": "BalanceDefs"},
    "manufacturer": {"weapon": "Manufacturers", "item": "Manufacturers"},
}

PART_GROUP = {"weapon": "WeaponParts", "item": "ItemParts"}

PART_SLOT_NAMES = [
    "Body", "Grip", "Barrel", "Sight", "Stock",
    "Element", "Accessory1", "Accessory2",
    "Material", "Prefix", "Title",
]

# Rarity detection from balance path keywords
RARITY_MAP = {
    "1_Common": {"name": "Common", "color": "#9d9d9d", "rank": 0},
    "2_Uncommon": {"name": "Uncommon", "color": "#3bbd40", "rank": 1},
    "3_Rare": {"name": "Rare", "color": "#4b8be8", "rank": 2},
    "4_VeryRare": {"name": "Very Rare", "color": "#9b59b6", "rank": 3},
    "5_Legendary": {"name": "Legendary", "color": "#e8a33a", "rank": 4},
    "_Legendary": {"name": "Legendary", "color": "#e8a33a", "rank": 4},
    "6_Pearlescent": {"name": "Pearlescent", "color": "#00e5ff", "rank": 5},
    "_Seraph": {"name": "Seraph", "color": "#ff4081", "rank": 6},
    "_Unique": {"name": "Unique", "color": "#9b59b6", "rank": 3},
    "_Effervescent": {"name": "Effervescent", "color": "#ff6ed4", "rank": 7},
}

# Clean manufacturer names
MANUFACTURER_NAMES = {
    "Bandit": "Bandit", "Dahl": "Dahl", "Hyperion": "Hyperion",
    "Jakobs": "Jakobs", "Maliwan": "Maliwan", "Tediore": "Tediore",
    "Torgue": "Torgue", "Vladof": "Vladof",
}

# Weapon type display
WEAPON_TYPE_DISPLAY = {
    "Pistol": "Pistol", "AssaultRifle": "Assault Rifle",
    "SMG": "SMG", "Shotgun": "Shotgun",
    "SniperRifle": "Sniper Rifle", "RocketLauncher": "Rocket Launcher",
    "Launcher": "Rocket Launcher",
}

# Item type display
ITEM_TYPE_CATEGORIES = {
    "Shield": "Shield", "GrenadeMod": "Grenade Mod",
    "ClassMod": "Class Mod", "Artifact": "Relic",
    "MissionItem": "Mission Item",
}

# Element names from part paths
ELEMENT_NAMES = {
    "Incendiary": "Fire", "Fire": "Fire",
    "Shock": "Shock", "Corrosive": "Corrosive",
    "Slag": "Slag", "Explosive": "Explosive",
    "None": "None",
}

# ─── Stat Estimation Data ────────────────────────────────────

WEAPON_BASE_STATS = {
    "Pistol":          {"damage": 18, "fire_rate": 8.5, "reload_speed": 2.5, "mag_size": 14, "accuracy": 90.0, "recoil": 15.0},
    "Assault Rifle":   {"damage": 22, "fire_rate": 8.0, "reload_speed": 3.8, "mag_size": 28, "accuracy": 85.0, "recoil": 18.0},
    "SMG":             {"damage": 16, "fire_rate": 10.0, "reload_speed": 2.8, "mag_size": 30, "accuracy": 82.0, "recoil": 20.0},
    "Shotgun":         {"damage": 80, "fire_rate": 2.0, "reload_speed": 4.0, "mag_size": 8,  "accuracy": 55.0, "recoil": 40.0},
    "Sniper Rifle":    {"damage": 120, "fire_rate": 1.5, "reload_speed": 4.5, "mag_size": 6,  "accuracy": 96.0, "recoil": 8.0},
    "Rocket Launcher": {"damage": 300, "fire_rate": 1.0, "reload_speed": 5.0, "mag_size": 4,  "accuracy": 80.0, "recoil": 50.0},
}

MANUFACTURER_STAT_MODS = {
    "Bandit":   {"mag_size": 1.5,  "accuracy": 0.85, "reload_speed": 1.3,  "damage": 0.95, "recoil": 1.1},
    "Dahl":     {"accuracy": 1.15, "recoil": 0.7,    "damage": 0.95,       "fire_rate": 1.05},
    "Hyperion": {"accuracy": 1.1,  "damage": 1.05,   "recoil": 0.85,       "fire_rate": 0.9},
    "Jakobs":   {"damage": 1.2,    "fire_rate": 0.6,  "mag_size": 0.7,     "accuracy": 1.05, "reload_speed": 1.1},
    "Maliwan":  {"damage": 0.85,   "fire_rate": 0.95, "accuracy": 1.05,    "reload_speed": 1.05},
    "Tediore":  {"reload_speed": 0.6, "damage": 0.9,  "mag_size": 0.9},
    "Torgue":   {"damage": 1.3,    "fire_rate": 0.7,  "accuracy": 0.8,     "recoil": 1.3, "reload_speed": 1.1},
    "Vladof":   {"fire_rate": 1.3,  "damage": 0.85,   "recoil": 0.85,      "mag_size": 1.2},
}

PART_STAT_MODS = {
    "Barrel": {
        "Bandit": {"mag_size": 1.2, "accuracy": 0.9},
        "Dahl": {"recoil": 0.8, "accuracy": 1.05},
        "Hyperion": {"accuracy": 1.1, "fire_rate": 0.85},
        "Jakobs": {"damage": 1.15, "fire_rate": 0.9},
        "Maliwan": {"damage": 0.95, "accuracy": 1.05},
        "Tediore": {"reload_speed": 0.9},
        "Torgue": {"damage": 1.2, "fire_rate": 0.8, "accuracy": 0.85},
        "Vladof": {"fire_rate": 1.15, "damage": 0.95},
    },
    "Grip": {
        "Bandit": {"mag_size": 1.3, "reload_speed": 1.15},
        "Dahl": {"recoil": 0.85, "damage": 0.95},
        "Hyperion": {"accuracy": 1.1, "damage": 0.95},
        "Jakobs": {"damage": 1.1, "reload_speed": 0.9, "fire_rate": 0.95},
        "Maliwan": {"damage": 0.95},
        "Tediore": {"reload_speed": 0.8},
        "Torgue": {"damage": 1.1, "fire_rate": 0.9},
        "Vladof": {"fire_rate": 1.1, "damage": 0.95},
    },
    "Stock": {
        "Dahl": {"recoil": 0.8, "accuracy": 0.95},
        "Hyperion": {"accuracy": 1.1, "recoil": 0.9},
        "Jakobs": {"accuracy": 1.05, "recoil": 1.1},
        "Torgue": {"recoil": 1.1, "damage": 1.02},
        "Vladof": {"recoil": 0.9, "fire_rate": 1.02},
    },
    "Body": {
        "Bandit": {"damage": 0.95, "mag_size": 1.15},
        "Dahl": {"damage": 1.0, "accuracy": 1.05},
        "Hyperion": {"accuracy": 1.1, "damage": 1.0},
        "Jakobs": {"damage": 1.1},
        "Torgue": {"damage": 1.1, "fire_rate": 0.95},
        "Vladof": {"fire_rate": 1.05},
    },
    "Sight": {
        "Dahl": {"accuracy": 1.02},
        "Hyperion": {"accuracy": 1.05},
        "Jakobs": {"accuracy": 1.03},
        "Vladof": {"accuracy": 1.01},
    },
}

# Part effect hints for display
PART_EFFECTS = {
    "Barrel": {
        "Bandit": "+Mag Size, -Accuracy",
        "Dahl": "+Burst Count, +Stability",
        "Hyperion": "+Accuracy",
        "Jakobs": "+Damage, -Fire Rate",
        "Maliwan": "+Elemental Chance",
        "Tediore": "+Reload Speed",
        "Torgue": "+Damage, -Fire Rate",
        "Vladof": "+Fire Rate",
    },
    "Grip": {
        "Bandit": "+Mag Size, -Reload",
        "Dahl": "+Stability, -Damage",
        "Hyperion": "+Accuracy, -Damage",
        "Jakobs": "+Damage, +Reload, -Fire Rate",
        "Maliwan": "+Elemental, -Damage",
        "Tediore": "+Reload Speed",
        "Torgue": "+Damage, -Fire Rate",
        "Vladof": "+Fire Rate, -Damage",
    },
}


class AssetDB:
    def __init__(self) -> None:
        self._forward: dict[str, list[str]] = {}
        self._reverse: dict[str, dict[str, tuple[int, int]]] = {}
        self._weapon_types: dict[str, Any] = {}
        self._weapon_parts: dict[str, Any] = {}
        self._weapon_balance: dict[str, Any] = {}
        self._weapon_balance_parts: dict[str, Any] = {}
        self._weapon_name_parts: dict[str, Any] = {}
        self._weapon_part_lists: dict[str, list[str]] = {}
        self._item_types: dict[str, Any] = {}
        self._item_parts: dict[str, Any] = {}
        self._item_balance: dict[str, Any] = {}
        self._balance_categories: dict[str, str] = {}
        self._item_parts_by_type: dict[str, list[tuple[str, dict]]] = {}
        self._load()

    def _load_json(self, filename: str) -> dict[str, Any]:
        path = os.path.join(GIBBED_DIR, filename)
        if not os.path.exists(path):
            return {}
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def _cache_path(self) -> str:
        return os.path.join(GIBBED_DIR, ".asset_cache.sqlite")

    def _cache_is_fresh(self) -> bool:
        """Check if SQLite cache exists and is newer than all JSON sources."""
        cache = self._cache_path()
        if not os.path.exists(cache):
            return False
        cache_mtime = os.path.getmtime(cache)
        for f in os.listdir(GIBBED_DIR):
            if f.endswith(".json"):
                if os.path.getmtime(os.path.join(GIBBED_DIR, f)) > cache_mtime:
                    return False
        return True

    def _save_cache(self) -> None:
        """Serialize lookup tables to SQLite for faster subsequent loads."""
        import sqlite3, pickle
        cache = self._cache_path()
        conn = sqlite3.connect(cache)
        conn.execute("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data BLOB)")
        conn.execute("DELETE FROM cache")
        tables = {
            "forward": self._forward,
            "reverse": self._reverse,
            "weapon_types": self._weapon_types,
            "weapon_parts": self._weapon_parts,
            "weapon_balance": self._weapon_balance,
            "weapon_balance_parts": self._weapon_balance_parts,
            "weapon_name_parts": self._weapon_name_parts,
            "weapon_part_lists": self._weapon_part_lists,
            "item_types": self._item_types,
            "item_parts": self._item_parts,
            "item_balance": self._item_balance,
            "balance_categories": self._balance_categories,
        }
        for key, data in tables.items():
            conn.execute("INSERT INTO cache VALUES (?, ?)", (key, pickle.dumps(data)))
        conn.commit()
        conn.close()

    def _load_cache(self) -> bool:
        """Load lookup tables from SQLite cache. Returns True on success."""
        import sqlite3, pickle
        try:
            conn = sqlite3.connect(self._cache_path())
            rows = dict(conn.execute("SELECT key, data FROM cache").fetchall())
            conn.close()
            self._forward = pickle.loads(rows["forward"])
            self._reverse = pickle.loads(rows["reverse"])
            self._weapon_types = pickle.loads(rows["weapon_types"])
            self._weapon_parts = pickle.loads(rows["weapon_parts"])
            self._weapon_balance = pickle.loads(rows["weapon_balance"])
            self._weapon_balance_parts = pickle.loads(rows["weapon_balance_parts"])
            self._weapon_name_parts = pickle.loads(rows["weapon_name_parts"])
            self._weapon_part_lists = pickle.loads(rows["weapon_part_lists"])
            self._item_types = pickle.loads(rows["item_types"])
            self._item_parts = pickle.loads(rows["item_parts"])
            self._item_balance = pickle.loads(rows["item_balance"])
            self._balance_categories = pickle.loads(rows["balance_categories"])
            self._build_item_parts_index()
            return True
        except Exception:
            return False

    def _load(self) -> None:
        # Try SQLite cache first
        if self._cache_is_fresh() and self._load_cache():
            return

        alm = self._load_json("Asset Library Manager.json")
        configs = alm.get("configs", {})
        for group, cfg in configs.items():
            if group in CONFIGS:
                CONFIGS[group]["sublibrary_bits"] = cfg.get("sublibrary_bits", CONFIGS[group]["sublibrary_bits"])
                CONFIGS[group]["asset_bits"] = cfg.get("asset_bits", CONFIGS[group]["asset_bits"])

        for set_idx, s in enumerate(alm.get("sets", [])):
            for group_name, lib_data in s.get("libraries", {}).items():
                for sublib_idx, sublib in enumerate(lib_data.get("sublibraries", [])):
                    package = sublib.get("package")
                    assets = sublib.get("assets", [])
                    if not package or not assets:
                        continue
                    for asset_idx, asset_name in enumerate(assets):
                        full_path = f"{package}.{asset_name}"
                        self._forward[(set_idx, group_name, sublib_idx, asset_idx)] = full_path
                        self._reverse[(full_path, group_name)] = (set_idx, sublib_idx, asset_idx)

        self._weapon_types = self._load_json("Weapon Types.json")
        self._weapon_parts = self._load_json("Weapon Parts.json")
        self._weapon_balance = self._load_json("Weapon Balance.json")
        self._weapon_balance_parts = self._load_json("Weapon Balance Part Lists.json")
        self._weapon_name_parts = self._load_json("Weapon Name Parts.json")
        self._weapon_part_lists = self._load_json("Weapon Part Lists.json")
        self._item_types = self._load_json("Items.json")
        self._item_parts = self._load_json("Item Parts.json")
        self._item_balance = self._load_json("Item Balance.json")
        self._build_balance_categories()
        self._build_item_parts_index()

        # Save cache for next startup
        try:
            self._save_cache()
        except Exception:
            pass  # cache write failure is non-fatal

    def _build_item_parts_index(self) -> None:
        """Pre-index item parts by type for O(1) lookup."""
        self._item_parts_by_type = {}
        for path, data in self._item_parts.items():
            ptype = (data.get("type", "") or "").lower()
            if ptype:
                self._item_parts_by_type.setdefault(ptype, []).append((path, data))

    def _build_balance_categories(self) -> None:
        for bal_path, bal_data in self._weapon_balance.items():
            wtype = self._resolve_balance_weapon_type(bal_path)
            if wtype:
                self._balance_categories.setdefault(wtype, []).append(bal_path)

    def _resolve_balance_weapon_type(self, balance_path: str) -> Optional[str]:
        visited = set()
        path = balance_path
        while path and path not in visited:
            visited.add(path)
            data = self._weapon_balance.get(path, {})
            if "weapon_type" in data:
                return data["weapon_type"]
            path = data.get("base")
        return None

    def resolve_path(self, set_id: int, group: str, lib: int, asset: int) -> Optional[str]:
        cfg = CONFIGS.get(group)
        if not cfg:
            return None
        sub_bits = cfg["sublibrary_bits"]
        asset_bits = cfg["asset_bits"]
        use_set_mask = 1 << (sub_bits - 1)
        use_set_id = (lib & use_set_mask) != 0
        actual_sublib = lib & (use_set_mask - 1)
        actual_set = set_id if use_set_id else 0
        max_val = (1 << (sub_bits + asset_bits)) - 1
        packed = (lib << asset_bits) | asset
        if packed == max_val:
            return None
        return self._forward.get((actual_set, group, actual_sublib, asset))

    def pack_reference(self, full_path: str, group: str, set_id: int = 0) -> Optional[tuple[int, int]]:
        key = (full_path, group)
        if key not in self._reverse:
            return None
        found_set, sublib, asset_idx = self._reverse[key]
        cfg = CONFIGS[group]
        sub_bits = cfg["sublibrary_bits"]
        use_set_mask = 1 << (sub_bits - 1)
        lib = sublib
        if found_set != 0:
            lib |= use_set_mask
        return lib, asset_idx

    def get_set_id_for_path(self, full_path: str, group: str) -> int:
        """Bug 16/17: get the library set index for an asset path."""
        key = (full_path, group)
        if key not in self._reverse:
            return 0
        return self._reverse[key][0]

    def detect_rarity(self, balance_path: str) -> dict[str, str]:
        """Detect item rarity from balance path."""
        if not balance_path:
            return {"name": "Common", "color": "#9d9d9d", "rank": 0}
        # Project Paris Bug 10: secondary sort by rank desc for stable ordering at equal lengths
        for key, rarity in sorted(RARITY_MAP.items(), key=lambda x: (-len(x[0]), -x[1]["rank"])):
            if key in balance_path:
                return rarity
        return {"name": "Common", "color": "#9d9d9d", "rank": 0}

    def detect_weapon_category(self, type_path: str) -> str:
        """Get simplified weapon category from type path."""
        if not type_path:
            return "Unknown"
        for key, display in WEAPON_TYPE_DISPLAY.items():
            if key.lower() in type_path.lower():
                return display
        return "Weapon"

    def detect_item_category(self, type_path: str, balance_path: str) -> str:
        """Get simplified item category."""
        check = (type_path or "") + (balance_path or "")
        for key, display in ITEM_TYPE_CATEGORIES.items():
            if key.lower() in check.lower():
                return display
        return "Item"

    def detect_element(self, parts: list[dict[str, Any]]) -> Optional[dict[str, str]]:
        """Detect element from resolved parts."""
        for p in parts:
            if p["slot"] == "Element" and p["path"]:
                path = p["path"].lower()
                if "incendiary" in path or "fire" in path:
                    return {"name": "Fire", "color": "#ff6600"}
                elif "shock" in path:
                    return {"name": "Shock", "color": "#0099ff"}
                elif "corrosive" in path:
                    return {"name": "Corrosive", "color": "#00dd00"}
                elif "slag" in path:
                    return {"name": "Slag", "color": "#cc00ff"}
                elif "explosive" in path:
                    return {"name": "Explosive", "color": "#ffdd00"}
        return None

    def get_manufacturer_name(self, mfr_path: str) -> str:
        """Get clean manufacturer name."""
        if not mfr_path:
            return "Unknown"
        short = mfr_path.rsplit(".", 1)[-1]
        return MANUFACTURER_NAMES.get(short, short)

    def get_part_effect(self, slot: str, part_path: str) -> str:
        """Get a hint about what a part does."""
        if not part_path or slot not in PART_EFFECTS:
            return ""
        for mfr, effect in PART_EFFECTS[slot].items():
            if mfr.lower() in part_path.lower():
                return effect
        return ""

    def resolve_item_parts(self, item_info: dict[str, Any]) -> dict[str, Any]:
        """Resolve all parts of an item to display names with full metadata."""
        is_weapon = item_info["is_weapon"]
        set_id = item_info["set"]
        kind = "weapon" if is_weapon else "item"
        result = dict(item_info)

        # Resolve type
        type_group = FIELD_GROUPS["type"][kind]
        type_path = self.resolve_path(set_id, type_group, item_info["type"]["lib"], item_info["type"]["asset"])
        result["type_path"] = type_path

        # Resolve balance
        bal_group = FIELD_GROUPS["balance"][kind]
        bal_path = self.resolve_path(set_id, bal_group, item_info["balance"]["lib"], item_info["balance"]["asset"])
        result["balance_path"] = bal_path

        # Resolve manufacturer
        mfr_group = FIELD_GROUPS["manufacturer"][kind]
        mfr_path = self.resolve_path(set_id, mfr_group, item_info["manufacturer"]["lib"], item_info["manufacturer"]["asset"])
        result["manufacturer_path"] = mfr_path
        result["manufacturer_name"] = self.get_manufacturer_name(mfr_path)

        # Rarity
        rarity = self.detect_rarity(bal_path)
        result["rarity"] = rarity

        # Category
        if is_weapon:
            result["category"] = self.detect_weapon_category(type_path)
        else:
            result["category"] = self.detect_item_category(type_path, bal_path)

        # Resolve parts
        part_group = PART_GROUP[kind]
        resolved_parts = []
        for i, p in enumerate(item_info.get("parts", [])):
            slot_name = PART_SLOT_NAMES[i] if i < len(PART_SLOT_NAMES) else f"Part{i}"
            if p is None:
                resolved_parts.append({"slot": slot_name, "path": None, "name": "None", "lib": 0, "asset": 0, "effect": ""})
                continue
            path = self.resolve_path(set_id, part_group, p["lib"], p["asset"])
            if path is None:
                resolved_parts.append({"slot": slot_name, "path": None, "name": "None", "lib": p["lib"], "asset": p["asset"], "effect": ""})
            else:
                clean_name = self._clean_part_name(path, slot_name)
                effect = self.get_part_effect(slot_name, path)
                resolved_parts.append({
                    "slot": slot_name, "path": path,
                    "name": clean_name, "lib": p["lib"], "asset": p["asset"],
                    "effect": effect,
                })
        result["resolved_parts"] = resolved_parts

        # Element
        result["element"] = self.detect_element(resolved_parts)

        # Display name
        result["display_name"] = self._build_display_name(result)

        # Estimated stats (weapons only)
        if is_weapon:
            result["estimated_stats"] = self.estimate_weapon_stats(result)

        return result

    def _clean_part_name(self, path: str, slot: str) -> str:
        """Make part names human-readable."""
        if not path:
            return "None"
        short = path.rsplit(".", 1)[-1]
        # Remove common prefixes
        prefixes = [
            "Pistol_Barrel_", "Pistol_Grip_", "Pistol_Body_", "Pistol_Sight_",
            "AR_Barrel_", "AR_Grip_", "AR_Body_", "AR_Sight_", "AR_Stock_",
            "SG_Barrel_", "SG_Grip_", "SG_Body_", "SG_Sight_", "SG_Stock_",
            "SMG_Barrel_", "SMG_Grip_", "SMG_Body_", "SMG_Sight_", "SMG_Stock_",
            "SR_Barrel_", "SR_Grip_", "SR_Body_", "SR_Sight_", "SR_Stock_",
            "RL_Barrel_", "RL_Grip_", "RL_Body_", "RL_Sight_", "RL_Stock_",
            "Mat_", "Accessory_", "Elemental_",
            "Prefix_Barrel_", "Prefix_Grip_", "Prefix_",
            "Title_Legendary_", "Title_Unique_", "Title__", "Title_",
        ]
        for p in prefixes:
            if short.startswith(p):
                short = short[len(p):]
                break
        # Replace underscores
        short = short.replace("_", " ")
        return short

    def _build_display_name(self, resolved: dict[str, Any]) -> str:
        """Build human-readable item name."""
        parts = resolved.get("resolved_parts", [])
        title_path = prefix_path = None
        for p in parts:
            if p["slot"] == "Title" and p["path"]:
                title_path = p["path"]
            if p["slot"] == "Prefix" and p["path"]:
                prefix_path = p["path"]

        title_text = ""
        if title_path:
            npi = self._weapon_name_parts.get(title_path, {})
            title_text = npi.get("name", "")
            if not title_text:
                title_text = self._clean_part_name(title_path, "Title")

        prefix_text = ""
        if prefix_path:
            npi = self._weapon_name_parts.get(prefix_path, {})
            prefix_text = npi.get("name", "")
            if not prefix_text:
                prefix_text = ""

        if prefix_text and title_text:
            return f"{prefix_text} {title_text}"
        elif title_text:
            return title_text
        elif prefix_text:
            return prefix_text

        # Fallback: use balance name cleaned up
        bal_path = resolved.get("balance_path", "")
        if bal_path:
            name = bal_path.rsplit(".", 1)[-1]
            # Clean up
            for strip in ("Pistol_", "AR_", "SG_", "SMG_", "SR_", "RL_", "Launcher_",
                           "Shield_", "GrenadeMod_", "ClassMod_", "Artifact_"):
                if name.startswith(strip):
                    name = name[len(strip):]
                    break
            return name.replace("_", " ")

        return resolved.get("category", "Unknown Item")

    @staticmethod
    def _level_damage_scale(level: int) -> float:
        """BL2 damage scaling by level.

        BL2 uses different exponential rates across level ranges:
        - Levels 1-30:  ~1.13x per level (early game)
        - Levels 31-50: ~1.10x per level (TVHM plateau)
        - Levels 51-61: ~1.09x per level (UVHM entry)
        - Levels 62-72: ~1.08x per level (UVHM endgame)
        - Levels 73-80: ~1.11x per level (OP levels, steeper curve)
        This produces the characteristic S-curve that keeps damage
        feeling impactful across all playthroughs.
        """
        if level <= 1:
            return 1.0
        scale = 1.0
        for lv in range(2, min(level, 31) + 1):
            scale *= 1.13
        for lv in range(31, min(level, 50) + 1):
            scale *= 1.10
        for lv in range(51, min(level, 61) + 1):
            scale *= 1.09
        for lv in range(62, min(level, 72) + 1):
            scale *= 1.08
        for lv in range(73, level + 1):
            scale *= 1.11
        return scale

    def estimate_weapon_stats(self, resolved: dict[str, Any]) -> Optional[dict[str, float]]:
        """Estimate weapon stats based on type, level, manufacturer, and parts."""
        category = resolved.get("category", "Pistol")
        base = WEAPON_BASE_STATS.get(category, WEAPON_BASE_STATS.get("Pistol", {}))
        if not base:
            return None
        stats = dict(base)

        grade_index = 1
        game_stage = 1
        lv_data = resolved.get("level")
        if lv_data:
            if len(lv_data) > 0:
                grade_index = lv_data[0] or 1
            if len(lv_data) > 1:
                game_stage = lv_data[1] or 1

        # game_stage drives base level scaling via piecewise exponential
        stats["damage"] = stats["damage"] * self._level_damage_scale(game_stage)
        # grade_index adds quality multiplier on top (significant boost at high values)
        if grade_index > game_stage:
            grade_diff = grade_index - game_stage
            grade_bonus = 1.0 + grade_diff * 0.03
            stats["damage"] *= grade_bonus
            stats["fire_rate"] *= (1.0 + grade_diff * 0.004)
            stats["mag_size"] *= (1.0 + grade_diff * 0.006)
            stats["accuracy"] *= (1.0 + grade_diff * 0.002)
            stats["reload_speed"] *= max(0.85, 1.0 - grade_diff * 0.003)

        # Manufacturer mods
        mfr = resolved.get("manufacturer_name", "")
        mfr_mods = MANUFACTURER_STAT_MODS.get(mfr, {})
        for stat, mult in mfr_mods.items():
            if stat in stats:
                stats[stat] *= mult

        # Part mods
        for p in resolved.get("resolved_parts", []):
            slot = p["slot"]
            if slot not in PART_STAT_MODS:
                continue
            path = p.get("path", "")
            if not path:
                continue
            for mfr_key, mods in PART_STAT_MODS[slot].items():
                if mfr_key.lower() in path.lower():
                    for stat, mult in mods.items():
                        if stat in stats:
                            stats[stat] *= mult
                    break

        stats["damage"] = round(stats["damage"])
        stats["fire_rate"] = round(stats["fire_rate"], 1)
        stats["reload_speed"] = round(stats["reload_speed"], 1)
        stats["mag_size"] = max(1, round(stats["mag_size"]))
        stats["accuracy"] = min(100, max(0, round(stats["accuracy"], 1)))
        stats["recoil"] = max(0, round(stats["recoil"], 1))
        return stats

    # ─── Add Weapon API ──────────────────────────────────────

    def get_weapon_categories(self) -> list[dict[str, Any]]:
        categories = {}
        for wtype_path, wtype_data in self._weapon_types.items():
            name = wtype_data.get("name", wtype_path.rsplit(".", 1)[-1])
            type_str = wtype_data.get("type", "Unknown")
            if wtype_path in self._balance_categories:
                categories[wtype_path] = {
                    "path": wtype_path,
                    "name": name,
                    "type": type_str,
                    "display_type": WEAPON_TYPE_DISPLAY.get(type_str, type_str),
                    "balance_count": len(self._balance_categories[wtype_path]),
                }
        return categories

    def get_balances_for_type(self, weapon_type_path: str) -> list[dict[str, str]]:
        paths = self._balance_categories.get(weapon_type_path, [])
        result = []
        for bp in sorted(paths):
            bd = self._weapon_balance.get(bp, {})
            rarity = self.detect_rarity(bp)
            name = bp.rsplit(".", 1)[-1]
            for strip in ("Pistol_", "AR_", "SG_", "SMG_", "SR_", "RL_", "Launcher_"):
                if name.startswith(strip):
                    name = name[len(strip):]
                    break
            name = name.replace("_", " ")
            result.append({
                "path": bp,
                "name": name,
                "rarity": rarity,
                "manufacturers": bd.get("manufacturers", []),
            })
        result.sort(key=lambda x: (x["rarity"]["rank"], x["name"]))
        return result

    def get_parts_for_balance(self, balance_path: str) -> dict[str, list[dict[str, str]]]:
        part_slots = {}
        chain = []
        visited = set()
        path = balance_path
        while path and path not in visited:
            visited.add(path)
            chain.append(path)
            bd = self._weapon_balance.get(path, {})
            path = bd.get("base")
        chain.reverse()
        for bp in chain:
            bd = self._weapon_balance.get(bp, {})
            parts_ref = bd.get("parts")
            if not parts_ref:
                continue
            bpl = self._weapon_balance_parts.get(parts_ref, {})
            mode = bpl.get("mode", "Additive")
            for slot in ["body", "grip", "barrel", "sight", "stock",
                         "elemental", "accessory1", "accessory2",
                         "material", "prefix", "title"]:
                slot_data = bpl.get(slot)
                if slot_data is None:
                    continue
                part_list_ref = slot_data if isinstance(slot_data, str) else slot_data.get("parts", slot_data)
                if isinstance(part_list_ref, str):
                    parts = self._weapon_part_lists.get(part_list_ref, [])
                elif isinstance(part_list_ref, list):
                    parts = part_list_ref
                else:
                    continue
                if mode == "Selective" or slot not in part_slots:
                    part_slots[slot] = parts
                else:
                    existing = set(part_slots[slot])
                    for p in parts:
                        if p not in existing:
                            part_slots[slot].append(p)
        result = {}
        for slot, parts in part_slots.items():
            result[slot] = [{"path": p, "name": self._clean_part_name(p, slot)} for p in parts]
        return result

    def get_weapon_type_for_balance(self, balance_path: str) -> Optional[str]:
        return self._resolve_balance_weapon_type(balance_path)

    def get_manufacturer_for_balance(self, balance_path: str) -> Optional[str]:
        visited = set()
        path = balance_path
        while path and path not in visited:
            visited.add(path)
            bd = self._weapon_balance.get(path, {})
            mfrs = bd.get("manufacturers", [])
            if mfrs:
                return mfrs[0]
            path = bd.get("base")
        return None

    def get_all_parts_for_slot(self, slot: str) -> list[dict[str, str]]:
        """Get ALL weapon parts available for a given slot (body, grip, barrel, etc.)."""
        slot_type_map = {
            "body": "Body", "grip": "Grip", "barrel": "Barrel",
            "sight": "Sight", "stock": "Stock", "elemental": "Elemental",
            "accessory1": "Accessory", "accessory2": "Accessory",
            "material": "Material", "prefix": "Prefix", "title": "Title",
        }
        target_type = slot_type_map.get(slot, slot)
        results = []
        seen_paths = set()
        seen_names = set()

        # Type matching from weapon_parts json
        for path, data in self._weapon_parts.items():
            ptype = data.get("type", "")
            short = path.rsplit(".", 1)[-1].lower()

            match = False
            if target_type == "Elemental":
                # Only match actual elemental parts — not accessories tagged as "Elemental"
                # Must contain element-related keywords AND not be an accessory path
                if ptype == "Elemental" and "accessory" not in short:
                    match = ("element" in short or "fire" in short
                             or "shock" in short or "corrosive" in short or "slag" in short
                             or "explosive" in short or "incendiary" in short
                             or "elemental_none" in short or short.endswith("_none"))
            elif target_type == "Accessory":
                # Match Accessory1/Accessory2 types, plus elemental-typed accessories
                if ptype in ("Accessory1", "Accessory2"):
                    match = True
                elif ptype == "Elemental" and "accessory" in short:
                    match = True
            else:
                match = ptype == target_type

            if match and path not in seen_paths:
                name = self._clean_part_name(path, slot)
                if name not in seen_names:
                    seen_paths.add(path)
                    seen_names.add(name)
                    results.append({"path": path, "name": name})

        # Scan forward index only if we got very few results
        if len(results) < 5:
            for key, path in self._forward.items():
                if key[1] == "WeaponParts" and path not in seen_paths:
                    short = path.rsplit(".", 1)[-1]
                    # Match by slot keyword in the path name
                    kw = target_type if target_type != "Elemental" else "Element"
                    if "_" + kw + "_" in short or short.startswith(kw + "_"):
                        name = self._clean_part_name(path, slot)
                        if name not in seen_names:
                            seen_paths.add(path)
                            seen_names.add(name)
                            results.append({"path": path, "name": name})

        results.sort(key=lambda x: x["name"])
        return results

    def get_all_item_parts_for_slot(self, slot: str) -> list[dict[str, str]]:
        """Get ALL item parts (shields, relics, mods, grenades) for a given slot."""
        # Item parts use Greek letter types: Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta, Material
        slot_type_map = {
            "alpha": "Alpha", "beta": "Beta", "gamma": "Gamma",
            "delta": "Delta", "epsilon": "Epsilon", "zeta": "Zeta",
            "eta": "Eta", "theta": "Theta", "material": "Material",
        }
        target_type = slot_type_map.get(slot, slot)
        results = []
        seen_paths = set()
        seen_names = set()

        for path, data in self._item_parts.items():
            ptype = data.get("type", "")
            if ptype == target_type and path not in seen_paths:
                name = self._clean_part_name(path, slot)
                if name not in seen_names:
                    seen_paths.add(path)
                    seen_names.add(name)
                    results.append({"path": path, "name": name})

        # Fallback scan forward index
        if len(results) < 3:
            for key, path in self._forward.items():
                if key[1] == "ItemParts" and path not in seen_paths:
                    short = path.rsplit(".", 1)[-1]
                    if target_type.lower() in short.lower():
                        name = self._clean_part_name(path, slot)
                        if name not in seen_names:
                            seen_paths.add(path)
                            seen_names.add(name)
                            results.append({"path": path, "name": name})

        results.sort(key=lambda x: x["name"])
        return results

    # ─── Add Item API (non-weapons) ────────────────────────────

    def get_item_categories(self) -> list[dict[str, Any]]:
        """Get item categories: Shield, Grenade Mod, Class Mod, Relic."""
        categories = {}
        for bal_path, bal_data in self._item_balance.items():
            item_ref = bal_data.get("item", "")
            cat = None
            for key, display in ITEM_TYPE_CATEGORIES.items():
                if key in bal_path or key in item_ref:
                    cat = key
                    break
            if cat and cat != "MissionItem":
                display = ITEM_TYPE_CATEGORIES[cat]
                if cat not in categories:
                    categories[cat] = {"key": cat, "name": display, "count": 0}
                categories[cat]["count"] += 1
        return sorted(categories.values(), key=lambda x: x["name"])

    def get_item_balances_for_category(self, category: str) -> list[dict[str, Any]]:
        """Get all item balances for a category (Shield, GrenadeMod, ClassMod, Artifact)."""
        results = []
        for bal_path, bal_data in self._item_balance.items():
            item_ref = bal_data.get("item", "")
            if category not in bal_path and category not in item_ref:
                continue
            name = bal_path.rsplit(".", 1)[-1]
            for strip in ("Shield_", "GrenadeMod_", "ClassMod_", "Artifact_",
                          "ItemGrade_Gear_", "ItemGrade_"):
                if name.startswith(strip):
                    name = name[len(strip):]
                    break
            name = name.replace("_", " ")
            rarity = self.detect_rarity(bal_path)
            mfrs = bal_data.get("manufacturers", [])
            results.append({
                "path": bal_path,
                "name": name,
                "rarity": rarity,
                "manufacturers": mfrs,
            })
        results.sort(key=lambda x: (x["rarity"]["rank"], x["name"]))
        return results

    def get_item_parts_for_balance(self, balance_path: str) -> dict[str, list[dict[str, str]]]:
        """Get available parts for an item balance, resolving through part lists."""
        bal_data = self._item_balance.get(balance_path, {})
        item_ref = bal_data.get("item", "")
        item_data = self._item_types.get(item_ref, {})

        # Item parts are named alpha_parts, beta_parts, etc.
        slot_names = {
            "alpha": "Body", "beta": "Battery/Grip", "gamma": "Capacitor/Barrel",
            "delta": "Accessory", "epsilon": "Accessory 2", "zeta": "Slot 6",
            "eta": "Slot 7", "theta": "Slot 8", "material": "Material",
        }
        result = {}
        # Check item_data for part lists
        for slot_key, display_name in slot_names.items():
            parts_ref = item_data.get(f"{slot_key}_parts", "")
            if not parts_ref:
                continue
            # Resolve part list
            parts = self._resolve_item_part_list(parts_ref, slot_key)
            if parts:
                result[display_name] = [{"path": p, "name": self._clean_part_name(p, slot_key)} for p in parts]

        # Also check balance-level parts override
        bal_parts_ref = bal_data.get("parts", "")
        if bal_parts_ref and isinstance(bal_parts_ref, str):
            # Sometimes the balance has a single part list that overrides
            for slot_key, display_name in slot_names.items():
                if display_name not in result:
                    parts = self._resolve_item_part_list(bal_parts_ref, slot_key)
                    if parts:
                        result[display_name] = [{"path": p, "name": self._clean_part_name(p, slot_key)} for p in parts]

        return result

    def _resolve_item_part_list(self, parts_ref: str, slot_key: str) -> list[str]:
        """Resolve an item part list reference to actual part paths."""
        parts = []
        # Use pre-built type index instead of scanning all item parts
        candidates = self._item_parts_by_type.get(slot_key, [])
        if not candidates:
            candidates = self._item_parts_by_type.get(slot_key.capitalize(), [])
        ref_prefix = parts_ref.rsplit(".", 1)[0]
        ref_suffix = parts_ref.split(".")[-1].replace("PartsList_", "")
        for path, data in candidates:
            if ref_prefix in path or ref_suffix in path:
                parts.append(path)
        # Broader fallback: match by keywords from reference
        if not parts:
            ref_short = parts_ref.rsplit(".", 1)[-1].lower()
            keywords = [kw for kw in ref_short.replace("partslist_", "").split("_") if len(kw) > 3]
            for path, data in candidates:
                if any(kw in path.lower() for kw in keywords):
                    parts.append(path)
        return parts

    def get_item_type_for_balance(self, balance_path: str) -> Optional[str]:
        """Get item type path from a balance."""
        bal_data = self._item_balance.get(balance_path, {})
        return bal_data.get("item", None)

    def get_manufacturer_for_item_balance(self, balance_path: str) -> Optional[str]:
        """Get manufacturer from an item balance."""
        bal_data = self._item_balance.get(balance_path, {})
        mfrs = bal_data.get("manufacturers", [])
        return mfrs[0] if mfrs else None

    def get_all_balances(self) -> list[dict[str, str]]:
        """Get all weapon balance definitions grouped by category."""
        results = []
        for bp, bd in self._weapon_balance.items():
            rarity = self.detect_rarity(bp)
            name = bp.rsplit(".", 1)[-1]
            for strip in ("Pistol_", "AR_", "SG_", "SMG_", "SR_", "RL_", "Launcher_"):
                if name.startswith(strip):
                    name = name[len(strip):]
                    break
            name = name.replace("_", " ")
            wtype = self._resolve_balance_weapon_type(bp)
            cat = self.detect_weapon_category(wtype) if wtype else "Unknown"
            results.append({"path": bp, "name": name, "rarity": rarity, "category": cat})
        results.sort(key=lambda x: (x["category"], x["rarity"]["rank"], x["name"]))
        return results

    def get_all_manufacturers(self) -> list[dict[str, str]]:
        """Get all manufacturer definitions."""
        results = []
        seen = set()
        for key, path in self._forward.items():
            if key[1] == "Manufacturers" and path not in seen:
                seen.add(path)
                results.append({"path": path, "name": self.get_manufacturer_name(path)})
        results.sort(key=lambda x: x["name"])
        return results


_db = None

def get_db() -> AssetDB:
    global _db
    if _db is None:
        _db = AssetDB()
    return _db
