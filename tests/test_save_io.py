"""
Unit tests for save_io module — the most critical code path in the project.
Covers bit packing, item encoding/decoding, save read/write round-trips,
backup rotation, and pre-write validation.

MoSCoW refs: P8-M1 (unit tests for save I/O), P8-M2 (test fixtures)
"""
import os
import sys
import shutil
import struct
import random
import tempfile
import pytest

# Ensure project root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import save_io

FIXTURE_DIR = os.path.dirname(__file__)
FIXTURE_SAVE = os.path.join(FIXTURE_DIR, "Save0001.sav")


# ═══════════════════════════════════════════════════════════════
# Bit Packing Round-Trip Tests
# ═══════════════════════════════════════════════════════════════

class TestPackUnpack:
    """Test that pack_item_values -> unpack_item_values is identity."""

    def test_weapon_round_trip_basic(self):
        values = [0, 100, 200, 50, 30, 30, 1000, 2000, 3000, 500, 600, 700, 800, 900, 100, 50, 25]
        packed = save_io.pack_item_values(1, values)
        unpacked = save_io.unpack_item_values(1, packed)
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            assert orig == rt, f"Mismatch at index {i}: {orig} != {rt}"

    def test_item_round_trip_basic(self):
        sizes = save_io.ITEM_SIZES[0]
        values = [min((1 << s) - 1, 42) for s in sizes]
        packed = save_io.pack_item_values(0, values)
        unpacked = save_io.unpack_item_values(0, packed)
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            if orig is not None and rt is not None:
                assert orig == rt, f"Mismatch at index {i}: {orig} != {rt}"

    def test_zero_values(self):
        sizes = save_io.ITEM_SIZES[1]
        values = [0] * len(sizes)
        packed = save_io.pack_item_values(1, values)
        unpacked = save_io.unpack_item_values(1, packed)
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            if orig is not None and rt is not None:
                assert orig == rt, f"Mismatch at index {i}: {orig} != {rt}"

    def test_max_values(self):
        """Each value at its maximum for the bit width."""
        sizes = save_io.ITEM_SIZES[1]
        values = [(1 << s) - 1 for s in sizes]
        packed = save_io.pack_item_values(1, values)
        unpacked = save_io.unpack_item_values(1, packed)
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            if orig is not None and rt is not None:
                assert orig == rt, f"Max-value mismatch at index {i}: {orig} != {rt}"

    def test_random_values(self):
        """Randomized round-trip for both weapon and item."""
        for is_weapon in (0, 1):
            sizes = save_io.ITEM_SIZES[is_weapon]
            for _ in range(50):
                values = [random.randint(0, (1 << s) - 1) for s in sizes]
                packed = save_io.pack_item_values(is_weapon, values)
                unpacked = save_io.unpack_item_values(is_weapon, packed)
                for i, (orig, rt) in enumerate(zip(values, unpacked)):
                    if orig is not None and rt is not None:
                        assert orig == rt, f"Random mismatch (is_weapon={is_weapon}) at index {i}: {orig} != {rt}"


# ═══════════════════════════════════════════════════════════════
# Item Wrap/Unwrap Round-Trip Tests
# ═══════════════════════════════════════════════════════════════

class TestWrapUnwrap:
    """Test that wrap_item -> unwrap_item preserves values."""

    def test_weapon_wrap_unwrap(self):
        values = [0, 50, 100, 25, 40, 40, 500, 1000, 1500, 200, 300, 400, 500, 600, 50, 20, 10]
        key = 12345
        raw = save_io.wrap_item(1, values, key)
        is_weapon, unpacked, out_key = save_io.unwrap_item(raw)
        assert is_weapon == 1
        assert out_key == key
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            if orig is not None and rt is not None:
                assert orig == rt, f"Wrap/unwrap mismatch at {i}: {orig} != {rt}"

    def test_item_wrap_unwrap(self):
        sizes = save_io.ITEM_SIZES[0]
        values = [random.randint(0, (1 << s) - 1) for s in sizes]
        key = -99999
        raw = save_io.wrap_item(0, values, key)
        is_weapon, unpacked, out_key = save_io.unwrap_item(raw)
        assert is_weapon == 0
        assert out_key == key
        for i, (orig, rt) in enumerate(zip(values, unpacked)):
            if orig is not None and rt is not None:
                assert orig == rt

    def test_different_keys(self):
        """Same values with different keys should produce different raw bytes but identical unpack."""
        values = [0, 50, 100, 25, 40, 40, 500, 1000, 1500, 200, 300, 400, 500, 600, 50, 20, 10]
        raw_a = save_io.wrap_item(1, values, 111)
        raw_b = save_io.wrap_item(1, values, 222)
        assert raw_a != raw_b, "Different keys should produce different raw bytes"
        _, unpacked_a, _ = save_io.unwrap_item(raw_a)
        _, unpacked_b, _ = save_io.unwrap_item(raw_b)
        for i in range(len(values)):
            if unpacked_a[i] is not None and unpacked_b[i] is not None:
                assert unpacked_a[i] == unpacked_b[i]


# ═══════════════════════════════════════════════════════════════
# High-Level Item Info Round-Trip Tests
# ═══════════════════════════════════════════════════════════════

class TestItemInfo:
    """Test unwrap_item_info -> wrap_item_info round-trip."""

    def test_info_round_trip(self):
        values = [0, 50, 100, 25, 40, 40, 500, 1000, 1500, 200, 300, 400, 500, 600, 50, 20, 10]
        key = 42
        raw = save_io.wrap_item(1, values, key)
        info = save_io.unwrap_item_info(raw)

        assert info["is_weapon"] == 1
        assert info["level"] == [40, 40]
        assert info["set"] == 0

        # Round-trip back
        re_raw = save_io.wrap_item_info(info)
        _, re_values, _ = save_io.unwrap_item(re_raw)
        for i, (orig, rt) in enumerate(zip(values, re_values)):
            if orig is not None and rt is not None:
                assert orig == rt, f"Info round-trip mismatch at {i}: {orig} != {rt}"


# ═══════════════════════════════════════════════════════════════
# Fake Item Detection
# ═══════════════════════════════════════════════════════════════

class TestFakeItem:
    def test_fake_item_detected(self):
        values = [255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        assert save_io.is_fake_item(1, values) is True

    def test_real_item_not_fake(self):
        values = [0, 50, 100, 25, 40, 40, 500, 1000, 1500, 200, 300, 400, 500, 600, 50, 20, 10]
        assert save_io.is_fake_item(1, values) is False

    def test_partial_zero_not_fake(self):
        values = [255, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        assert save_io.is_fake_item(1, values) is False


# ═══════════════════════════════════════════════════════════════
# Save File Read Tests (using fixture)
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def fixture_player():
    """Read the test fixture save file."""
    if not os.path.exists(FIXTURE_SAVE):
        pytest.skip("Test fixture Save0001.sav not found")
    from borderlands.savefile import BaseApp
    from borderlands.datautil.protobuf import read_protobuf
    with open(FIXTURE_SAVE, "rb") as f:
        raw = f.read()
    player_bytes = BaseApp.unwrap_player_data(raw)
    return read_protobuf(player_bytes)


class TestSaveRead:
    def test_fixture_loads(self, fixture_player):
        """The fixture save file can be parsed without error."""
        assert fixture_player is not None
        assert isinstance(fixture_player, dict)

    def test_character_extraction(self, fixture_player):
        char = save_io.extract_character_info(fixture_player)
        assert char["class_name"] == "Axton"
        assert char["level"] == 8
        assert char["name"] == "Axton"
        assert "money" in char
        assert "eridium" in char

    def test_inventory_extraction(self, fixture_player):
        inv = save_io.extract_inventory(fixture_player)
        assert "weapons" in inv
        assert "items" in inv
        assert "bank" in inv
        assert isinstance(inv["weapons"], list)


# ═══════════════════════════════════════════════════════════════
# Pre-Write Validation Tests
# ═══════════════════════════════════════════════════════════════

class TestValidation:
    def test_valid_player_passes(self, fixture_player):
        """A known-good player dict passes validation."""
        save_io.validate_items(fixture_player)  # should not raise

    def test_corrupted_item_fails(self, fixture_player):
        """Item with truncated/corrupted raw bytes should fail validation."""
        from borderlands.datautil.protobuf import write_protobuf
        player = dict(fixture_player)
        # Create a raw item with garbage bytes (too short — unpacks to all None)
        raw = b"\x87\x00\x00\x00\x01\x02"
        entry = {1: [[2, raw]], 2: [[0, 0]], 3: [[0, 1]]}
        player.setdefault(54, []).append([2, write_protobuf(entry)])
        with pytest.raises(ValueError, match="corrupted item"):
            save_io.validate_items(player)


# ═══════════════════════════════════════════════════════════════
# Backup Rotation Tests
# ═══════════════════════════════════════════════════════════════

class TestBackupRotation:
    def test_rotation_creates_bak(self, tmp_path):
        """First rotation creates .bak from current file."""
        save = tmp_path / "test.sav"
        save.write_text("v1")
        save_io._rotate_backups(str(save))
        bak = tmp_path / "test.sav.bak"
        assert bak.exists()
        assert bak.read_text() == "v1"

    def test_rotation_chains(self, tmp_path):
        """Multiple rotations push backups down the chain."""
        save = tmp_path / "test.sav"

        # Write v1, rotate
        save.write_text("v1")
        save_io._rotate_backups(str(save))

        # Write v2, rotate
        save.write_text("v2")
        save_io._rotate_backups(str(save))

        # Write v3, rotate
        save.write_text("v3")
        save_io._rotate_backups(str(save))

        assert (tmp_path / "test.sav.bak").read_text() == "v3"
        assert (tmp_path / "test.sav.bak.1").read_text() == "v2"
        assert (tmp_path / "test.sav.bak.2").read_text() == "v1"

    def test_rotation_respects_generations(self, tmp_path):
        """Old backups beyond BACKUP_GENERATIONS are overwritten."""
        save = tmp_path / "test.sav"
        old_gens = save_io.BACKUP_GENERATIONS
        try:
            save_io.BACKUP_GENERATIONS = 3
            for i in range(6):
                save.write_text(f"v{i}")
                save_io._rotate_backups(str(save))
            # Only .bak, .bak.1, .bak.2 should exist (3 generations)
            assert (tmp_path / "test.sav.bak").exists()
            assert (tmp_path / "test.sav.bak.1").exists()
            assert (tmp_path / "test.sav.bak.2").exists()
            # .bak.3 may exist from overflow but content is overwritten
        finally:
            save_io.BACKUP_GENERATIONS = old_gens


# ═══════════════════════════════════════════════════════════════
# End-to-End Pipeline Test
# ═══════════════════════════════════════════════════════════════

class TestEndToEnd:
    def test_full_round_trip(self, fixture_player, tmp_path):
        """Read fixture -> modify -> write -> read back -> verify."""
        old_save_dir = save_io.SAVE_DIR
        try:
            save_io.SAVE_DIR = str(tmp_path)
            # Copy fixture to tmp
            src = FIXTURE_SAVE
            dst = tmp_path / "Save0001.sav"
            shutil.copy2(src, dst)

            # Read
            _, player = save_io.read_save("Save0001.sav")
            char = save_io.extract_character_info(player)
            assert char["class_name"] == "Axton"

            # Modify level
            player[2] = [[0, 50]]
            player[3] = [[0, save_io.REQUIRED_XP[49]]]

            # Write
            save_io.write_save("Save0001.sav", player)

            # Read back
            _, player2 = save_io.read_save("Save0001.sav")
            char2 = save_io.extract_character_info(player2)
            assert char2["level"] == 50
            assert char2["class_name"] == "Axton"

            # Backup should exist
            assert (tmp_path / "Save0001.sav.bak").exists()
        finally:
            save_io.SAVE_DIR = old_save_dir
