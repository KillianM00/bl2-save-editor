"""
Steam Achievement integration for BL2 Save Editor.
Attempts to unlock achievements via Steam API (ctypes).
Falls back gracefully if Steam API is unavailable.
"""
from __future__ import annotations

import ctypes
import os
import sys
import struct
import logging
import platform
from typing import Any, Optional

from config import get_config

log = logging.getLogger("bl2editor.steam")

BL2_APP_ID = 49520

# ─── BL2 Achievement Database ──────────────────────────────────
# (api_name, display_name, description, category)
# Category: "story", "exploration", "combat", "challenge", "misc", "dlc_scarlett",
#           "dlc_torgue", "dlc_hammerlock", "dlc_tina", "dlc_ffs"

BL2_ACHIEVEMENTS = [
    # ── Story Missions ──
    ("Achievement_1", "First One's Free", 'Completed the mission "My First Gun".', "story"),
    ("Achievement_2", "Dragon Slayer", 'Completed the mission "Best Minion Ever".', "story"),
    ("Achievement_3", "A Road Less Traveled", 'Completed the mission "The Road To Sanctuary".', "story"),
    ("Achievement_4", "New In Town", 'Completed the mission "Plan B".', "story"),
    ("Achievement_5", "An Old Flame", 'Completed the mission "Hunting The Firehawk".', "story"),
    ("Achievement_6", "No Man Left Behind", 'Completed the mission "A Dam Fine Rescue".', "story"),
    ("Achievement_7", "Wilhelm Screamed", 'Completed the mission "A Train To Catch".', "story"),
    ("Achievement_8", "Sky's The Limit", 'Completed the mission "Rising Action".', "story"),
    ("Achievement_9", "Can See My House From Here", 'Completed the mission "Bright Lights, Flying City".', "story"),
    ("Achievement_10", "Farewell, Old Girl", 'Completed the mission "Wildlife Preservation".', "story"),
    ("Achievement_11", "Got The Band Back Together", 'Completed the mission "The Once and Future Slab".', "story"),
    ("Achievement_12", "Identity Theft", 'Completed the mission "The Man Who Would Be Jack".', "story"),
    ("Achievement_13", "An Angel's Wish", 'Completed the mission "Where Angels Fear To Tread".', "story"),
    ("Achievement_14", "Bombs Away", 'Completed the mission "Toil And Trouble".', "story"),
    ("Achievement_15", "Knowing Is Half The Battle", 'Completed the mission "Data Mining".', "story"),
    ("Achievement_16", "Cool Story, Bro", "Defeated Jack.", "story"),

    # ── Exploration ──
    ("Achievement_24", "Arctic Explorer", "Discovered all named locations in Three Horns, Tundra Express, and Frostburn Canyon.", "exploration"),
    ("Achievement_25", "Urban Explorer", "Discovered all named locations in Sanctuary, Opportunity, and Lynchwood.", "exploration"),
    ("Achievement_26", "Highlands Explorer", "Discovered all named locations in The Highlands, Thousand Cuts, and Wildlife Exploitation Preserve.", "exploration"),
    ("Achievement_27", "Blight Explorer", "Discovered all named locations in Eridium Blight, Arid Nexus, and Sawtooth Cauldron.", "exploration"),
    ("Achievement_28", "World Traveler", "Discovered all named locations.", "exploration"),

    # ── Combat & Leveling ──
    ("Achievement_20", "Not Quite Dead", "Reached level 5.", "combat"),
    ("Achievement_21", "Better Than You Were", "Reached level 10.", "combat"),
    ("Achievement_22", "Always Improving", "Reached level 25.", "combat"),
    ("Achievement_23", "Capped Out... For Now", "Reached level 50.", "combat"),
    ("Achievement_18", "Goliath, Meet David", "Allowed a goliath to level up four times before killing him.", "combat"),
    ("Achievement_30", "Decked Out", "Had Purple-rated gear or better equipped in every slot.", "combat"),
    ("Achievement_31", "Sabre Rattler", "Killed 100 enemies with the Sabre turret.", "combat"),
    ("Achievement_32", "Phased and Confused", "Phaselocked 100 enemies.", "combat"),
    ("Achievement_33", "So Much Blood!", "Gunzerked continuously for 90 seconds.", "combat"),
    ("Achievement_34", "Cute Loot", "Killed a Chubby.", "combat"),
    ("Achievement_36", "Definitely An Italian Plumber", "Killed Donkey Mong.", "combat"),
    ("Achievement_37", "High-Flying Hurler", "Killed a flying enemy with a thrown Tediore weapon.", "combat"),
    ("Achievement_40", "Unseen Predator", "Remained in Zero's Decepti0n mode for ten seconds straight.", "combat"),
    ("Achievement_41", "Build Buster", "Killed a Constructor without it ever building another bot.", "combat"),
    ("Achievement_44", "Thresher Thrashed", "Defeated Terramorphous the Invincible.", "combat"),

    # ── Side Missions & Challenges ──
    ("Achievement_17", "Challenge Accepted", "Completed level 1 of all non-level-specific challenges with a single character.", "challenge"),
    ("Achievement_19", "Went Five Rounds", "Completed Round 5 of any Circle of Slaughter.", "challenge"),
    ("Achievement_29", "Sugar Daddy", "Tipped Moxxi $10,000.", "challenge"),
    ("Achievement_38", "Token Gesture", "Redeemed 25 tokens.", "challenge"),
    ("Achievement_42", "Well, That Was Easy", 'Completed the mission "Shoot This Guy in the Face".', "challenge"),
    ("Achievement_48", "Bounty Hunter", "Completed 20 side missions.", "challenge"),
    ("Achievement_49", "Did It All", "Completed all side missions.", "challenge"),

    # ── Misc ──
    ("Achievement_35", "Tribute To A Vault Hunter", "Got an item from Michael Mamaril.", "misc"),
    ("Achievement_39", "What does it mean?", "I can't even capture it on my camera.", "misc"),
    ("Achievement_43", "How Do I Look?", "Unlocked 10 customization items.", "misc"),
    ("Achievement_45", "Friendship Rules", 'Revived someone from "Fight for Your Life!" that is on your friends list.', "misc"),
    ("Achievement_46", "Better Than Money", "Purchased 5 items from the black market.", "misc"),
    ("Achievement_47", "Up High, Down Low", "Gave Claptrap a high five.", "misc"),
    ("Achievement_50", "Feels Like The First Time", "Opened the chest at the bus stop in Fyrestone.", "misc"),

    # ── DLC: Captain Scarlett ──
    ("Achievement_51", "Treasure Hunter", 'Completed the mission "X Marks the Spot".', "dlc_scarlett"),
    ("Achievement_52", "Gadabout", "Discovered all named locations in Oasis and the surrounding Pirate's Booty zones.", "dlc_scarlett"),
    ("Achievement_53", "Completionist", "Completed all Pirate's Booty side missions.", "dlc_scarlett"),

    # ── DLC: Mr. Torgue ──
    ("Achievement_54", "Explosive", 'Completed the mission "Long Way To The Top".', "dlc_torgue"),
    ("Achievement_55", "Motorhead", "Completed all Campaign of Carnage side missions.", "dlc_torgue"),
    ("Achievement_56", "Obsessed", "Collected 10 pictures of Moxxi in Campaign of Carnage.", "dlc_torgue"),

    # ── DLC: Sir Hammerlock ──
    ("Achievement_57", "Face Off", 'Completed the mission "The Fall of Nakayama".', "dlc_hammerlock"),
    ("Achievement_58", "Done That", "Completed all Hammerlock's Hunt side missions.", "dlc_hammerlock"),
    ("Achievement_59", "Been There", "Discovered all named locations in Hammerlock's Hunt.", "dlc_hammerlock"),
    ("Achievement_60", "I Totes Planned That Boss", "Slew Mister Boney Pants Guy.", "dlc_hammerlock"),

    # ── DLC: Tiny Tina ──
    ("Achievement_61", "Yaaaaaay", "Introduced thyself to the White Knight.", "dlc_tina"),
    ("Achievement_62", "Shorty, You So Best", "Completed thy quest by rescuing yonder queen.", "dlc_tina"),
    ("Achievement_63", "Girl's Gotta Eat", "Fed thy noble queen 3 times during one visit to her quarters.", "dlc_tina"),
    ("Achievement_64", "It's Like That One Video", 'Showed thine worst enemy, the abomination known as "The Darkness", who is the nerdiest of them all.', "dlc_tina"),
    ("Achievement_65", "They Was All \"Hey That's Mine\"", "Unsheathed 5 swords from Immortal Skeletaurs without leaving the area.", "dlc_tina"),
    ("Achievement_66", "Dang Girl You Ace At This Game", "Won the most challenging round in Murderlin's Temple.", "dlc_tina"),
    ("Achievement_67", "Hmmmmm", "Wielded the Mysterious Amulet.", "dlc_tina"),
    ("Achievement_68", "Keep Rollin' Rollin' Rollin'", "Demonstrated your skill, or lack thereof, at rolling the magical treasure orb of many sides.", "dlc_tina"),
    ("Achievement_69", "Make it Raaaaaid", "Vanquished the Ancient Dragons of Destruction.", "dlc_tina"),

    # ── DLC: Fight for Sanctuary ──
    ("Achievement_70", "Anyway, Here's \"Firewall\"", "Activate the Backburner's firewall.", "dlc_ffs"),
    ("Achievement_71", "Chocolate Chip Confirmed", "Allow Tiny Tina to arm the moonshot cannon.", "dlc_ffs"),
    ("Achievement_72", "Spicy Boy", "Defeat Haderax the Invincible.", "dlc_ffs"),
    ("Achievement_73", "Decrypted!", "Defeat the Dark Web.", "dlc_ffs"),
    ("Achievement_74", "Painbow Connection", "Equip effervescent-quality gear in all slots (except class mod).", "dlc_ffs"),
    ("Achievement_75", "3 or Bust", 'Complete the mission "Paradise Found".', "dlc_ffs"),
]

ACHIEVEMENT_CATEGORIES = {
    "story": "Story Missions",
    "exploration": "Exploration",
    "combat": "Combat & Leveling",
    "challenge": "Side Missions & Challenges",
    "misc": "Miscellaneous",
    "dlc_scarlett": "DLC: Captain Scarlett",
    "dlc_torgue": "DLC: Mr. Torgue",
    "dlc_hammerlock": "DLC: Sir Hammerlock",
    "dlc_tina": "DLC: Tiny Tina",
    "dlc_ffs": "DLC: Fight for Sanctuary",
}

# ─── Steam API Integration ─────────────────────────────────────

_steam_api = None
_steam_initialized = False


def _find_steam_api_dll() -> Optional[str]:
    """Find a steam_api DLL that matches our Python architecture."""
    cfg = get_config()
    is_64bit = struct.calcsize("P") == 8
    dll_name = "steam_api64.dll" if is_64bit else "steam_api.dll"

    candidates = []
    project_root = os.path.dirname(os.path.abspath(__file__))

    # Check project directory first (user-placed or auto-copied DLL)
    candidates.append(os.path.join(project_root, dll_name))

    # Check game directory (matching architecture only)
    game_dir = cfg.get("game_dir", "")
    if game_dir:
        if is_64bit:
            candidates.append(os.path.join(game_dir, "Binaries", "Win64", "steam_api64.dll"))
        else:
            candidates.append(os.path.join(game_dir, "Binaries", "Win32", "steam_api.dll"))

    # Search other installed Steam games for a matching DLL
    if is_64bit:
        steam_root = os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Steam")
        common = os.path.join(steam_root, "steamapps", "common")
        if os.path.isdir(common):
            for game in os.listdir(common):
                game_path = os.path.join(common, game)
                if os.path.isdir(game_path):
                    for root, dirs, files in os.walk(game_path):
                        if dll_name in files:
                            candidates.append(os.path.join(root, dll_name))
                            break

    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def _write_appid_file() -> None:
    """Write steam_appid.txt so SteamAPI_Init knows our app."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "steam_appid.txt")
    with open(path, "w") as f:
        f.write(str(BL2_APP_ID))


def init_steam() -> tuple[bool, str]:
    """Initialize Steam API. Returns (success, message)."""
    global _steam_api, _steam_initialized

    if _steam_initialized:
        return True, "Already initialized"

    if platform.system() != "Windows":
        return False, "Steam API integration is Windows-only"

    dll_path = _find_steam_api_dll()
    if not dll_path:
        is_64bit = struct.calcsize("P") == 8
        if is_64bit:
            return False, (
                "steam_api64.dll not found. BL2 ships 32-bit only. "
                "Place steam_api64.dll from the Steamworks SDK in the editor directory, "
                "or achievements will be set in save state only (they trigger when the game loads)."
            )
        return False, "steam_api.dll not found in game directory"

    _write_appid_file()

    try:
        _steam_api = ctypes.cdll.LoadLibrary(dll_path)
    except OSError as e:
        return False, f"Cannot load {os.path.basename(dll_path)}: {e}"

    try:
        _steam_api.SteamAPI_Init.restype = ctypes.c_bool
        if not _steam_api.SteamAPI_Init():
            _steam_api = None
            return False, "SteamAPI_Init failed — is Steam running and logged in?"
    except Exception as e:
        _steam_api = None
        return False, f"SteamAPI_Init error: {e}"

    _steam_initialized = True

    # Request stats so achievement data is available
    stats = _get_user_stats()
    if stats:
        try:
            fn = _steam_api.SteamAPI_ISteamUserStats_RequestCurrentStats
            fn.argtypes = [ctypes.c_void_p]
            fn.restype = ctypes.c_bool
            fn(stats)
            # Run callbacks to process the stats request
            import time
            _steam_api.SteamAPI_RunCallbacks()
            time.sleep(0.5)
            _steam_api.SteamAPI_RunCallbacks()
        except Exception:
            pass

    log.info("Steam API initialized successfully")
    return True, "Steam API initialized"


def shutdown_steam() -> None:
    """Clean up Steam API."""
    global _steam_api, _steam_initialized, _user_stats_ptr
    if _steam_api and _steam_initialized:
        try:
            _steam_api.SteamAPI_Shutdown()
        except Exception:
            pass
    _steam_api = None
    _steam_initialized = False
    _user_stats_ptr = None


_user_stats_ptr = None


def _get_user_stats():
    """Get ISteamUserStats interface pointer."""
    global _user_stats_ptr
    if _user_stats_ptr:
        return _user_stats_ptr
    if not _steam_api:
        return None
    # Try versioned flat API accessor names
    for version in ("v012", "v011", "v013"):
        fn_name = f"SteamAPI_SteamUserStats_{version}"
        try:
            fn = getattr(_steam_api, fn_name)
            fn.restype = ctypes.c_void_p
            ptr = fn()
            if ptr:
                _user_stats_ptr = ptr
                return ptr
        except AttributeError:
            continue
    return None


def get_achievement_status(api_name: str) -> Optional[bool]:
    """Check if an achievement is unlocked. Returns None if Steam unavailable."""
    stats = _get_user_stats()
    if not stats:
        return None
    try:
        achieved = ctypes.c_bool(False)
        fn = _steam_api.SteamAPI_ISteamUserStats_GetAchievement
        fn.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.POINTER(ctypes.c_bool)]
        fn.restype = ctypes.c_bool
        if fn(stats, api_name.encode("utf-8"), ctypes.byref(achieved)):
            return achieved.value
    except AttributeError:
        pass
    return None


def set_achievement(api_name: str) -> tuple[bool, str]:
    """Unlock a single achievement via Steam API."""
    stats = _get_user_stats()
    if not stats:
        return False, "Steam API not available"
    try:
        fn_set = _steam_api.SteamAPI_ISteamUserStats_SetAchievement
        fn_set.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        fn_set.restype = ctypes.c_bool

        fn_store = _steam_api.SteamAPI_ISteamUserStats_StoreStats
        fn_store.argtypes = [ctypes.c_void_p]
        fn_store.restype = ctypes.c_bool

        if fn_set(stats, api_name.encode("utf-8")):
            fn_store(stats)
            return True, "Achievement unlocked"
        return False, "SetAchievement returned false"
    except AttributeError:
        return False, "Flat API not available in this steam_api.dll version"
    except Exception as e:
        return False, str(e)


def clear_achievement(api_name: str) -> tuple[bool, str]:
    """Lock (re-lock) a single achievement via Steam API."""
    stats = _get_user_stats()
    if not stats:
        return False, "Steam API not available"
    try:
        fn_clear = _steam_api.SteamAPI_ISteamUserStats_ClearAchievement
        fn_clear.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        fn_clear.restype = ctypes.c_bool

        fn_store = _steam_api.SteamAPI_ISteamUserStats_StoreStats
        fn_store.argtypes = [ctypes.c_void_p]
        fn_store.restype = ctypes.c_bool

        if fn_clear(stats, api_name.encode("utf-8")):
            fn_store(stats)
            return True, "Achievement locked"
        return False, "ClearAchievement returned false"
    except AttributeError:
        return False, "Flat API not available"
    except Exception as e:
        return False, str(e)


def unlock_achievements(api_names: list[str]) -> dict[str, Any]:
    """Unlock multiple achievements. Returns results per achievement."""
    stats = _get_user_stats()
    results = {}
    if not stats:
        for name in api_names:
            results[name] = {"ok": False, "error": "Steam API not available"}
        return results

    try:
        fn_set = _steam_api.SteamAPI_ISteamUserStats_SetAchievement
        fn_set.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        fn_set.restype = ctypes.c_bool

        fn_store = _steam_api.SteamAPI_ISteamUserStats_StoreStats
        fn_store.argtypes = [ctypes.c_void_p]
        fn_store.restype = ctypes.c_bool

        for name in api_names:
            ok = fn_set(stats, name.encode("utf-8"))
            results[name] = {"ok": bool(ok)}

        # Store once after all changes
        fn_store(stats)
    except AttributeError:
        for name in api_names:
            results[name] = {"ok": False, "error": "Flat API not available"}
    except Exception as e:
        for name in api_names:
            if name not in results:
                results[name] = {"ok": False, "error": str(e)}
    return results


def get_all_achievements_status() -> list[dict[str, Any]]:
    """Get the full achievement list with current unlock status."""
    result = []
    for api_name, display_name, description, category in BL2_ACHIEVEMENTS:
        status = get_achievement_status(api_name)
        result.append({
            "api_name": api_name,
            "name": display_name,
            "description": description,
            "category": category,
            "category_name": ACHIEVEMENT_CATEGORIES.get(category, category),
            "unlocked": status,  # None = unknown (Steam unavailable)
        })
    return result


def check_steam_health() -> bool:
    """Check if Steam API is still responsive. Returns False if disconnected."""
    if not _steam_api or not _steam_initialized:
        return False
    stats = _get_user_stats()
    if not stats:
        return False
    try:
        # Try a harmless read — if Steam process died, this will fail
        fn = _steam_api.SteamAPI_ISteamUserStats_GetNumAchievements
        fn.argtypes = [ctypes.c_void_p]
        fn.restype = ctypes.c_uint32
        count = fn(stats)
        return count > 0
    except Exception:
        return False


def get_steam_status() -> dict[str, Any]:
    """Get current Steam integration status."""
    healthy = check_steam_health() if _steam_initialized else False
    return {
        "initialized": _steam_initialized,
        "available": _steam_api is not None,
        "healthy": healthy,
    }
