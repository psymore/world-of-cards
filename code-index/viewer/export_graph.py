"""
Export code_index.db into graph.json consumed by viewer/index.html.

Usage:
    python code-index\\viewer\\export_graph.py
    python code-index\\viewer\\export_graph.py --db code-index\\code_index.db --out code-index\\viewer\\graph.json
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def export(db_path: Path, out_path: Path) -> None:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    modules: dict[str, dict] = {}
    for row in cur.execute(
        "SELECT module, COUNT(*) AS file_count FROM files GROUP BY module"
    ):
        modules[row["module"]] = {
            "id": row["module"],
            "type": "module",
            "fileCount": row["file_count"],
            "symbolCount": 0,
        }

    for row in cur.execute(
        "SELECT module, COUNT(*) AS c FROM symbols GROUP BY module"
    ):
        if row["module"] in modules:
            modules[row["module"]]["symbolCount"] = row["c"]

    file_rows = cur.execute("SELECT id, path, module FROM files").fetchall()
    symbol_counts: dict[int, int] = {}
    for row in cur.execute(
        "SELECT file_id, COUNT(*) AS c FROM symbols GROUP BY file_id"
    ):
        symbol_counts[row["file_id"]] = row["c"]

    files = []
    for row in file_rows:
        rel = row["path"].replace("\\", "/")
        files.append(
            {
                "id": f"f{row['id']}",
                "type": "file",
                "module": row["module"],
                "path": rel,
                "name": rel.rsplit("/", 1)[-1],
                "symbolCount": symbol_counts.get(row["id"], 0),
            }
        )

    file_in_degree: dict[int, int] = {}
    file_out_degree: dict[int, int] = {}
    file_edges = []
    for row in cur.execute("SELECT from_file_id, to_file_id FROM file_edges"):
        file_edges.append(
            {"source": f"f{row['from_file_id']}", "target": f"f{row['to_file_id']}"}
        )
        file_out_degree[row["from_file_id"]] = (
            file_out_degree.get(row["from_file_id"], 0) + 1
        )
        file_in_degree[row["to_file_id"]] = (
            file_in_degree.get(row["to_file_id"], 0) + 1
        )

    for f in files:
        raw_id = int(f["id"][1:])
        f["inDegree"] = file_in_degree.get(raw_id, 0)
        f["outDegree"] = file_out_degree.get(raw_id, 0)

    module_edges = [
        {
            "source": row["from_module"],
            "target": row["to_module"],
            "weight": row["edge_count"],
        }
        for row in cur.execute(
            "SELECT from_module, to_module, edge_count FROM module_edges"
        )
    ]

    symbols = [
        {
            "name": row["name"],
            "kind": row["kind"],
            "scope": row["scope"],
            "namespace": row["namespace"],
            "access": row["access"],
            "module": row["module"],
            "fileId": f"f{row['file_id']}",
            "line": row["line"],
        }
        for row in cur.execute(
            "SELECT name, kind, scope, namespace, access, module, file_id, line FROM symbols"
        )
    ]

    payload = {
        "modules": list(modules.values()),
        "files": files,
        "fileEdges": file_edges,
        "moduleEdges": module_edges,
        "symbols": symbols,
        "stats": {
            "moduleCount": len(modules),
            "fileCount": len(files),
            "symbolCount": len(symbols),
            "fileEdgeCount": len(file_edges),
            "moduleEdgeCount": len(module_edges),
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload), encoding="utf-8")
    print(
        f"Wrote {out_path} "
        f"({payload['stats']['moduleCount']} modules, "
        f"{payload['stats']['fileCount']} files, "
        f"{payload['stats']['symbolCount']} symbols, "
        f"{payload['stats']['fileEdgeCount']} file edges)"
    )

    con.close()


def main() -> None:
    here = Path(__file__).resolve().parent
    default_db = here.parent / "code_index.db"
    default_out = here / "graph.json"

    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=default_db)
    parser.add_argument("--out", type=Path, default=default_out)
    args = parser.parse_args()

    export(args.db, args.out)


if __name__ == "__main__":
    main()
