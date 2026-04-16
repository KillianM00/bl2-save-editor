# BL2 Save Editor

A full-stack web application for editing Borderlands 2 save files. Features a modern holographic UI themed after BL2's in-game aesthetic, a Three.js 3D character and weapon viewer, full inventory management, and Gibbed code import/export.

![Python](https://img.shields.io/badge/Python-3.8+-blue)
![Flask](https://img.shields.io/badge/Flask-2.0+-green)
![Three.js](https://img.shields.io/badge/Three.js-r128-orange)

## Features

**Character Editing**
- Level, XP, skill points, and OP level
- Currencies: money, eridium, seraph crystals, torgue tokens, golden keys
- Inventory, weapon, and bank slot sizes
- Name, head, skin, and 3-zone RGB color customization

**Inventory Management**
- View all weapons, items (shields/grenades/mods/relics), and bank contents
- Full stat preview with rarity-colored cards and estimated damage/stats
- Delete, duplicate, and change item levels
- Full weapon editor: type, balance, manufacturer, all 11 part slots
- Add new weapons from the complete balance definition database

**Gibbed Integration**
- Import `BL2(...)` codes from forums, Reddit, Discord
- Export individual items or entire inventory as Gibbed codes
- Full compatibility with Gibbed's Save Editor format

**3D Visualization**
- Character model viewer with skin color tinting
- Weapon preview with rarity and element material effects
- Item preview for shields, grenades, relics, and class mods
- Equipment carousel with orbit controls

**Exe Patcher & Damage Mod**
- Patch Borderlands2.exe to raise the grade index cap from 80 to 127
- PythonSDK mod for configurable damage multiplier (1-100x)

## Prerequisites

- **Python 3.8+**
- **Borderlands 2** (Steam version)
- **Gibbed BL2 data files** (JSON extracts from Gibbed's Save Editor)
- **apocalyptech borderlands2-tool** library ([github](https://github.com/apocalyptech/borderlands2))
- **UModel** ([umodel.com](https://www.gildor.org/en/projects/umodel)) — only needed if you want the 3D viewer to show real character/weapon models

## Asset Setup (3D viewer)

The 3D viewer expects extracted Borderlands 2 model and texture assets under
`static/models/` and `static/textures/`. These directories are **not** committed
(they're large, re-derivable, and IP-sensitive). The save editor itself runs
fine without them — you just won't see real meshes in the viewer.

To enable the full viewer, extract assets locally with UModel:

1. Run UModel against your BL2 install, exporting `Startup.upk` and the head /
   weapon / item packages as glTF + PNG into the matching folders under
   `static/models/` and `static/textures/`.
2. Regenerate the material sidecar JSONs:
   ```bash
   python tools/parse_head_mics.py
   python tools/parse_weapon_mics.py
   ```
3. Restart the Flask app. Heads/weapons that have matching extracted assets
   will render with their per-rarity / per-head MIC textures, decals, patterns,
   and zone colors. Anything missing falls back to a procedural tint.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/bl2-save-editor.git
   cd bl2-save-editor
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure paths:**

   Copy the example config and edit it with your paths:
   ```bash
   cp config.example.json config.json
   ```

   Edit `config.json`:
   ```json
   {
     "save_dir": "C:\\Users\\YourName\\Documents\\My Games\\Borderlands 2\\WillowGame\\SaveData\\YourSteamID",
     "gibbed_dir": "C:\\path\\to\\gibbed_data",
     "borderlands2_tool_dir": "C:\\path\\to\\borderlands2-tool",
     "game_dir": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Borderlands 2",
     "backup_generations": 5
   }
   ```

   The editor will attempt to auto-detect these paths if they are not set.

4. **Run the editor:**
   ```bash
   python app.py
   ```

5. **Open your browser** to [http://localhost:5000](http://localhost:5000)

## Usage

1. Select a save file from the sidebar
2. Edit character stats in the character panel (changes save on blur)
3. Click any weapon or item to preview stats
4. Use the inventory tabs to manage weapons, items, and bank
5. Import/export Gibbed codes via the toolbar buttons
6. Use the 3D viewer to inspect character and weapon models

**Important:** Close Borderlands 2 before editing saves. The editor will warn you if the game is running.

## Save Safety

- **Rotating backups:** Every save creates a `.bak` backup, rotating up to 5 generations (`.bak`, `.bak.1`, `.bak.2`, etc.)
- **Atomic writes:** Saves are written to a temp file first, then atomically renamed to prevent corruption from crashes
- **Post-write verification:** Every save is re-read and verified (SHA1 signature + item count check)

## Exe Patcher

The exe patcher (`patch_bl2.py`) raises the grade index cap from 80 to 127, allowing higher-quality items. Run it separately:

```bash
python patch_bl2.py
```

To restore the original exe:
```bash
python patch_bl2.py --unpatch
```

## PythonSDK Damage Mod

The GradeBypass mod multiplies all outgoing weapon damage by a configurable slider (1-100x). Install it by copying the `GradeBypass/` folder to your BL2 `Mods/` directory:

```
Borderlands 2/Binaries/Win32/Mods/GradeBypass/__init__.py
```

Requires [PythonSDK](https://github.com/bl-sdk/PythonSDK) to be installed.

## Project Structure

```
bl2-save-editor/
├── app.py              Flask web server (API endpoints)
├── save_io.py          Save file I/O (protobuf pipeline)
├── asset_db.py         Gibbed asset database resolver
├── patch_bl2.py        Exe patcher for grade cap
├── config.py           Configuration loader
├── config.json         User-specific paths (gitignored)
├── templates/
│   └── index.html      Single-page app shell
├── static/
│   ├── app.js          Frontend application logic
│   ├── viewer3d.js     Three.js 3D viewer
│   ├── style.css       BL2-themed holographic UI
│   └── models/         GLTF character, weapon, and item models
└── MOSCOW.md           Feature prioritization document
```

## Comparison with Gibbed's Save Editor

| Feature | This Editor | Gibbed |
|---------|------------|--------|
| Character stats | Yes | Yes |
| Inventory editing | Yes | Yes |
| Weapon part editor | Yes | Yes |
| Gibbed code import/export | Yes | Yes |
| 3D model viewer | **Yes** | No |
| Web-based UI | **Yes** | No (WinForms) |
| Live stat estimation | **Yes** | No |
| Damage multiplier mod | **Yes** | No |
| Skill tree editor | No | **Yes** |
| Cross-platform | Partial | No |

## License

This project is for personal and educational use. Borderlands 2 is a trademark of Gearbox Software / 2K Games.
