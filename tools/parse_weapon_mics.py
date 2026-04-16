#!/usr/bin/env python3
"""Parse BL2 per-rarity weapon MasterMati_*.props.txt into a JSON sidecar.

Reads from a UModel extraction directory (extracted from Startup.upk) and emits
static/weapon_materials.json keyed by [manufacturer][rarity] containing:
    textures: { p_Diffuse, p_Masks, p_NormalScopesEmissive, p_Decal, p_Pattern, P_SimpleReflect }
    scalars:  { p_HighlightsIntensity, p_ShadowsIntensity, p_DecalRotate, p_UseFullColorDecal }
    vectors:  { p_AColor*, p_BColor*, p_CColor*, p_DecalScalePosition, p_DecalColor,
                p_PatternScalePosition, p_PatternColor, p_PatternChannelScale,
                p_ReflectionChannelScale, p_DColor }

Texture references are resolved into /static/textures/weapons/<TexName>.png. If a
high-resolution PNG is already present in that directory we keep it; otherwise we
convert the (low-res, 64x64) TGA from the umodel extract as a fallback.
"""

import json
import os
import sys
import shutil
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow required: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# Reuse parsing logic from the head MIC parser
sys.path.insert(0, str(Path(__file__).parent))
from parse_head_mics import parse_props  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
EXTRACT_ROOT = Path(os.environ.get(
    "BL2_MATI_EXTRACT",
    r"C:\Users\360ol\AppData\Local\Temp\mati_extract\Startup",
))
MIC_DIR = EXTRACT_ROOT / "MaterialInstanceConstant"
TEX_DIR = EXTRACT_ROOT / "Texture2D"
OUT_TEX_DIR = ROOT / "static" / "textures" / "weapons"
OUT_JSON = ROOT / "static" / "weapon_materials.json"

MFRS = ["Bandit", "Dahl", "Hyperion", "Jakobs", "Maliwan", "Tediore", "Torgue", "Vladof"]
RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]


def resolve_and_convert(ref):
    """Resolve a Texture2D ref to a PNG URL under /static/textures/weapons/.

    Prefers an existing PNG (high-resolution from a prior extraction with TFC
    files) over the freshly-extracted low-res TGA. Returns None if neither
    resource is available.
    """
    tex_name = ref.split(".")[-1]
    existing = OUT_TEX_DIR / f"{tex_name}.png"
    if existing.exists():
        return f"/static/textures/weapons/{tex_name}.png"

    tga = TEX_DIR / f"{tex_name}.tga"
    if not tga.exists():
        return None
    try:
        img = Image.open(tga)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "RGB")
        OUT_TEX_DIR.mkdir(parents=True, exist_ok=True)
        img.save(existing, "PNG", optimize=False)
        return f"/static/textures/weapons/{tex_name}.png"
    except Exception as e:
        print(f"  TGA->PNG failed for {tex_name}: {e}", file=sys.stderr)
        return None


def main():
    if not MIC_DIR.exists():
        print(f"Missing extraction dir: {MIC_DIR}", file=sys.stderr)
        print("Run umodel first to extract MasterMati_* MICs from Startup.upk.")
        sys.exit(1)

    out = {}
    converted = 0
    skipped = 0

    for mfr in MFRS:
        out[mfr] = {}
        for rar in RARITIES:
            mic_file = MIC_DIR / f"MasterMati_{mfr}{rar}.props.txt"
            if not mic_file.exists():
                # Hyperion has no Legendary master MIC in this build
                continue
            text = mic_file.read_text(encoding="utf-8", errors="replace")
            textures, scalars, vectors = parse_props(text)
            tex_urls = {}
            for k, ref in textures.items():
                url = resolve_and_convert(ref)
                if url:
                    tex_urls[k] = url
                    if not (OUT_TEX_DIR / Path(url).name).exists():
                        skipped += 1
                    else:
                        converted += 1
            out[mfr][rar] = {
                "textures": tex_urls,
                "scalars": scalars,
                "vectors": vectors,
            }

    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    parsed = sum(len(v) for v in out.values())
    print(f"Parsed {parsed} weapon MICs (8 mfrs x 5 rarities = 40 max)")
    print(f"Wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
