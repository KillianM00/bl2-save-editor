"""
Integration tests for the Flask API endpoints.
Uses the test fixture save file and a temporary save directory.

MoSCoW ref: P8-S1 (integration tests for API endpoints)
"""
import os
import sys
import json
import shutil
import tempfile
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import save_io
import app as flask_app


FIXTURE_DIR = os.path.dirname(__file__)
FIXTURE_SAVE = os.path.join(FIXTURE_DIR, "Save0001.sav")


@pytest.fixture
def tmp_save_dir(tmp_path):
    """Create a temp save directory with the fixture save file."""
    if not os.path.exists(FIXTURE_SAVE):
        pytest.skip("Test fixture Save0001.sav not found")
    shutil.copy2(FIXTURE_SAVE, tmp_path / "Save0001.sav")
    return tmp_path


@pytest.fixture
def client(tmp_save_dir):
    """Flask test client with save_io pointing at the temp directory."""
    old_save_dir = save_io.SAVE_DIR
    save_io.SAVE_DIR = str(tmp_save_dir)
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c
    save_io.SAVE_DIR = old_save_dir


# ═══════════════════════════════════════════════════════════════
# Read-Only Endpoints
# ═══════════════════════════════════════════════════════════════

class TestListSaves:
    def test_returns_saves(self, client):
        r = client.get("/api/saves")
        assert r.status_code == 200
        data = r.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["filename"] == "Save0001.sav"

    def test_has_size_and_modified(self, client):
        r = client.get("/api/saves")
        save = r.get_json()[0]
        assert "size_kb" in save
        assert "modified" in save
        assert save["size_kb"] > 0


class TestLoadSave:
    def test_loads_character(self, client):
        r = client.get("/api/save/Save0001.sav")
        assert r.status_code == 200
        data = r.get_json()
        assert "character" in data
        assert "inventory" in data
        assert data["character"]["class_name"] == "Axton"
        assert data["character"]["level"] == 8

    def test_inventory_structure(self, client):
        r = client.get("/api/save/Save0001.sav")
        inv = r.get_json()["inventory"]
        assert "weapons" in inv
        assert "items" in inv
        assert "bank" in inv

    def test_invalid_filename_rejected(self, client):
        # Flask normalizes ../ in URLs, so this may 404 before reaching our validator
        r = client.get("/api/save/../../etc/passwd")
        assert r.status_code in (400, 404)

    def test_bad_pattern_rejected(self, client):
        r = client.get("/api/save/notasave.txt")
        assert r.status_code == 400

    def test_nonexistent_save_500(self, client):
        r = client.get("/api/save/Save9999.sav")
        assert r.status_code == 500


class TestGameStatus:
    def test_returns_running_field(self, client):
        r = client.get("/api/game-status")
        assert r.status_code == 200
        data = r.get_json()
        assert "running" in data
        assert isinstance(data["running"], bool)


# ═══════════════════════════════════════════════════════════════
# Write Endpoints
# ═══════════════════════════════════════════════════════════════

class TestUpdateCharacter:
    def test_change_level(self, client):
        r = client.post("/api/save/Save0001.sav/character",
                        json={"level": 50})
        assert r.status_code == 200
        data = r.get_json()
        assert data["level"] == 50

    def test_change_money(self, client):
        r = client.post("/api/save/Save0001.sav/character",
                        json={"money": 999999})
        assert r.status_code == 200
        assert r.get_json()["money"] == 999999

    def test_change_name(self, client):
        r = client.post("/api/save/Save0001.sav/character",
                        json={"name": "TestName"})
        assert r.status_code == 200
        assert r.get_json()["name"] == "TestName"

    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/badfile.exe/character", json={"level": 50})
        assert r.status_code == 400


class TestSetItemLevel:
    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/evil.sav/items/54/0/level", json={"level": 50})
        assert r.status_code == 400


class TestDeleteItem:
    def test_invalid_filename_blocked(self, client):
        # Flask normalizes ../ in URLs before routing
        r = client.delete("/api/save/../hack.sav/items/54/0")
        assert r.status_code in (400, 404)


class TestDuplicateItem:
    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/nope.txt/items/54/0/duplicate")
        assert r.status_code == 400


class TestBulkLevel:
    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/x.sav/items/54/bulk-level", json={"level": 50})
        assert r.status_code == 400


class TestImport:
    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/bad/import", json={"codes": ""})
        assert r.status_code == 400

    def test_empty_import(self, client):
        r = client.post("/api/save/Save0001.sav/import", json={"codes": ""})
        assert r.status_code == 200
        data = r.get_json()
        assert data["imported"] == 0

    def test_invalid_code_reports_errors(self, client):
        r = client.post("/api/save/Save0001.sav/import",
                        json={"codes": "BL2(notbase64!!!)\nBL2(dG9vc2hvcnQ=)"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["imported"] == 0
        assert len(data["errors"]) >= 1


class TestExport:
    def test_export_all(self, client):
        r = client.get("/api/save/Save0001.sav/export-all")
        assert r.status_code == 200
        data = r.get_json()
        assert "weapons" in data
        assert "items" in data
        assert "bank" in data


# ═══════════════════════════════════════════════════════════════
# Backup Verification
# ═══════════════════════════════════════════════════════════════

class TestBackupCreation:
    def test_write_creates_backup(self, client, tmp_save_dir):
        # Trigger a write
        client.post("/api/save/Save0001.sav/character", json={"level": 30})
        bak = tmp_save_dir / "Save0001.sav.bak"
        assert bak.exists(), "Backup file should be created after write"

    def test_multiple_writes_rotate(self, client, tmp_save_dir):
        # Three writes should create .bak, .bak.1, .bak.2
        client.post("/api/save/Save0001.sav/character", json={"level": 10})
        client.post("/api/save/Save0001.sav/character", json={"level": 20})
        client.post("/api/save/Save0001.sav/character", json={"level": 30})
        assert (tmp_save_dir / "Save0001.sav.bak").exists()
        assert (tmp_save_dir / "Save0001.sav.bak.1").exists()
        assert (tmp_save_dir / "Save0001.sav.bak.2").exists()

    def test_write_preserves_data(self, client):
        """Write then read back should reflect changes."""
        client.post("/api/save/Save0001.sav/character", json={"level": 72})
        r = client.get("/api/save/Save0001.sav")
        assert r.get_json()["character"]["level"] == 72


# ═══════════════════════════════════════════════════════════════
# Batch Parts Endpoint
# ═══════════════════════════════════════════════════════════════

class TestBatchParts:
    def test_returns_parts_for_slots(self, client):
        r = client.get("/api/assets/all-parts-batch?kind=weapon&slots=barrel,grip")
        assert r.status_code == 200
        data = r.get_json()
        assert "barrel" in data
        assert "grip" in data
        assert isinstance(data["barrel"], list)
        assert isinstance(data["grip"], list)

    def test_empty_slots_returns_400(self, client):
        r = client.get("/api/assets/all-parts-batch?kind=weapon&slots=")
        assert r.status_code == 400

    def test_single_slot(self, client):
        r = client.get("/api/assets/all-parts-batch?kind=weapon&slots=barrel")
        assert r.status_code == 200
        data = r.get_json()
        assert "barrel" in data
        assert len(data["barrel"]) > 0


# ═══════════════════════════════════════════════════════════════
# Transfer Endpoint
# ═══════════════════════════════════════════════════════════════

class TestTransfer:
    def test_invalid_filename_blocked(self, client):
        r = client.post("/api/save/evil.exe/items/54/0/transfer",
                        json={"to_field": 41})
        assert r.status_code == 400

    def test_invalid_source_field(self, client):
        r = client.post("/api/save/Save0001.sav/items/99/0/transfer",
                        json={"to_field": 41})
        assert r.status_code == 400

    def test_invalid_target_field(self, client):
        r = client.post("/api/save/Save0001.sav/items/54/0/transfer",
                        json={"to_field": 99})
        assert r.status_code == 400

    def test_same_field_fails(self, client):
        r = client.post("/api/save/Save0001.sav/items/54/0/transfer",
                        json={"to_field": 54})
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════
# Stat Estimation
# ═══════════════════════════════════════════════════════════════

class TestStatEstimation:
    def test_level_damage_scale_identity(self):
        import asset_db
        db = asset_db.get_db()
        assert db._level_damage_scale(1) == 1.0

    def test_level_damage_scale_monotonic(self):
        """Damage should strictly increase with level."""
        import asset_db
        db = asset_db.get_db()
        prev = 0
        for lv in range(1, 81):
            cur = db._level_damage_scale(lv)
            assert cur > prev, f"Scale not monotonic at level {lv}: {cur} <= {prev}"
            prev = cur

    def test_level_damage_scale_reasonable_at_72(self):
        """At level 72, damage should be roughly 10k-100k range vs base ~18."""
        import asset_db
        db = asset_db.get_db()
        scale = db._level_damage_scale(72)
        # 1.13^71 ~ 4500, our piecewise should be in similar ballpark
        assert 500 < scale < 50000, f"Scale at 72 seems wrong: {scale}"
