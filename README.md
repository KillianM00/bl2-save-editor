# BL2 Save Editor

Edit Borderlands 2 saves in a local browser interface. You can change character data and items, with an optional 3D item viewer. Close the game before editing and keep a separate copy of your saves.

## Quick start

```bash
git clone https://github.com/KillianM00/bl2-save-editor.git
cd bl2-save-editor
python setup_wizard.py
```

The wizard verifies your Python version, sets up a virtual environment,
installs dependencies, auto-detects your Borderlands 2 install + save folder,
clones the `borderlands2-tool` dependency, runs a smoke test, and offers to
launch the editor — all interactively, all idempotent.

**Want zero prompts?** `python setup_wizard.py --yes --launch`

> **Note**: on Windows use `python`, not `python3` — the `python3` command
> on Windows is a Microsoft Store stub that won't run your real interpreter.
> On Debian / Ubuntu and a few other Linux distros where only `python3` is on
> PATH, use `python3 setup_wizard.py` instead.

## Features

**Character editing.** Level, XP, skill points, OP level. All currencies
(money, eridium, seraph crystals, torgue tokens, golden keys). Inventory /
weapon / bank slot sizes. Name, head, skin, 3-zone RGB color customization.

**Inventory.** Browse weapons, items (shields / grenades / mods / relics), and
bank contents with rarity-colored cards and live stat preview. Delete,
duplicate, or change level. Full weapon editor exposes all 11 part slots with
on-the-fly stat estimation. Add new weapons from the full balance-definition
database.

**Skill tree editor.** Full per-class skill tree visualization driven by
`static/skill_trees.json`. Live counters for points unspent / allocated /
available. Color-coded tree panels matching each character's in-game UI.
Per-skill increment / decrement controls with rank validation against tier
prerequisites. Respec by zeroing all skills and recovering points.

**Gibbed integration.** Import `BL2(...)` codes from forums, Reddit, Discord.
Export individual items or the entire inventory as Gibbed codes. Drop-in
compatibility with the Gibbed save-editor format that the community has used
for a decade.

**3D viewer.** Browser-native Three.js scene with character mesh, skin-color
zone tinting, weapon preview with per-rarity / per-element materials, item
previews for shields / grenades / relics / class mods, and an orbit-controlled
equipment carousel.

**Exe patcher + damage mod.** Raise the grade-index cap from 80 to 127 with a
verifiable single-byte patch. Optional PythonSDK mod adds a configurable
damage multiplier (1-100×) tied to a UI slider.

## Manual setup (if you'd rather not use the wizard)

1. **Install Python 3.8+** and clone the repo.
2. **Install dependencies:**
   ```bash
   python -m venv .venv
   .venv/Scripts/activate    # or: source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Clone the external save-format library:**
   ```bash
   git clone --depth 1 https://github.com/apocalyptech/borderlands2.git borderlands2-tool
   ```
4. **Configure paths.** Copy `config.example.json` to `config.json` and edit:
   ```json
   {
     "save_dir": "C:\\Users\\YourName\\Documents\\My Games\\Borderlands 2\\WillowGame\\SaveData\\YourSteamID",
     "gibbed_dir": "C:\\path\\to\\gibbed_data",
     "borderlands2_tool_dir": "./borderlands2-tool",
     "game_dir": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Borderlands 2",
     "backup_generations": 5
   }
   ```
   Empty fields auto-detect.
5. **Run:**
   ```bash
   python app.py
   ```
   The editor opens at `http://localhost:5000` (or the next free port).

## 3D viewer asset extraction (optional)

The viewer works without extracted assets — meshes fall back to procedural
rarity-tinted placeholders. To enable real character and weapon meshes:

1. Run [UModel](https://www.gildor.org/en/projects/umodel) against your BL2
   install and export `Startup.upk` + head / weapon / item packages as glTF
   + PNG into `static/models/` and `static/textures/`.
2. Regenerate material sidecars:
   ```bash
   python tools/parse_head_mics.py
   python tools/parse_weapon_mics.py
   ```
3. Restart the Flask app.

Override the default export paths with `BL2_MATI_EXTRACT`, `BL2_PSK_DIR`, and
`BL2_WEAPON_MODELS_OUT` environment variables.

## Usage

1. Pick a save from the sidebar.
2. Edit character stats in the character panel (auto-saves on blur).
3. Click any weapon or item to preview stats.
4. Use the inventory tabs to manage weapons, items, and bank.
5. Import/export Gibbed codes via the toolbar buttons.
6. Use the 3D viewer to inspect character / weapon models.

**Important.** Close Borderlands 2 before editing. The editor refuses to write
while the game is running and surfaces a warning if it detects the process.

## Project structure

```
bl2-save-editor/
├── app.py                  Flask web server (JSON API)
├── save_io.py              Save file I/O (protobuf + LZO pipeline)
├── asset_db.py             Gibbed asset DB + live stat estimator
├── steam_achievements.py   Steam API ctypes shim
├── patch_bl2.py            Exe patcher (grade-cap rewrite + unpatch)
├── config.py               Cross-platform path auto-detection
├── setup_wizard.py         Interactive end-to-end setup
├── requirements.txt        Python deps
├── start_editor.bat        Windows launcher (auto-opens browser)
├── apply_patch.bat         Self-elevating exe patch launcher
├── templates/
│   └── index.html          Single-page app shell
├── static/
│   ├── app.js              Frontend application logic
│   ├── viewer3d.js         Three.js 3D viewer
│   ├── style.css           BL2-themed holographic UI
│   ├── models/             glTF character / weapon / item meshes (gitignored)
│   └── textures/           PNG material maps (gitignored)
├── tools/
│   ├── parse_head_mics.py     UModel-export → head-material JSON
│   ├── parse_weapon_mics.py   UModel-export → weapon-material JSON
│   └── split_gestalt.py       PSK → per-weapon glTF splitter
├── tests/
│   ├── test_save_io.py        Save round-trip + atomic-write tests
│   └── test_api.py            Flask API surface tests
└── MOSCOW.md                  Feature prioritization
```

## Interoperability and upstream tooling

| Feature | This editor | Gibbed |
|---|---|---|
| Character stats | ✓ | ✓ |
| Inventory editing | ✓ | ✓ |
| Weapon part editor | ✓ | ✓ |
| Gibbed code import/export | ✓ | ✓ |
| **3D model viewer** | ✓ | — |
| **Web-based UI (cross-platform)** | ✓ | — (WinForms) |
| **Live in-game stat estimation** | ✓ | — |
| **Atomic writes + rotating backups** | ✓ | partial |
| **Damage multiplier mod (PythonSDK)** | ✓ | — |
| Skill tree editor | ✓ | ✓ |

## License

Personal and educational use. Borderlands 2 is a trademark of Gearbox Software
and 2K Games. This editor reads and writes save formats; game binaries and extracted model assets are not required in this repository.
Game-related names, artwork, and third-party components retain their respective
ownership and terms. This project is not affiliated with Gearbox or 2K.

## Contact

Killian Miller — killianmiller6@gmail.com — github.com/KillianM00
