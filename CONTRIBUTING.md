# Contributing

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `pip install -r requirements.txt && pip install pytest`
3. Copy `config.example.json` to `config.json` and edit with your paths
4. Run the editor: `python app.py`
5. Run tests: `python -m pytest tests/ -v`

## Project Structure

| File | Purpose |
|------|---------|
| `app.py` | Flask web server and API endpoints |
| `save_io.py` | Save file I/O, protobuf pipeline, item encoding/decoding |
| `asset_db.py` | Gibbed JSON asset database and part resolution |
| `patch_bl2.py` | Exe patcher for grade index cap |
| `config.py` | Configuration loader with auto-detection |
| `static/app.js` | Frontend application logic |
| `static/viewer3d.js` | Three.js 3D model viewer |
| `static/style.css` | BL2-themed holographic UI |

## Making Changes

- Create a feature branch from `main`
- Write tests for new backend functionality (see `tests/test_save_io.py`)
- Run the full test suite before submitting: `python -m pytest tests/ -v`
- Keep commits focused and descriptive

## Code Style

- Python: follow existing style (no strict linter yet, but be consistent)
- JavaScript: vanilla ES6, no framework, no build step
- CSS: use CSS custom properties defined in `:root`
- No trailing whitespace, UTF-8 encoding, LF line endings

## Save File Safety

The save I/O pipeline is the most critical code path. Any changes to `save_io.py` must:

1. Pass all existing unit tests
2. Include new tests for new functionality
3. Preserve round-trip integrity (read -> modify -> write -> read must produce identical results for unmodified fields)
4. Never corrupt the save file under any failure condition

The safety mechanisms (rotating backups, atomic writes, pre-write validation, post-write SHA1 verification) must not be bypassed or weakened.

## Pull Requests

- Keep PRs focused on a single feature or fix
- Include a description of what changed and why
- Reference the relevant MoSCoW item if applicable (e.g., "Implements P1-C1: Skill tree viewer")
- All tests must pass in CI before merge
