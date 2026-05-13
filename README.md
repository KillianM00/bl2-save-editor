# BL2 Save Editor

A full-stack Borderlands 2 save editor built as a local Flask web application
with a Three.js 3D viewer and a holographic UI themed after the in-game
aesthetic. End-to-end: parse Gearbox's encrypted protobuf save format, edit
characters / inventory / weapons / bank, render real glTF character and weapon
models in-browser, import/export industry-standard Gibbed save codes, and write
back atomically with rotating backups and post-write verification.

![Python](https://img.shields.io/badge/Python-3.8+-blue) ![Flask](https://img.shields.io/badge/Flask-2.0+-green) ![Three.js](https://img.shields.io/badge/Three.js-r128-orange) ![License](https://img.shields.io/badge/license-personal_use-lightgrey)

---

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

## Architecture

```
                ┌──────────────────────┐
   Browser ──→  │  Flask app (app.py)  │   ← single-page UI; JSON API
                └──────────┬───────────┘
                           │
       ┌───────────────────┼─────────────────────┐
       ▼                   ▼                     ▼
┌─────────────┐    ┌───────────────┐    ┌──────────────────┐
│  save_io    │    │   asset_db    │    │ steam_achievements│
│  protobuf   │    │   Gibbed-data │    │  Steam API ctypes │
│  parse +    │    │   resolver +  │    │  shim             │
│  write      │    │   stat calcs  │    └──────────────────┘
└──────┬──────┘    └───────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  apocalyptech/borderlands2 library     │   external pinned dep
│  (encrypted-LZO save format)           │
└────────────────────────────────────────┘
```

- **`app.py`** — Flask routes for save list / character get-set / inventory
  manipulation / Gibbed import-export / exe patch / Steam-API queries.
  Handles browser auto-launch and free-port selection on startup.
- **`save_io.py`** — the load-edit-save pipeline. Decrypts and parses the
  protobuf save, mutates fields, re-serialises, writes a rotating backup, then
  atomically renames the temp file to the real save path. Verifies the write
  by re-reading and comparing SHA-1 + item count.
- **`asset_db.py`** — resolves Gibbed JSON exports into typed objects: weapon
  balance definitions, item-part trees, head/skin asset paths, rarity colors,
  per-part stat modifiers. Includes a live stat estimator that mirrors the
  in-game UI's damage / accuracy / fire-rate calculations.
- **`steam_achievements.py`** — `ctypes` shim over `steam_api64.dll` to query
  unlocked achievements and challenge progress without a separate Steam client
  binding.
- **`patch_bl2.py`** — exe patcher that raises the grade-index cap from 80 to
  127 via a single targeted byte rewrite (with verification + unpatch
  support).
- **`templates/index.html` + `static/app.js` + `static/viewer3d.js`** —
  single-page UI; vanilla JS frontend, no framework. Three.js handles the 3D
  character / weapon / item viewer with per-rarity glTF materials and skin
  color tinting.

## Features

**Character editing.** Level, XP, skill points, OP level. All currencies
(money, eridium, seraph crystals, torgue tokens, golden keys). Inventory /
weapon / bank slot sizes. Name, head, skin, 3-zone RGB color customization.

**Inventory.** Browse weapons, items (shields / grenades / mods / relics), and
bank contents with rarity-colored cards and live stat preview. Delete,
duplicate, or change level. Full weapon editor exposes all 11 part slots with
on-the-fly stat estimation. Add new weapons from the full balance-definition
database.

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

## Engineering decisions worth highlighting

- **Atomic writes + rotating backups + post-write verification.** Every save
  operation writes to a temp file, atomically renames to the real path,
  rotates up to 5 `.bak` generations, then re-reads the written file and
  asserts the SHA-1 digest + item count match the in-memory state. A
  half-completed write under power loss leaves the previous save intact; a
  corrupted write surfaces an explicit error and the backup is one filename
  away. Covered by a kill-mid-save test in `tests/test_save_io.py`.
- **Game-running detection with cached subprocess.** The editor refuses to
  overwrite saves while `Borderlands2.exe` is running (would race the game's
  in-memory state). Detection uses `tasklist` / `ps` polled per-write but
  cached for 3 seconds so rapid edits don't fork a flurry of subprocesses.
- **Cross-platform path auto-detection.** `config.py` probes Steam install
  paths and save folders for Windows / Linux / macOS without requiring the
  user to write any path manually.
- **glTF asset pipeline.** Custom UModel-export → glTF + PNG sidecar pipeline
  with `tools/parse_head_mics.py` and `tools/parse_weapon_mics.py` regenerating
  the per-rarity material JSON the viewer consumes. The 3D viewer degrades
  gracefully — meshes without extracted assets fall back to a procedural
  rarity-tinted placeholder rather than erroring out.
- **Single-page no-framework frontend.** Vanilla JS, ~1.5K LOC in `app.js`. No
  build step, no bundler. The whole frontend is hot-reloadable just by
  refreshing the browser.
- **Idempotent setup wizard.** `setup_wizard.py` is safe to re-run — it
  detects existing config, venv, dependencies, and the `borderlands2-tool`
  checkout and fills in only what's missing.

## Skills demonstrated

- **Binary format reverse engineering**: parsing Gearbox's encrypted +
  compressed + protobuf-encoded `.sav` format, mutating in place, re-encoding
  with byte-perfect round-trip.
- **Full-stack web app**: Flask backend with a JSON API, single-page vanilla
  JS frontend, Three.js 3D rendering pipeline.
- **Game-tooling pipeline**: UModel export → glTF transcoding → custom JSON
  sidecar with per-rarity material data, all driven by tools the user can
  re-run when game assets change.
- **Cross-platform OS integration**: auto-detection of Steam installs on
  Windows / Linux / macOS, `ctypes` Steam API binding, exe patching with
  unpatch support.
- **Data safety engineering**: atomic file writes, rotating backups,
  post-write verification, kill-mid-save resilience.
- **Test discipline**: unit tests for the save I/O pipeline and the JSON API
  surface under `tests/`.

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
   git clone --depth 1 https://github.com/apocalyptech/borderlands2.git
   ```
4. **Configure paths.** Copy `config.example.json` to `config.json` and edit:
   ```json
   {
     "save_dir": "C:\\Users\\YourName\\Documents\\My Games\\Borderlands 2\\WillowGame\\SaveData\\YourSteamID",
     "gibbed_dir": "C:\\path\\to\\gibbed_data",
     "borderlands2_tool_dir": "./borderlands2",
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

## Compared with Gibbed's Save Editor

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
| Skill tree editor | — | ✓ |

## License

Personal and educational use. Borderlands 2 is a trademark of Gearbox Software
and 2K Games. This editor reads and writes save formats; no game binaries or
copyrighted assets are distributed with this repository.

## Contact

Killian Miller — killianmiller6@gmail.com — github.com/KillianM00
