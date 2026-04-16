"""
BL2 Grade Index Cap Patcher
Patches Borderlands2.exe to raise the manufacturer grade_index cap from 80 to 127.

The game enforces the grade cap at 10 locations:
  - 3 clamping sites: clamp grade_index to 80 on item deserialization
  - 4 validation sites: reject/delete items with grade_index > 80
  - 3 table-size sites: Grades[] lookup table copy bounded to 80 entries

Note: GameStage (offset 0x78 in weapon struct) has NO clamps in the exe --
it's passed directly to scaling functions. The level-scaling cap comes from
UE3's WillowGlobalsDefinition.MaxExperienceLevel property, which must be
raised at runtime (see GradeBypass PythonSDK mod).

Grades[] array: each ManufacturerDefinition has an 81-entry Grades[] array.
The native code copies at most 80 entries into a local buffer and bounds-checks
the index. Patching the table-size pushes from 0x50 to 0x7F allows indexing
up to 126, but the Grades array itself must also be extended at runtime by
the PythonSDK mod for the lookup to return meaningful values.
"""

from __future__ import annotations

import shutil
import os
import sys

from config import get_config

_cfg = get_config()
EXE_PATH = _cfg.get("exe_path", "")
BACKUP_PATH = EXE_PATH + ".backup" if EXE_PATH else ""

# All patch locations: (offset_of_0x50_byte, description)
PATCHES = [
    # ── Clamping sites ──────────────────────────────────────────
    # Pattern: movzx eax, word [esi+0x7A]; cmp eax, 80; jl +7; mov eax, 80
    # Clamps ManufacturerGradeIndex after unpacking from save data.
    # Each has TWO bytes to patch: the cmp operand and the mov operand.
    (0x78c554, "clamp1_cmp"),   # cmp eax, 80  (weapon grade clamp)
    (0x78c558, "clamp1_mov"),   # mov eax, 80
    (0x78d02b, "clamp2_cmp"),   # cmp eax, 80  (item grade clamp)
    (0x78d02f, "clamp2_mov"),   # mov eax, 80
    (0x78d29b, "clamp3_cmp"),   # cmp eax, 80  (item grade clamp variant)
    (0x78d29f, "clamp3_mov"),   # mov eax, 80

    # ── Validation sites ────────────────────────────────────────
    # Pattern: cmp eax/esi, 80; ja <error_handler>
    # Rejects items with grade > cap, sending them to an error/delete path.
    (0xa46c84, "validate1"),    # cmp eax, 80; ja  (func at 0xA46BC0)
    (0xad03f3, "validate2"),    # cmp eax, 80; ja
    (0xad0522, "validate3"),    # cmp eax, 80; ja
    (0xad1e31, "validate4"),    # cmp esi, 80; ja  (func at 0xAD1D70, was missed)

]

# ── Table-size sites (UNSAFE without runtime Grades extension) ──
# These change how many entries the native code copies from the
# Grades[] array.  Patching them WITHOUT first extending the array
# at runtime causes a buffer overread crash.  Only apply these AFTER
# confirming the PythonSDK mod successfully extends Grades[].
TABLE_PATCHES = [
    (0x198488, "table_copy1"),  # push 0x50 (stat calc table copy 1)
    (0x1984a4, "table_bound"),  # cmp ecx, 0x50; jae (bounds check)
    (0x1984c3, "table_copy2"),  # push 0x50 (stat calc table copy 2)
    (0xa46c54, "v1_alloc"),     # push 0x50 (validate1 alloc)
    (0xa46c59, "v1_copy"),      # push 0x50 (validate1 copy)
    (0xad1dcf, "v4_alloc"),     # push 0x50 (validate4 alloc)
    (0xad1dd4, "v4_copy"),      # push 0x50 (validate4 copy)
]

OLD_BYTE = 0x50  # 80
NEW_BYTE = 0x7F  # 127


def patch() -> None:
    if not os.path.exists(EXE_PATH):
        print(f"ERROR: Cannot find {EXE_PATH}")
        sys.exit(1)

    # Read original
    with open(EXE_PATH, "rb") as f:
        data = bytearray(f.read())

    print(f"Loaded exe: {len(data)} bytes")

    # Check if already patched
    already_patched = all(data[offset] == NEW_BYTE for offset, _ in PATCHES)
    if already_patched:
        print(f"Already patched! All {len(PATCHES)} locations are set to 127.")
        return

    # Verify all bytes are what we expect before patching
    for offset, desc in PATCHES:
        actual = data[offset]
        if actual == OLD_BYTE:
            pass  # expected
        elif actual == NEW_BYTE:
            print(f"  {desc} at 0x{offset:08x}: already patched")
        else:
            print(f"ERROR: {desc} at 0x{offset:08x}: expected 0x{OLD_BYTE:02x}, got 0x{actual:02x}")
            print("Exe version mismatch. Aborting.")
            sys.exit(1)

    # Create backup
    if not os.path.exists(BACKUP_PATH):
        print(f"Creating backup: {BACKUP_PATH}")
        shutil.copy2(EXE_PATH, BACKUP_PATH)
        print("  Backup created.")
    else:
        print(f"Backup already exists: {BACKUP_PATH}")

    # Apply patches
    for offset, desc in PATCHES:
        if data[offset] == OLD_BYTE:
            data[offset] = NEW_BYTE
            print(f"  Patched {desc} at 0x{offset:08x}: 0x50 -> 0x7F")

    # Write patched exe
    with open(EXE_PATH, "wb") as f:
        f.write(data)

    patched_count = sum(1 for o, _ in PATCHES if data[o] == NEW_BYTE)
    print(f"\nPatched exe written ({len(data)} bytes)")
    print(f"Applied {patched_count}/{len(PATCHES)} patches.")
    print("Grade index cap raised from 80 to 127.")
    print()
    print("IMPORTANT: Also enable the GradeBypass PythonSDK mod, which:")
    print("  1) Raises MaxExperienceLevel to 127 (unlocks GameStage scaling)")
    print("  2) Extends Grades[] arrays so grade >80 produces real stats")


def unpatch() -> None:
    """Restore original exe from backup."""
    if not os.path.exists(BACKUP_PATH):
        print("No backup found. Cannot unpatch.")
        sys.exit(1)

    shutil.copy2(BACKUP_PATH, EXE_PATH)
    print("Restored original exe from backup.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--unpatch":
        unpatch()
    else:
        patch()
