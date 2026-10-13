#!/usr/bin/env python3
"""
compact-glb.py — keep only the named animations in a .glb and drop every
accessor / bufferView the remaining scene no longer references.

Used to vendor the CC0 KayKit Adventurers characters (76 clips each, ~3.6 MB)
down to the clips the game actually plays.

Usage:
  python3 tools/compact-glb.py IN.glb OUT.glb Idle Walking_A Running_A ...
"""
import json
import struct
import sys


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"{path}: not a glTF 2.0 binary")
    offset = 12
    gltf, binary = None, b""
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8: offset + 8 + chunk_len]
        if chunk_type == 0x4E4F534A:  # JSON
            gltf = json.loads(chunk)
        elif chunk_type == 0x004E4942:  # BIN
            binary = chunk
        offset += 8 + chunk_len
    return gltf, binary


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(binary), 0x004E4942))
        f.write(binary)


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    src, dst, keep = sys.argv[1], sys.argv[2], set(sys.argv[3:])
    gltf, binary = read_glb(src)

    anims = [a for a in gltf.get("animations", []) if a.get("name") in keep]
    missing = keep - {a["name"] for a in anims}
    if missing:
        print(f"warning: {src} lacks clips: {sorted(missing)}", file=sys.stderr)
    gltf["animations"] = anims

    used_acc = set()
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            used_acc.update(prim["attributes"].values())
            if "indices" in prim:
                used_acc.add(prim["indices"])
            for target in prim.get("targets", []):
                used_acc.update(target.values())
    for skin in gltf.get("skins", []):
        if "inverseBindMatrices" in skin:
            used_acc.add(skin["inverseBindMatrices"])
    for anim in anims:
        for sampler in anim["samplers"]:
            used_acc.add(sampler["input"])
            used_acc.add(sampler["output"])

    acc_map = {}
    new_accessors = []
    for i, acc in enumerate(gltf.get("accessors", [])):
        if i in used_acc:
            acc_map[i] = len(new_accessors)
            new_accessors.append(acc)

    used_bv = {a["bufferView"] for a in new_accessors if "bufferView" in a}
    used_bv |= {img["bufferView"] for img in gltf.get("images", []) if "bufferView" in img}

    bv_map = {}
    new_views = []
    out = bytearray()
    for i, view in enumerate(gltf.get("bufferViews", [])):
        if i not in used_bv:
            continue
        start = view.get("byteOffset", 0)
        chunk = binary[start: start + view["byteLength"]]
        out += b"\0" * ((4 - len(out) % 4) % 4)
        nv = dict(view)
        nv["byteOffset"] = len(out)
        nv["buffer"] = 0
        out += chunk
        bv_map[i] = len(new_views)
        new_views.append(nv)

    for acc in new_accessors:
        if "bufferView" in acc:
            acc["bufferView"] = bv_map[acc["bufferView"]]
    for img in gltf.get("images", []):
        if "bufferView" in img:
            img["bufferView"] = bv_map[img["bufferView"]]
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            prim["attributes"] = {k: acc_map[v] for k, v in prim["attributes"].items()}
            if "indices" in prim:
                prim["indices"] = acc_map[prim["indices"]]
            if "targets" in prim:
                prim["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in prim["targets"]]
    for skin in gltf.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = acc_map[skin["inverseBindMatrices"]]
    for anim in anims:
        for sampler in anim["samplers"]:
            sampler["input"] = acc_map[sampler["input"]]
            sampler["output"] = acc_map[sampler["output"]]

    gltf["accessors"] = new_accessors
    gltf["bufferViews"] = new_views
    gltf["buffers"] = [{"byteLength": len(out)}]
    write_glb(dst, gltf, bytes(out))
    print(f"{dst}: {len(binary)} -> {len(out)} bytes, {len(anims)} clips")


if __name__ == "__main__":
    main()
