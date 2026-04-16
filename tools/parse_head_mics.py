#!/usr/bin/env python3
"""Parse BL2 character head MaterialInstanceConstant props.txt files.

Walks every head folder under static/models/heads/, parses the .props.txt under
MaterialInstanceConstant/, resolves the referenced Texture2D files (which live
under that same head's Texture2D/ folder, or under another package's folder we
fall back to), converts the TGAs we actually need into PNGs the browser can
load, and emits static/head_materials.json keyed by head asset path.

Output schema per entry:
    {
        textures: { p_Diffuse: "/static/.../Tex_Dif.png", p_Masks: "...", p_Normal: "...", ... },
        scalars:  { p_DecalIntensity: 0, p_PatternIntensity: 0, p_ShadowsIntensity: 2, ... },
        vectors:  { p_AColorShadow: [r,g,b], ..., p_PowerEmissiveColor: [r,g,b] }
    }

The schema mirrors the Master_Player base material so the renderer can apply
overrides cleanly. Defaults from the base material fill in anything the MIC
does not override.
"""

import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow required: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
HEADS_ROOT = ROOT / "static" / "models" / "heads"
HEAD_MODELS_JSON = ROOT / "static" / "head_models.json"
OUT_JSON = ROOT / "static" / "head_materials.json"


# Master_Player defaults — extracted from any head's Material3/Master_Player.props.txt
MASTER_PLAYER_DEFAULTS = {
    "scalars": {
        "p_DigiStructEnable": 0,
        "p_EnablePowerEmissive": 0,
        "p_Hologram_Enable": 0,
        "p_DecalIntensity": 0,
        "p_PatternIntensity": 0,
        "p_PatternRotation": 0,
        "p_ShadowsIntensity": 2,
        "p_HighlightsIntensity": 2,
        "p_DigistructToggle": 0,
        "p_ColorStructEnable": 0,
    },
    "vectors": {
        "p_PowerEmissiveColor": [0.0, 14.5545, 20.0],
        "p_EmissiveColor":      [0.0231743, 9.04732, 1.30935],
        "p_DecalChannelScale":  [1.0, 1.0, 1.0],
        "p_DecalScalePosition": [1.0, 1.0, 0.0],
        "p_DecalColor":         [1.0, 1.0, 1.0],
        "p_PatternChannelScale":[1.0, 1.0, 1.0],
        "p_PatternScalePosition":[1.0, 1.0, 0.0],
        "p_PatternColor":       [1.0, 1.0, 1.0],
        "p_CColorShadow":       [1.0, 1.0, 1.0],
        "p_CColorHilight":      [1.0, 1.0, 1.0],
        "p_CColorMidtone":      [1.0, 1.0, 1.0],
        "p_BColorShadow":       [1.0, 1.0, 1.0],
        "p_BColorHilight":      [1.0, 1.0, 1.0],
        "p_BColorMidtone":      [1.0, 1.0, 1.0],
        "p_AColorShadow":       [1.0, 1.0, 1.0],
        "p_AColorHilight":      [1.0, 1.0, 1.0],
        "p_AColorMidtone":      [1.0, 1.0, 1.0],
        "p_ReflectColor":       [1.0, 1.0, 1.0],
        "p_DigiStructColor":    [0.2, 1.0, 3.0],
    },
}

# Texture references look like:  Texture2D'CD_Heads_Assassin_Iris.Textures.ZeroIris_Dif'
RE_TEX_REF = re.compile(r"Texture2D'([^']+)'")
RE_PARAM_NAME = re.compile(r"ParameterName\s*=\s*(\S+)")
RE_RGB = re.compile(
    r"R\s*=\s*(-?[\d.eE+]+)\s*,\s*G\s*=\s*(-?[\d.eE+]+)\s*,\s*B\s*=\s*(-?[\d.eE+]+)"
)
RE_TEX_PARAM_OPEN = re.compile(r"TextureParameterValues\[(\d+)\]\s*=\s*\{")
RE_SCALAR_PARAM_OPEN = re.compile(r"ScalarParameterValues\[(\d+)\]\s*=\s*\{")
RE_VEC_PARAM_OPEN = re.compile(r"VectorParameterValues\[(\d+)\]\s*=\s*\{")


def _walk_brace_block(text, start):
    """Given an index right after an opening '{', return the index just after the matching '}'."""
    depth = 1
    i = start
    n = len(text)
    while i < n and depth > 0:
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        i += 1
    return i


def _iter_inner_blocks(text, opener_re):
    """Yield (block_body_text) for each leaf block of the form `XxxParameterValues[N] = { ... }`.

    BL2 props files have a nested layout: an outer `Foo[10] = { Foo[0] = {...} Foo[1] = {...} }`.
    We want only the inner leaves (the ones whose body has a ParameterName).
    """
    pos = 0
    while True:
        opener = opener_re.search(text, pos)
        if not opener:
            return
        body_start = opener.end()
        body_end = _walk_brace_block(text, body_start)
        body = text[body_start:body_end - 1]
        # If this body itself contains another opener of the same type, descend into it
        # (i.e. skip this outer container; let the next iteration find the inner one).
        nested = opener_re.search(body)
        if nested:
            # Move past just this opener to let the inner ones be found
            pos = body_start
        else:
            yield body
            pos = body_end


def parse_props(text):
    """Return (textures, scalars, vectors) parsed from a MIC props.txt."""
    textures = {}
    scalars = {}
    vectors = {}

    for body in _iter_inner_blocks(text, RE_TEX_PARAM_OPEN):
        ref = RE_TEX_REF.search(body)
        nm = RE_PARAM_NAME.search(body)
        if ref and nm:
            textures[nm.group(1).strip()] = ref.group(1).strip()

    for body in _iter_inner_blocks(text, RE_SCALAR_PARAM_OPEN):
        val = re.search(r"ParameterValue\s*=\s*(-?[\d.eE+]+)", body)
        nm = RE_PARAM_NAME.search(body)
        if val and nm:
            try:
                scalars[nm.group(1).strip()] = float(val.group(1))
            except ValueError:
                pass

    for body in _iter_inner_blocks(text, RE_VEC_PARAM_OPEN):
        rgb = RE_RGB.search(body)
        nm = RE_PARAM_NAME.search(body)
        if rgb and nm:
            try:
                vectors[nm.group(1).strip()] = [
                    float(rgb.group(1)), float(rgb.group(2)), float(rgb.group(3))
                ]
            except ValueError:
                pass

    return textures, scalars, vectors


def find_tga_for_ref(ref, head_sf_dir):
    """Resolve a 'Package.Group.TextureName' ref to an on-disk .tga path.

    Most references point at a texture inside the head's own _SF folder; some
    point at shared assets like 'Common_GunMaterials.Env.GlossyA' which we
    cannot resolve from the per-head extraction. Return None for those.
    """
    parts = ref.split(".")
    tex_name = parts[-1]

    # Prefer the head's own Texture2D folder
    candidates = [
        head_sf_dir / "Texture2D" / f"{tex_name}.tga",
        head_sf_dir / "Texture2D" / f"{tex_name}.png",
    ]
    for c in candidates:
        if c.exists():
            return c

    # Fallback: search all heads (some MICs reference shared per-class textures)
    for head_dir in HEADS_ROOT.iterdir():
        if not head_dir.is_dir():
            continue
        for sf in head_dir.iterdir():
            if not sf.is_dir():
                continue
            cand = sf / "Texture2D" / f"{tex_name}.tga"
            if cand.exists():
                return cand
    return None


def ensure_png(tga_path):
    """Convert a .tga to .png next to it (idempotent). Return the .png path."""
    if tga_path.suffix.lower() == ".png":
        return tga_path
    png_path = tga_path.with_suffix(".png")
    if png_path.exists() and png_path.stat().st_mtime >= tga_path.stat().st_mtime:
        return png_path
    try:
        img = Image.open(tga_path)
        # Some TGAs are paletted or grayscale — normalize
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "RGB")
        img.save(png_path, "PNG", optimize=False)
        return png_path
    except Exception as e:
        print(f"  TGA->PNG failed: {tga_path.name}: {e}", file=sys.stderr)
        return None


def to_url(p):
    """Convert an absolute Path under static/ to a /static/... URL."""
    rel = p.resolve().relative_to(ROOT)
    return "/" + str(rel).replace(os.sep, "/")


def main():
    if not HEAD_MODELS_JSON.exists():
        print(f"Missing {HEAD_MODELS_JSON}", file=sys.stderr)
        sys.exit(1)
    head_models = json.loads(HEAD_MODELS_JSON.read_text(encoding="utf-8"))

    # Reverse map: gltf url -> asset path so we can join MIC data back to head asset
    url_to_asset = {v: k for k, v in head_models.items()}

    out = {}
    converted = 0
    no_mic = 0
    parsed = 0

    for head_dir in sorted(HEADS_ROOT.iterdir()):
        if not head_dir.is_dir():
            continue
        # Find SF subfolder (e.g. CD_Assassin_Head_Iris_SF)
        sf_dirs = [d for d in head_dir.iterdir() if d.is_dir()]
        if not sf_dirs:
            continue
        sf_dir = sf_dirs[0]
        mic_dir = sf_dir / "MaterialInstanceConstant"
        skel_dir = sf_dir / "SkeletalMesh3"
        if not mic_dir.exists() or not skel_dir.exists():
            continue

        # Find first .props.txt MIC
        mic_files = sorted(mic_dir.glob("*.props.txt"))
        if not mic_files:
            no_mic += 1
            continue

        # Find the head's gltf URL to map back to asset path
        gltfs = sorted(skel_dir.glob("*.gltf"))
        if not gltfs:
            continue
        gltf_url = to_url(gltfs[0])
        asset_path = url_to_asset.get(gltf_url)
        if not asset_path:
            continue

        # Parse all MICs in this head folder; merge so multiple slots fold together
        textures = {}
        scalars = {}
        vectors = {}
        for mic_file in mic_files:
            t, s, v = parse_props(mic_file.read_text(encoding="utf-8", errors="replace"))
            textures.update(t)
            scalars.update(s)
            vectors.update(v)

        # Resolve & convert texture refs
        tex_urls = {}
        for param_name, ref in textures.items():
            tga = find_tga_for_ref(ref, sf_dir)
            if not tga:
                continue
            png = ensure_png(tga)
            if png and png.suffix.lower() == ".png" and png != tga:
                converted += 1
            if png:
                tex_urls[param_name] = to_url(png)

        # Merge with defaults — explicit MIC value overrides default
        merged_scalars = dict(MASTER_PLAYER_DEFAULTS["scalars"])
        merged_scalars.update(scalars)
        merged_vectors = dict(MASTER_PLAYER_DEFAULTS["vectors"])
        merged_vectors.update(vectors)

        out[asset_path] = {
            "textures": tex_urls,
            "scalars": merged_scalars,
            "vectors": merged_vectors,
        }
        parsed += 1

    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Parsed {parsed} head MICs, converted {converted} TGAs to PNG, "
          f"skipped {no_mic} heads with no MIC")
    print(f"Wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
