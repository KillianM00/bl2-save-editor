#!/usr/bin/env python3
"""Split BL2 gestalt weapon meshes into per-manufacturer GLTF models.

Uses connected component analysis + UE3 section ordering to assign
mesh islands to manufacturers. Each weapon type produces 8 manufacturer-
specific models plus a default (full gestalt) fallback.
"""

import struct, json, math, os, io
from collections import defaultdict

# ── PSK reader ──────────────────────────────────────────────

def read_psk(path):
    f = open(path, "rb")
    verts = []
    wedges = []     # [(point_idx, u, v)]
    faces = []      # [(w0, w1, w2, mat)]
    bone_names = []
    bone_weights = defaultdict(list)  # point_idx -> [(bone_idx, weight)]
    extra_uvs = []

    while True:
        hdr = f.read(32)
        if len(hdr) < 32:
            break
        name = hdr[:20].split(b"\x00")[0].decode("ascii", errors="replace")
        tf, ds, dc = struct.unpack("<III", hdr[20:32])

        if name == "PNTS0000":
            for _ in range(dc):
                verts.append(struct.unpack("<fff", f.read(12)))
        elif name == "VTXW0000":
            for _ in range(dc):
                d = f.read(ds)
                pi = struct.unpack("<I", d[0:4])[0]
                u, v = struct.unpack("<ff", d[8:16]) if ds >= 16 else (0.0, 0.0)
                wedges.append((pi, u, v))
        elif name in ("FACE0000", "FACE3200"):
            for _ in range(dc):
                d = f.read(ds)
                if ds == 12:
                    w0, w1, w2 = struct.unpack("<HHH", d[0:6])
                    mat = struct.unpack("<B", d[6:7])[0]
                else:
                    w0, w1, w2 = struct.unpack("<III", d[0:12])
                    mat = struct.unpack("<B", d[12:13])[0] if ds > 12 else 0
                faces.append((w0, w1, w2, mat))
        elif name == "REFSKELT":
            for _ in range(dc):
                d = f.read(ds)
                bone_names.append(d[:64].split(b"\x00")[0].decode("ascii", errors="replace"))
        elif name in ("RAWWEIGHTS", "RAWW0000"):
            for _ in range(dc):
                d = f.read(12)
                w, pi, bi = struct.unpack("<fII", d)
                bone_weights[pi].append((bi, w))
        elif name == "EXTRAUVS0":
            for _ in range(dc):
                d = f.read(ds)
                extra_uvs.append(struct.unpack("<ff", d[0:8]) if ds >= 8 else (0.0, 0.0))
        else:
            f.seek(ds * dc, 1)
    f.close()
    return verts, wedges, faces, bone_names, bone_weights, extra_uvs


# ── Bone classification ────────────────────────────────────

def classify_bone(name):
    """Returns (manufacturer_or_special, is_exclusive)"""
    if "Bandit" in name: return "Bandit"
    if "Dahl" in name: return "Dahl"
    if "Hyperion" in name: return "Hyperion"
    if "Vladof" in name: return "Vladof"
    if "Jakobs" in name or "Jacob" in name or name == "Sideloader": return "Jakobs"
    if "Maliwan" in name or name.startswith("Fin_"): return "Maliwan"
    if "Torgue" in name: return "Torgue"
    if "Tediore" in name: return "Tediore"
    if name in ("MoonClip", "MoonclipShell"): return "_moonclip"
    if "Alien" in name: return "_alien"
    if name.startswith("Shell") and name[5:].isdigit(): return "Hyperion"
    return None  # shared


# ── Connected components ───────────────────────────────────

def find_components(faces, wedges):
    edge_faces = defaultdict(list)
    for fi, (w0, w1, w2, _) in enumerate(faces):
        p0, p1, p2 = wedges[w0][0], wedges[w1][0], wedges[w2][0]
        for e in [(min(p0,p1), max(p0,p1)), (min(p1,p2), max(p1,p2)),
                  (min(p0,p2), max(p0,p2))]:
            edge_faces[e].append(fi)

    parent = list(range(len(faces)))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a, b):
        a, b = find(a), find(b)
        if a != b: parent[a] = b

    for fis in edge_faces.values():
        for i in range(1, len(fis)):
            union(fis[0], fis[i])

    groups = defaultdict(list)
    for fi in range(len(faces)):
        groups[find(fi)].append(fi)
    return list(groups.values())


# ── Section-order manufacturer assignment ──────────────────

MANUFACTURERS = ["Bandit", "Dahl", "Hyperion", "Jakobs", "Maliwan", "Tediore", "Torgue", "Vladof"]

# Which manufacturers make each weapon type
WEAPON_MANUFACTURERS = {
    "Pistol": MANUFACTURERS,
    "Assault_Rifle": ["Bandit", "Dahl", "Jakobs", "Torgue", "Vladof"],
    "SMG": ["Bandit", "Dahl", "Hyperion", "Maliwan", "Tediore"],
    "Shotgun": ["Bandit", "Hyperion", "Jakobs", "Tediore", "Torgue"],
    "Sniper_Rifle": ["Dahl", "Hyperion", "Jakobs", "Maliwan", "Vladof"],
    "Rocket_Launcher": ["Bandit", "Maliwan", "Tediore", "Torgue", "Vladof"],
}


def assign_components(weapon_type, components, faces, wedges, verts, bone_names, bone_weights):
    """Assign components to manufacturers using bone classification + section ordering."""
    mfrs = WEAPON_MANUFACTURERS.get(weapon_type, MANUFACTURERS)
    n_mfrs = len(mfrs)

    # Get primary bone per point
    primary_bone = {}
    for vi in range(len(verts)):
        weights = bone_weights.get(vi, [])
        if weights:
            primary_bone[vi] = max(weights, key=lambda x: x[1])[0]

    # Analyze each component
    comp_info = []
    for comp in components:
        # Dominant bone
        bcounts = defaultdict(int)
        for fi in comp:
            w0, w1, w2, _ = faces[fi]
            for wi in [w0, w1, w2]:
                bi = primary_bone.get(wedges[wi][0], -1)
                if 0 <= bi < len(bone_names):
                    bcounts[bi] += 1
        dom_bi = max(bcounts, key=bcounts.get) if bcounts else -1
        dom_bone = bone_names[dom_bi] if 0 <= dom_bi < len(bone_names) else "?"

        # Manufacturer classification
        mfr_class = classify_bone(dom_bone)

        # Face index range (preserves UE3 section order)
        min_fi = min(comp)
        comp_info.append({
            "faces": comp,
            "size": len(comp),
            "dom_bone": dom_bone,
            "dom_bi": dom_bi,
            "mfr": mfr_class,
            "min_fi": min_fi,
        })

    # Step 1: directly assigned components (manufacturer-specific bones)
    direct = {}   # comp index -> manufacturer
    for ci, info in enumerate(comp_info):
        if info["mfr"] and not info["mfr"].startswith("_"):
            direct[ci] = info["mfr"]
        elif info["mfr"] == "_moonclip":
            direct[ci] = "_moonclip"
        elif info["mfr"] == "_alien":
            direct[ci] = "_alien"

    # Step 2: group shared components by dominant bone, sort by face index
    bone_groups = defaultdict(list)  # bone_name -> [(comp_index, min_fi, size)]
    for ci, info in enumerate(comp_info):
        if ci in direct:
            continue
        bone_groups[info["dom_bone"]].append((ci, info["min_fi"], info["size"]))

    # Step 3: for each bone group with multiple variants, assign round-robin by section order
    shared = {}  # comp index -> manufacturer
    for bone_name, group in bone_groups.items():
        group.sort(key=lambda x: x[1])  # sort by face index

        if len(group) <= 1:
            # Single component for this bone - shared by all
            for ci, _, _ in group:
                shared[ci] = "_all"
            continue

        # Filter out tiny components (< 3 faces) as noise - assign to _all
        big = [(ci, mfi, sz) for ci, mfi, sz in group if sz >= 3]
        tiny = [(ci, mfi, sz) for ci, mfi, sz in group if sz < 3]
        for ci, _, _ in tiny:
            shared[ci] = "_all"

        if len(big) == 0:
            continue

        if len(big) == 1:
            shared[big[0][0]] = "_all"
            continue

        # Multiple variants of the same bone type - these are manufacturer variants
        # Assign round-robin to manufacturers in alphabetical order (matching BL2 section order)
        # If more components than manufacturers, extra go to _all
        for idx, (ci, _, _) in enumerate(big):
            if idx < n_mfrs:
                shared[ci] = mfrs[idx]
            else:
                shared[ci] = "_all"

    return comp_info, direct, shared


# ── GLTF writer ────────────────────────────────────────────

def write_gltf(path, out_verts, out_normals, out_uvs, out_uvs2, out_indices, mesh_name):
    if not out_verts or not out_indices:
        return False

    buf = io.BytesIO()
    use_u32 = max(out_indices) > 65535

    # Indices
    idx_off = 0
    for idx in out_indices:
        buf.write(struct.pack("<I" if use_u32 else "<H", idx))
    idx_size = buf.tell()
    while buf.tell() % 4: buf.write(b"\x00")

    # Positions
    pos_off = buf.tell()
    mins = list(out_verts[0])
    maxs = list(out_verts[0])
    for v in out_verts:
        buf.write(struct.pack("<fff", *v))
        for j in range(3):
            mins[j] = min(mins[j], v[j])
            maxs[j] = max(maxs[j], v[j])
    pos_size = buf.tell() - pos_off

    # Normals
    nrm_off = buf.tell()
    for n in out_normals:
        buf.write(struct.pack("<fff", *n))
    nrm_size = buf.tell() - nrm_off

    # UV0
    uv0_off = buf.tell()
    for u in out_uvs:
        buf.write(struct.pack("<ff", *u))
    uv0_size = buf.tell() - uv0_off

    # UV1
    uv1_off = buf.tell()
    has_uv1 = bool(out_uvs2)
    if has_uv1:
        for u in out_uvs2:
            buf.write(struct.pack("<ff", *u))
    uv1_size = buf.tell() - uv1_off

    bin_data = buf.getvalue()

    bvs = [
        {"buffer": 0, "byteOffset": idx_off, "byteLength": idx_size},
        {"buffer": 0, "byteOffset": pos_off, "byteLength": pos_size},
        {"buffer": 0, "byteOffset": nrm_off, "byteLength": nrm_size},
        {"buffer": 0, "byteOffset": uv0_off, "byteLength": uv0_size},
    ]
    accs = [
        {"bufferView": 0, "componentType": 5125 if use_u32 else 5123, "count": len(out_indices), "type": "SCALAR"},
        {"bufferView": 1, "componentType": 5126, "count": len(out_verts), "type": "VEC3", "min": mins, "max": maxs},
        {"bufferView": 2, "componentType": 5126, "count": len(out_normals), "type": "VEC3"},
        {"bufferView": 3, "componentType": 5126, "count": len(out_uvs), "type": "VEC2"},
    ]
    attrs = {"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3}
    if has_uv1:
        bvs.append({"buffer": 0, "byteOffset": uv1_off, "byteLength": uv1_size})
        accs.append({"bufferView": 4, "componentType": 5126, "count": len(out_uvs2), "type": "VEC2"})
        attrs["TEXCOORD_1"] = 4

    gltf = {
        "asset": {"generator": "BL2 Gestalt Splitter", "version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": mesh_name, "mesh": 0}],
        "meshes": [{"primitives": [{"attributes": attrs, "indices": 0, "material": 0}], "name": mesh_name}],
        "materials": [{"name": "weapon_material", "pbrMetallicRoughness": {
            "baseColorFactor": [0.5, 0.5, 0.5, 1.0], "metallicFactor": 0.3, "roughnessFactor": 0.5
        }}],
        "buffers": [{"uri": "model.bin", "byteLength": len(bin_data)}],
        "bufferViews": bvs,
        "accessors": accs,
    }

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(gltf, f, indent=2)
    with open(os.path.join(os.path.dirname(path), "model.bin"), "wb") as f:
        f.write(bin_data)
    return True


def compute_normals(verts, tri_indices):
    """Compute smooth per-vertex normals."""
    normals = [[0.0, 0.0, 0.0] for _ in range(len(verts))]
    for k in range(0, len(tri_indices), 3):
        i0, i1, i2 = tri_indices[k], tri_indices[k+1], tri_indices[k+2]
        v0, v1, v2 = verts[i0], verts[i1], verts[i2]
        e1 = (v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2])
        e2 = (v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2])
        nx = e1[1]*e2[2] - e1[2]*e2[1]
        ny = e1[2]*e2[0] - e1[0]*e2[2]
        nz = e1[0]*e2[1] - e1[1]*e2[0]
        for vi in [i0, i1, i2]:
            normals[vi][0] += nx
            normals[vi][1] += ny
            normals[vi][2] += nz
    for n in normals:
        ln = math.sqrt(n[0]**2 + n[1]**2 + n[2]**2)
        if ln > 0:
            n[0] /= ln; n[1] /= ln; n[2] /= ln
        else:
            n[1] = 1.0
    return [tuple(n) for n in normals]


# ── Export per-manufacturer models ─────────────────────────

def export_manufacturer_model(mfr, face_set, faces, wedges, verts, extra_uvs, output_dir, weapon_type):
    """Export a GLTF for one manufacturer."""
    used_wedges = set()
    for fi in face_set:
        w0, w1, w2, _ = faces[fi]
        used_wedges.update([w0, w1, w2])

    wlist = sorted(used_wedges)
    wremap = {old: new for new, old in enumerate(wlist)}

    out_v = [verts[wedges[wi][0]] for wi in wlist]
    out_uv = [(wedges[wi][1], wedges[wi][2]) for wi in wlist]
    out_uv2 = []
    if extra_uvs:
        out_uv2 = [extra_uvs[wi] if wi < len(extra_uvs) else (0,0) for wi in wlist]

    out_idx = []
    for fi in face_set:
        w0, w1, w2, _ = faces[fi]
        out_idx.extend([wremap[w0], wremap[w1], wremap[w2]])

    out_nrm = compute_normals(out_v, out_idx)

    out_dir = os.path.join(output_dir, weapon_type, mfr)
    out_path = os.path.join(out_dir, "model.gltf")
    name = f"{weapon_type}_{mfr}"
    ok = write_gltf(out_path, out_v, out_nrm, out_uv, out_uv2 or None, out_idx, name)
    if ok:
        print(f"  {mfr:12s}: {len(face_set):5d} faces, {len(out_v):5d} verts -> {out_path}")
    return ok


def process_weapon(weapon_type, psk_path, output_dir):
    print(f"\n{'='*60}")
    print(f"Processing {weapon_type}")
    print(f"{'='*60}")

    verts, wedges, faces, bone_names, bw, extra_uvs = read_psk(psk_path)
    print(f"  {len(verts)} verts, {len(faces)} faces, {len(bone_names)} bones")

    components = find_components(faces, wedges)
    print(f"  {len(components)} connected components")

    comp_info, direct, shared = assign_components(
        weapon_type, components, faces, wedges, verts, bone_names, bw
    )

    # Build per-manufacturer face sets
    mfrs = WEAPON_MANUFACTURERS.get(weapon_type, MANUFACTURERS)
    mfr_faces = {m: set() for m in MANUFACTURERS}

    for ci, info in enumerate(comp_info):
        face_set = set(info["faces"])
        if ci in direct:
            label = direct[ci]
            if label == "_moonclip":
                for m in ("Tediore", "Torgue"):
                    if m in mfr_faces: mfr_faces[m].update(face_set)
            elif label == "_alien":
                for m in MANUFACTURERS:
                    mfr_faces[m].update(face_set)
            elif label in mfr_faces:
                mfr_faces[label].update(face_set)
        elif ci in shared:
            label = shared[ci]
            if label == "_all":
                for m in MANUFACTURERS:
                    mfr_faces[m].update(face_set)
            elif label in mfr_faces:
                mfr_faces[label].update(face_set)

    # Print distribution
    print("  Faces per manufacturer:")
    for m in MANUFACTURERS:
        cnt = len(mfr_faces[m])
        marker = "*" if m in mfrs else " "
        print(f"    {marker}{m:12s}: {cnt:5d}")

    # Export
    for m in MANUFACTURERS:
        if not mfr_faces[m]:
            continue
        export_manufacturer_model(m, sorted(mfr_faces[m]), faces, wedges, verts, extra_uvs, output_dir, weapon_type)


# ── Main ───────────────────────────────────────────────────

WEAPON_TYPES = {
    "Pistol": "GestaltDef_Pistol_GestaltSkeletalMesh",
    "Assault_Rifle": "GestaltDef_AssaultRifle_GestaltSkeletalMesh",
    "SMG": "GestaltDef_SMG_GestaltSkeletalMesh",
    "Shotgun": "GestaltDef_Shotgun_GestaltSkeletalMesh",
    "Sniper_Rifle": "GestaltDef_SniperRifle_GestaltSkeletalMesh",
    "Rocket_Launcher": "GestaltDef_Launcher_GestaltSkeletalMesh",
}

def main():
    import os
    from pathlib import Path
    # Defaults assume a Windows umodel extract under Temp; override via env vars.
    psk_dir = os.environ.get(
        "BL2_PSK_DIR",
        str(Path.home() / "AppData" / "Local" / "Temp" / "psk_export" / "Startup" / "SkeletalMesh3"),
    )
    output_dir = os.environ.get(
        "BL2_WEAPON_MODELS_OUT",
        str(Path(__file__).resolve().parent.parent / "static" / "models" / "weapons"),
    )

    for wtype, mesh_name in WEAPON_TYPES.items():
        psk_path = os.path.join(psk_dir, mesh_name + ".psk")
        if not os.path.exists(psk_path):
            print(f"SKIP {wtype}: not found")
            continue
        process_weapon(wtype, psk_path, output_dir)

    print("\nDone!")

if __name__ == "__main__":
    main()
