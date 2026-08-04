#!/usr/bin/env python3
# discover_projects.py
# Scans solution for .csproj files and writes discovered module metadata to
# module_map.json. This script only produces data — it never modifies
# another source file.

import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MODULE_MAP_PATH = SCRIPT_DIR / "module_map.json"

DEFAULT_KEY = "api"
UNMATCHED_POLICY = "default"


def find_projects(repo_root):
    projects = []
    abs_root = os.path.realpath(repo_root)

    for dirpath, dirnames, filenames in os.walk(abs_root):
        dirnames[:] = [d for d in dirnames if d not in ("obj", "bin")]
        for filename in filenames:
            if filename.endswith(".csproj"):
                rel_path = os.path.relpath(dirpath, abs_root).replace("\\", "/")
                name = os.path.splitext(filename)[0]
                projects.append({
                    "name": name,
                    "rel_path": rel_path,
                    "full_path": dirpath,
                })

    return sorted(projects, key=lambda p: p["rel_path"])


def print_table(projects):
    name_w = max(len(p["name"]) for p in projects)
    path_w = max(len(p["rel_path"]) for p in projects)
    header = f"{'Name':<{name_w}}  {'RelPath':<{path_w}}"
    print(header)
    print("-" * len(header))
    for p in projects:
        print(f"{p['name']:<{name_w}}  {p['rel_path']:<{path_w}}")


def make_key(name):
    return re.sub(r"[._]", "", name.lower())


def build_module_map(projects, default_key=DEFAULT_KEY, unmatched_policy=UNMATCHED_POLICY):
    modules = []
    for p in projects:
        rel = p["rel_path"]
        if not rel:
            continue
        modules.append({
            "key": make_key(p["name"]),
            "pathPrefix": rel.lower(),
            "description": f'{p["name"]} — ',
        })
    return {
        "modules": modules,
        "unmatchedPolicy": unmatched_policy,
        "defaultKey": default_key,
    }


def write_module_map(projects, output_path=MODULE_MAP_PATH):
    module_map = build_module_map(projects)
    output_path.write_text(
        json.dumps(module_map, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[discover] Wrote {output_path}")
    return module_map


def main():
    repo_root = sys.argv[1] if len(sys.argv) > 1 else "."
    projects = find_projects(repo_root)

    print(f"Found {len(projects)} projects:")
    if projects:
        print_table(projects)
    else:
        print("(none)")

    write_module_map(projects)

    print("\n[discover] Done")


if __name__ == "__main__":
    main()
