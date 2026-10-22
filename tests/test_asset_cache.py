"""Optional game exports must remain optional after the first launch."""
import pytest
import asset_db


@pytest.mark.parametrize("directory", ["", "missing-export"])
def test_missing_export_ignores_stale_cache(tmp_path, monkeypatch, directory):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(asset_db, "GIBBED_DIR", directory)
    # An earlier launch without exports could create this working-directory cache.
    cache = tmp_path / ".asset_cache.sqlite"
    cache.write_bytes(b"stale cache")
    for _ in range(2):
        db = asset_db.AssetDB()
        assert db.get_all_parts_for_slot("barrel") == []
    assert cache.read_bytes() == b"stale cache"
