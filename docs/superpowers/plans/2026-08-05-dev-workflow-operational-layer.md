# Dev Workflow Operational Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the six commands and the shared infrastructure defined in `docs/superpowers/specs/2026-08-05-dev-workflow-operational-layer-design.md` — `repo status`, `repo impacted`, `repo prepare`, `repo commit`, `repo publish`, and the Code Index freshness guard — as a small Python CLI layered on top of the existing Code Index (`code-index/code_index.db`, `code-index/module_map.json`) and git.

**Architecture:** A new `ops/` package at repo root holds four shared modules (git state, module resolution, staleness, Code Index queries) and one module per command, each exposing a plain function that both a thin CLI dispatcher (`ops/repo.py`) and other command modules can import directly — no subprocess-to-subprocess calls between commands, no reimplementation of a fact another module already computes. The Code Index freshness guard reuses the same staleness module via a tiny CLI shim that `code-index/update_codeindex.ps1` calls before doing a full rebuild. The consolidated WKA Validator (spec §4) is a separate Phase 2 deliverable and is intentionally out of scope for this plan — see "Out of scope" below.

**Tech Stack:** Python 3 standard library only (`subprocess`, `sqlite3`, `argparse`, `dataclasses`, `pathlib`) — no new dependency, matching the existing `code-index/*.py` scripts' own style. Tests use `unittest` (already in the standard library; `pytest` is not installed in this environment and adding it would be a new dependency this plan doesn't need).

## Global Constraints

- No new dependency, Python or Node — everything is stdlib plus the repo's existing `git`/`npx tsc`/`npx jest` toolchain (spec §0, constraint 2).
- No command ever calls `git commit`, `git push`, or creates a PR — `repo commit`/`repo publish` only ever return a draft (spec §0 constraint 4; §2.4/§2.5 Boundaries).
- Every command that reads `file_edges`/`module_edges`/`symbols` surfaces the Code Index's current staleness label; none of them triggers a rebuild (spec §1 "Staleness consumption rule").
- The module boundary is exactly `code-index/module_map.json`'s four keys (`mobile`, `playground`, `engine`, `ui`) — no finer-grained boundary is introduced anywhere in this plan (spec §1 "Module boundary").
- The documentation-drift mapping (`DOC_MAPPING` in Task 5) stays empty — no module→doc path is invented, guessed, or inferred by this code, per spec §2.2/§4's open prerequisite.
- Every shared computation (diff files, module resolution, staleness, Code Index queries) lives in exactly one module and is imported, never re-derived, by every consumer (spec §0 constraints 2–3, Principle 9 "Composability").
- Test discovery command for every task below: `python -m unittest discover -s ops -p "*_test.py" -t .` (run from repo root).

## Out of scope

- The consolidated WKA Validator (spec §4) — a separate plan, once scheduled.
- True incremental (per-file) Code Index extraction — spec §2.6 already descopes this to a memoized skip-if-unchanged guard, which is what Task 11 implements.
- Building the machine-readable domain-ownership manifest — spec §5 keeps this an open, unaddressed prerequisite; `repo impacted`'s `--check-docs` mode (Task 5) reports every module as `mapping_not_available` until that separate decision is made.

---

## Task 1: Git state helpers (`ops/git_utils.py`)

**Files:**
- Create: `ops/__init__.py`
- Create: `ops/git_utils.py`
- Test: `ops/git_utils_test.py`

**Interfaces:**
- Produces: `WorkingTreeStatus(branch: str, modified_count: int, untracked_count: int)` with a `.clean` property; `CommitInfo(sha: str, subject: str)`; `RemoteTrackingInfo(remote_branch: str | None, ahead: int, behind: int)`; functions `get_current_branch(repo_root: Path) -> str`, `get_working_tree_status(repo_root: Path) -> WorkingTreeStatus`, `get_diff_files(repo_root: Path, diff_range: str | None = None) -> list[str]`, `get_commits_since(repo_root: Path, base_branch: str = "master") -> list[CommitInfo]`, `get_remote_tracking_state(repo_root: Path) -> RemoteTrackingInfo`.

- [ ] **Step 1: Create the `ops` package and write the failing tests**

Create `ops/__init__.py` (empty file).

Create `ops/git_utils_test.py`:

```python
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.git_utils import (
    get_current_branch,
    get_diff_files,
    get_working_tree_status,
    get_commits_since,
)


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


def _init_repo(repo: Path) -> None:
    _git(repo, "init", "-q", "-b", "master")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test")


class GetCurrentBranchTest(unittest.TestCase):
    def test_returns_current_branch_name(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")

            self.assertEqual(get_current_branch(repo), "master")


class GetWorkingTreeStatusTest(unittest.TestCase):
    def test_reports_clean_tree(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")

            status = get_working_tree_status(repo)
            self.assertTrue(status.clean)
            self.assertEqual(status.modified_count, 0)
            self.assertEqual(status.untracked_count, 0)

    def test_reports_modified_and_untracked_counts(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")

            (repo / "a.txt").write_text("changed")
            (repo / "b.txt").write_text("new")

            status = get_working_tree_status(repo)
            self.assertFalse(status.clean)
            self.assertEqual(status.modified_count, 1)
            self.assertEqual(status.untracked_count, 1)


class GetDiffFilesTest(unittest.TestCase):
    def test_default_range_includes_working_tree_staged_and_untracked(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")

            (repo / "a.txt").write_text("changed")
            (repo / "b.txt").write_text("new")
            _git(repo, "add", "b.txt")

            files = get_diff_files(repo)
            self.assertEqual(files, ["a.txt", "b.txt"])

    def test_explicit_ref_range(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")
            first_sha = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=repo, capture_output=True, text=True, check=True
            ).stdout.strip()

            (repo / "c.txt").write_text("two")
            _git(repo, "add", "c.txt")
            _git(repo, "commit", "-q", "-m", "second")

            files = get_diff_files(repo, diff_range=f"{first_sha}..HEAD")
            self.assertEqual(files, ["c.txt"])


class GetCommitsSinceTest(unittest.TestCase):
    def test_lists_commits_on_branch_since_base(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _init_repo(repo)
            (repo / "a.txt").write_text("one")
            _git(repo, "add", "a.txt")
            _git(repo, "commit", "-q", "-m", "init")

            _git(repo, "checkout", "-q", "-b", "feature/x")
            (repo / "b.txt").write_text("two")
            _git(repo, "add", "b.txt")
            _git(repo, "commit", "-q", "-m", "feat: add b")

            commits = get_commits_since(repo, base_branch="master")
            self.assertEqual(len(commits), 1)
            self.assertEqual(commits[0].subject, "feat: add b")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.git_utils'`

- [ ] **Step 3: Write `ops/git_utils.py`**

```python
"""Git state helpers shared by every ops command (spec §1 "Shared concepts")
— no command re-implements branch/diff/log parsing itself."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


def _run_git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    )
    return result.stdout


def _nonempty_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


@dataclass
class WorkingTreeStatus:
    branch: str
    modified_count: int
    untracked_count: int

    @property
    def clean(self) -> bool:
        return self.modified_count == 0 and self.untracked_count == 0


def get_current_branch(repo_root: Path) -> str:
    return _run_git(["rev-parse", "--abbrev-ref", "HEAD"], repo_root).strip()


def get_working_tree_status(repo_root: Path) -> WorkingTreeStatus:
    branch = get_current_branch(repo_root)
    porcelain = _run_git(["status", "--porcelain"], repo_root)
    modified = 0
    untracked = 0
    for line in _nonempty_lines(porcelain):
        if line.startswith("??"):
            untracked += 1
        else:
            modified += 1
    return WorkingTreeStatus(branch=branch, modified_count=modified, untracked_count=untracked)


def get_diff_files(repo_root: Path, diff_range: str | None = None) -> list[str]:
    """Changed files as repo-relative POSIX paths.

    Default (diff_range=None): working tree + staged changes against HEAD,
    plus untracked new files — the default stated in spec §2.2's Inputs.
    """
    if diff_range:
        tracked = _run_git(["diff", "--name-only", diff_range], repo_root)
        return sorted(set(_nonempty_lines(tracked)))

    tracked = _run_git(["diff", "--name-only", "HEAD"], repo_root)
    porcelain = _run_git(["status", "--porcelain"], repo_root)
    untracked = [line[3:] for line in _nonempty_lines(porcelain) if line.startswith("??")]
    return sorted(set(_nonempty_lines(tracked)) | set(untracked))


@dataclass
class CommitInfo:
    sha: str
    subject: str


def get_commits_since(repo_root: Path, base_branch: str = "master") -> list[CommitInfo]:
    log = _run_git(["log", f"{base_branch}..HEAD", "--pretty=format:%H%x09%s"], repo_root)
    commits = []
    for line in _nonempty_lines(log):
        sha, _, subject = line.partition("\t")
        commits.append(CommitInfo(sha=sha, subject=subject))
    return commits


@dataclass
class RemoteTrackingInfo:
    remote_branch: str | None
    ahead: int
    behind: int


def get_remote_tracking_state(repo_root: Path) -> RemoteTrackingInfo:
    try:
        remote_branch = _run_git(
            ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo_root
        ).strip()
    except subprocess.CalledProcessError:
        return RemoteTrackingInfo(remote_branch=None, ahead=0, behind=0)

    counts = _run_git(
        ["rev-list", "--left-right", "--count", f"{remote_branch}...HEAD"], repo_root
    ).strip()
    behind_str, ahead_str = counts.replace("\t", " ").split()
    return RemoteTrackingInfo(
        remote_branch=remote_branch, ahead=int(ahead_str), behind=int(behind_str)
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add ops/__init__.py ops/git_utils.py ops/git_utils_test.py
git commit -m "feat(ops): add git state helpers"
```

---

## Task 2: Module resolution (`ops/module_map.py`)

**Files:**
- Create: `ops/module_map.py`
- Test: `ops/module_map_test.py`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ModuleMap(modules: list[dict], unmatched_policy: str, default_key: str | None)`; `load_module_map(path: Path) -> ModuleMap`; `resolve_module(file_path: str, module_map: ModuleMap) -> str | None`.

- [ ] **Step 1: Write the failing tests**

Create `ops/module_map_test.py`:

```python
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.module_map import load_module_map, resolve_module


def _write_module_map(tmp: Path) -> Path:
    path = tmp / "module_map.json"
    path.write_text(
        json.dumps(
            {
                "modules": [
                    {"key": "mobile", "pathPrefix": "apps/mobile"},
                    {"key": "playground", "pathPrefix": "apps/playground"},
                    {"key": "engine", "pathPrefix": "packages/engine"},
                    {"key": "ui", "pathPrefix": "packages/ui"},
                ],
                "unmatchedPolicy": "default",
                "defaultKey": "api",
            }
        )
    )
    return path


class ResolveModuleTest(unittest.TestCase):
    def test_resolves_file_under_module_prefix(self):
        with TemporaryDirectory() as tmp:
            module_map = load_module_map(_write_module_map(Path(tmp)))
            self.assertEqual(resolve_module("apps/mobile/src/App.tsx", module_map), "mobile")
            self.assertEqual(resolve_module("packages/engine/src/index.ts", module_map), "engine")

    def test_falls_back_to_default_key_when_unmatched(self):
        with TemporaryDirectory() as tmp:
            module_map = load_module_map(_write_module_map(Path(tmp)))
            self.assertEqual(resolve_module("README.md", module_map), "api")

    def test_windows_backslash_paths_normalize(self):
        with TemporaryDirectory() as tmp:
            module_map = load_module_map(_write_module_map(Path(tmp)))
            self.assertEqual(resolve_module("apps\\mobile\\src\\App.tsx", module_map), "mobile")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.module_map'`

- [ ] **Step 3: Write `ops/module_map.py`**

```python
"""Loads code-index/module_map.json and resolves a repo-relative file path to
a module key — the single place spec §1's "module boundary" is read from.
Every command that needs a module for a path calls resolve_module here,
never re-parses module_map.json itself (spec §0 constraint 2)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ModuleMap:
    modules: list[dict]
    unmatched_policy: str
    default_key: str | None


def load_module_map(path: Path) -> ModuleMap:
    data = json.loads(path.read_text())
    return ModuleMap(
        modules=data["modules"],
        unmatched_policy=data.get("unmatchedPolicy", "default"),
        default_key=data.get("defaultKey"),
    )


def resolve_module(file_path: str, module_map: ModuleMap) -> str | None:
    """file_path may use either path separator; matching is prefix-based
    against each module's pathPrefix, longest match wins."""
    normalized = file_path.replace("\\", "/")
    best_match: tuple[int, str] | None = None
    for module in module_map.modules:
        prefix = module["pathPrefix"].rstrip("/")
        if normalized == prefix or normalized.startswith(prefix + "/"):
            if best_match is None or len(prefix) > best_match[0]:
                best_match = (len(prefix), module["key"])
    if best_match:
        return best_match[1]
    if module_map.unmatched_policy == "default":
        return module_map.default_key
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/module_map.py ops/module_map_test.py
git commit -m "feat(ops): add module resolution against module_map.json"
```

---

## Task 3: Staleness check (`ops/staleness.py`)

**Files:**
- Create: `ops/staleness.py`
- Test: `ops/staleness_test.py`

**Interfaces:**
- Consumes: `ModuleMap` from Task 2 (`ops.module_map`).
- Produces: `StalenessResult(is_stale: bool, stale_modules: list[str])`; `check_staleness(repo_root: Path, module_map: ModuleMap, db_path: Path) -> StalenessResult`.

- [ ] **Step 1: Write the failing tests**

Create `ops/staleness_test.py`:

```python
import json
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.module_map import load_module_map
from ops.staleness import check_staleness


def _setup(tmp: Path):
    (tmp / "apps" / "mobile").mkdir(parents=True)
    (tmp / "packages" / "engine").mkdir(parents=True)
    module_map_path = tmp / "module_map.json"
    module_map_path.write_text(
        json.dumps(
            {
                "modules": [
                    {"key": "mobile", "pathPrefix": "apps/mobile"},
                    {"key": "engine", "pathPrefix": "packages/engine"},
                ],
                "unmatchedPolicy": "default",
                "defaultKey": "api",
            }
        )
    )
    return load_module_map(module_map_path)


class CheckStalenessTest(unittest.TestCase):
    def test_fresh_when_db_newer_than_all_source_files(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            module_map = _setup(root)
            (root / "apps" / "mobile" / "a.ts").write_text("one")
            time.sleep(0.02)
            db_path = root / "code_index.db"
            db_path.write_text("db")

            result = check_staleness(root, module_map, db_path)
            self.assertFalse(result.is_stale)
            self.assertEqual(result.stale_modules, [])

    def test_stale_when_source_file_newer_than_db(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            module_map = _setup(root)
            db_path = root / "code_index.db"
            db_path.write_text("db")
            time.sleep(0.02)
            (root / "apps" / "mobile" / "a.ts").write_text("changed")

            result = check_staleness(root, module_map, db_path)
            self.assertTrue(result.is_stale)
            self.assertEqual(result.stale_modules, ["mobile"])

    def test_missing_db_is_stale_for_every_module(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            module_map = _setup(root)
            db_path = root / "code_index.db"

            result = check_staleness(root, module_map, db_path)
            self.assertTrue(result.is_stale)
            self.assertEqual(sorted(result.stale_modules), ["engine", "mobile"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.staleness'`

- [ ] **Step 3: Write `ops/staleness.py`**

```python
"""Shared staleness check (spec §1 "Staleness"): the Code Index is stale if
any source file under a module's path prefix has a modification time later
than the Code Index db's own last-build time. Every consumer calls
check_staleness — none re-derives this comparison independently (spec §1
"Staleness consumption rule")."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from ops.module_map import ModuleMap

_IGNORED_DIR_NAMES = {"node_modules", "dist", "build", ".git", "__pycache__"}


@dataclass
class StalenessResult:
    is_stale: bool
    stale_modules: list[str] = field(default_factory=list)


def check_staleness(repo_root: Path, module_map: ModuleMap, db_path: Path) -> StalenessResult:
    if not db_path.exists():
        return StalenessResult(is_stale=True, stale_modules=[m["key"] for m in module_map.modules])

    db_mtime = db_path.stat().st_mtime
    stale_modules = []
    for module in module_map.modules:
        module_dir = repo_root / module["pathPrefix"]
        if not module_dir.exists():
            continue
        if _has_newer_file(module_dir, db_mtime):
            stale_modules.append(module["key"])

    return StalenessResult(is_stale=bool(stale_modules), stale_modules=stale_modules)


def _has_newer_file(module_dir: Path, db_mtime: float) -> bool:
    for dirpath, dirnames, filenames in os.walk(module_dir):
        dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIR_NAMES]
        for filename in filenames:
            if (Path(dirpath) / filename).stat().st_mtime > db_mtime:
                return True
    return False
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (12 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/staleness.py ops/staleness_test.py
git commit -m "feat(ops): add shared Code Index staleness check"
```

---

## Task 4: Code Index queries (`ops/code_index_db.py`)

**Files:**
- Create: `ops/code_index_db.py`
- Test: `ops/code_index_db_test.py`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: `get_dependent_files(db_path: Path, changed_file_paths: list[str]) -> list[str]`; `get_dependent_modules(db_path: Path, changed_module_keys: list[str]) -> list[str]`. (`module_edges`' raw rows — beyond the two aggregate queries above — belong to the future WKA Validator plan, not this one; not built here per YAGNI.)

- [ ] **Step 1: Write the failing tests**

Create `ops/code_index_db_test.py`:

```python
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.code_index_db import get_dependent_files, get_dependent_modules


def _build_db(path: Path) -> None:
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE files (id INTEGER PRIMARY KEY, path TEXT, module TEXT);
        CREATE TABLE file_edges (from_file_id INTEGER, to_file_id INTEGER);
        CREATE TABLE module_edges (from_module TEXT, to_module TEXT, edge_count INTEGER);

        INSERT INTO files VALUES (1, 'apps/mobile/src/App.tsx', 'mobile');
        INSERT INTO files VALUES (2, 'packages/engine/src/index.ts', 'engine');
        INSERT INTO files VALUES (3, 'apps/playground/src/Demo.tsx', 'playground');

        INSERT INTO file_edges VALUES (1, 2);
        INSERT INTO file_edges VALUES (3, 2);

        INSERT INTO module_edges VALUES ('mobile', 'engine', 43);
        INSERT INTO module_edges VALUES ('playground', 'engine', 16);
        """
    )
    con.commit()
    con.close()


class GetDependentFilesTest(unittest.TestCase):
    def test_finds_files_that_import_the_changed_file(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "code_index.db"
            _build_db(db_path)

            dependents = get_dependent_files(db_path, ["packages/engine/src/index.ts"])
            self.assertEqual(
                dependents, ["apps/mobile/src/App.tsx", "apps/playground/src/Demo.tsx"]
            )

    def test_empty_input_returns_empty_list(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "code_index.db"
            _build_db(db_path)
            self.assertEqual(get_dependent_files(db_path, []), [])


class GetDependentModulesTest(unittest.TestCase):
    def test_finds_modules_that_depend_on_the_changed_module(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "code_index.db"
            _build_db(db_path)

            dependents = get_dependent_modules(db_path, ["engine"])
            self.assertEqual(dependents, ["mobile", "playground"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.code_index_db'`

- [ ] **Step 3: Write `ops/code_index_db.py`**

```python
"""Read-only queries against code-index/code_index.db (spec §2.2's data
source). Every query here mirrors the shapes already documented in
code-index/README.md and prototyped in code-index/find_violations.py — no new
schema, no new query capability, just parameterizing the existing join shapes
on a caller-supplied file/module set instead of a hardcoded pair."""
from __future__ import annotations

import sqlite3
from pathlib import Path


def get_dependent_files(db_path: Path, changed_file_paths: list[str]) -> list[str]:
    if not changed_file_paths:
        return []
    con = sqlite3.connect(db_path)
    try:
        placeholders = ",".join("?" for _ in changed_file_paths)
        rows = con.execute(
            f"""
            SELECT DISTINCT f.path FROM file_edges fe
            JOIN files f ON f.id = fe.from_file_id
            JOIN files t ON t.id = fe.to_file_id
            WHERE t.path IN ({placeholders})
            """,
            changed_file_paths,
        ).fetchall()
        return sorted(row[0] for row in rows)
    finally:
        con.close()


def get_dependent_modules(db_path: Path, changed_module_keys: list[str]) -> list[str]:
    if not changed_module_keys:
        return []
    con = sqlite3.connect(db_path)
    try:
        placeholders = ",".join("?" for _ in changed_module_keys)
        rows = con.execute(
            f"SELECT DISTINCT from_module FROM module_edges WHERE to_module IN ({placeholders})",
            changed_module_keys,
        ).fetchall()
        return sorted(row[0] for row in rows)
    finally:
        con.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (15 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/code_index_db.py ops/code_index_db_test.py
git commit -m "feat(ops): add Code Index blast-radius queries"
```

---

## Task 5: `repo impacted` (`ops/repo_impacted.py`)

**Files:**
- Create: `ops/repo_impacted.py`
- Test: `ops/repo_impacted_test.py`

**Interfaces:**
- Consumes: `ops.git_utils.get_diff_files`; `ops.module_map.ModuleMap`, `resolve_module`; `ops.staleness.StalenessResult`, `check_staleness`; `ops.code_index_db.get_dependent_files`, `get_dependent_modules`.
- Produces: `AffectedSet(changed_files, changed_modules, dependent_files, dependent_modules, staleness, doc_drift)`; `DOC_MAPPING: dict[str, str]` (module-level constant, empty); `compute_impacted(repo_root, module_map, db_path, diff_range=None, check_docs=False) -> AffectedSet`. Consumed directly by Tasks 7, 8 (`repo_prepare`, `repo_commit`).

- [ ] **Step 1: Write the failing tests**

Create `ops/repo_impacted_test.py`:

```python
import json
import sqlite3
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.module_map import load_module_map
from ops.repo_impacted import DOC_MAPPING, compute_impacted


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


def _setup_repo(repo: Path) -> None:
    _git(repo, "init", "-q", "-b", "master")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test")
    (repo / "apps" / "mobile").mkdir(parents=True)
    (repo / "packages" / "engine").mkdir(parents=True)
    (repo / "apps" / "mobile" / "App.tsx").write_text("one")
    (repo / "packages" / "engine" / "index.ts").write_text("two")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "init")


def _write_module_map(repo: Path) -> Path:
    path = repo / "module_map.json"
    path.write_text(
        json.dumps(
            {
                "modules": [
                    {"key": "mobile", "pathPrefix": "apps/mobile"},
                    {"key": "engine", "pathPrefix": "packages/engine"},
                ],
                "unmatchedPolicy": "default",
                "defaultKey": "api",
            }
        )
    )
    return path


def _build_db(repo: Path) -> Path:
    db_path = repo / "code_index.db"
    con = sqlite3.connect(db_path)
    con.executescript(
        """
        CREATE TABLE files (id INTEGER PRIMARY KEY, path TEXT, module TEXT);
        CREATE TABLE file_edges (from_file_id INTEGER, to_file_id INTEGER);
        CREATE TABLE module_edges (from_module TEXT, to_module TEXT, edge_count INTEGER);
        INSERT INTO files VALUES (1, 'apps/mobile/App.tsx', 'mobile');
        INSERT INTO files VALUES (2, 'packages/engine/index.ts', 'engine');
        INSERT INTO file_edges VALUES (1, 2);
        INSERT INTO module_edges VALUES ('mobile', 'engine', 1);
        """
    )
    con.commit()
    con.close()
    return db_path


class ComputeImpactedTest(unittest.TestCase):
    def test_reports_changed_and_dependent_files(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _setup_repo(repo)
            module_map = load_module_map(_write_module_map(repo))
            db_path = _build_db(repo)

            (repo / "packages" / "engine" / "index.ts").write_text("changed")

            result = compute_impacted(repo, module_map, db_path)

            self.assertEqual(result.changed_files, ["packages/engine/index.ts"])
            self.assertEqual(result.changed_modules, ["engine"])
            self.assertEqual(result.dependent_files, ["apps/mobile/App.tsx"])
            self.assertEqual(result.dependent_modules, ["mobile"])

    def test_check_docs_reports_mapping_not_available_when_mapping_is_empty(self):
        self.assertEqual(DOC_MAPPING, {})
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _setup_repo(repo)
            module_map = load_module_map(_write_module_map(repo))
            db_path = _build_db(repo)

            (repo / "packages" / "engine" / "index.ts").write_text("changed")

            result = compute_impacted(repo, module_map, db_path, check_docs=True)

            self.assertEqual(result.doc_drift, {"engine": "mapping_not_available"})

    def test_staleness_is_attached_to_the_result(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _setup_repo(repo)
            module_map = load_module_map(_write_module_map(repo))
            db_path = _build_db(repo)

            result = compute_impacted(repo, module_map, db_path)
            self.assertFalse(result.staleness.is_stale)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo_impacted'`

- [ ] **Step 3: Write `ops/repo_impacted.py`**

```python
"""repo impacted (spec §2.2): diff -> affected set, plus a documentation-drift
mode that only ever reports where an authoritative module->doc mapping
already exists. Per spec §4's open prerequisite, no such mapping exists today
for any module — DOC_MAPPING stays empty until a separate WKA/documentation
decision creates one; this module must never guess a substitute."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ops import code_index_db, git_utils
from ops.module_map import ModuleMap, resolve_module
from ops.staleness import StalenessResult, check_staleness

# Authoritative module-key -> docs/domains/<domain>/ mapping. Empty today per
# spec §2.2/§4's open prerequisite — populate only if/when that separate
# WKA/documentation decision creates the manifest. Never infer an entry here.
DOC_MAPPING: dict[str, str] = {}


@dataclass
class AffectedSet:
    changed_files: list[str]
    changed_modules: list[str]
    dependent_files: list[str]
    dependent_modules: list[str]
    staleness: StalenessResult
    doc_drift: dict[str, str] | None = None


def compute_impacted(
    repo_root: Path,
    module_map: ModuleMap,
    db_path: Path,
    diff_range: str | None = None,
    check_docs: bool = False,
) -> AffectedSet:
    changed_files = git_utils.get_diff_files(repo_root, diff_range)
    changed_modules = sorted({m for f in changed_files if (m := resolve_module(f, module_map))})
    dependent_files = code_index_db.get_dependent_files(db_path, changed_files)
    dependent_modules = code_index_db.get_dependent_modules(db_path, changed_modules)
    staleness = check_staleness(repo_root, module_map, db_path)

    doc_drift = _compute_doc_drift(changed_modules, changed_files) if check_docs else None

    return AffectedSet(
        changed_files=changed_files,
        changed_modules=changed_modules,
        dependent_files=dependent_files,
        dependent_modules=dependent_modules,
        staleness=staleness,
        doc_drift=doc_drift,
    )


def _compute_doc_drift(changed_modules: list[str], changed_files: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for module in changed_modules:
        doc_path = DOC_MAPPING.get(module)
        if doc_path is None:
            result[module] = "mapping_not_available"
            continue
        touched = any(f.replace("\\", "/").startswith(doc_path) for f in changed_files)
        result[module] = "touched" if touched else "not_touched"
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (18 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/repo_impacted.py ops/repo_impacted_test.py
git commit -m "feat(ops): add repo impacted command"
```

---

## Task 6: `repo status` (`ops/repo_status.py`)

**Files:**
- Create: `ops/repo_status.py`
- Test: `ops/repo_status_test.py`

**Interfaces:**
- Consumes: `ops.git_utils.get_working_tree_status`; `ops.staleness.check_staleness`; `ops.module_map.ModuleMap`.
- Produces: `StatusReport(branch, working_tree_clean, modified_count, untracked_count, staleness, roadmap_pointer, known_issues_count)`; `compute_status(repo_root, module_map, db_path, roadmap_path, known_issues_path) -> StatusReport`.

- [ ] **Step 1: Write the failing test**

Create `ops/repo_status_test.py`:

```python
import json
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.module_map import load_module_map
from ops.repo_status import compute_status


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


class ComputeStatusTest(unittest.TestCase):
    def test_reports_clean_tree_fresh_index_and_doc_pointers(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _git(repo, "init", "-q", "-b", "master")
            _git(repo, "config", "user.email", "test@example.com")
            _git(repo, "config", "user.name", "Test")
            (repo / "a.txt").write_text("one")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "init")

            module_map_path = repo / "module_map.json"
            module_map_path.write_text(
                json.dumps({"modules": [], "unmatchedPolicy": "default", "defaultKey": "api"})
            )
            module_map = load_module_map(module_map_path)

            db_path = repo / "code_index.db"
            db_path.write_text("db")

            roadmap_path = repo / "roadmap.md"
            roadmap_path.write_text("# Roadmap\n\n## Current build status\n\nStuff.\n")

            known_issues_path = repo / "known-issues.md"
            known_issues_path.write_text("# Known Issues\n\n- one\n- two\n- three\n")

            report = compute_status(repo, module_map, db_path, roadmap_path, known_issues_path)

            self.assertEqual(report.branch, "master")
            self.assertTrue(report.working_tree_clean)
            self.assertFalse(report.staleness.is_stale)
            self.assertEqual(report.roadmap_pointer, "## Current build status")
            self.assertEqual(report.known_issues_count, 3)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo_status'`

- [ ] **Step 3: Write `ops/repo_status.py`**

```python
"""repo status (spec §2.1): one aggregated, read-only report — branch,
working-tree cleanliness, Code Index staleness, and pointer-only
roadmap/known-issues counts. Never re-derives roadmap/known-issues substance
(spec §2.1 Boundaries / Principle 8 "Progressive disclosure")."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from ops import git_utils
from ops.module_map import ModuleMap
from ops.staleness import StalenessResult, check_staleness


@dataclass
class StatusReport:
    branch: str
    working_tree_clean: bool
    modified_count: int
    untracked_count: int
    staleness: StalenessResult
    roadmap_pointer: str
    known_issues_count: int


def compute_status(
    repo_root: Path,
    module_map: ModuleMap,
    db_path: Path,
    roadmap_path: Path,
    known_issues_path: Path,
) -> StatusReport:
    tree_status = git_utils.get_working_tree_status(repo_root)
    staleness = check_staleness(repo_root, module_map, db_path)

    return StatusReport(
        branch=tree_status.branch,
        working_tree_clean=tree_status.clean,
        modified_count=tree_status.modified_count,
        untracked_count=tree_status.untracked_count,
        staleness=staleness,
        roadmap_pointer=_first_heading_after(roadmap_path, "## Current build status"),
        known_issues_count=_count_bullets(known_issues_path),
    )


def _first_heading_after(path: Path, section_heading: str) -> str:
    """Returns the heading itself as the pointer — never the body text under
    it (spec §2.1: "never re-derives roadmap/known-issues content")."""
    if not path.exists():
        return "(roadmap not found)"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() == section_heading:
            return section_heading
    return "(section not found)"


def _count_bullets(path: Path) -> int:
    if not path.exists():
        return 0
    return len(re.findall(r"^- ", path.read_text(encoding="utf-8"), flags=re.MULTILINE))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (19 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/repo_status.py ops/repo_status_test.py
git commit -m "feat(ops): add repo status command"
```

---

## Task 7: `repo prepare` (`ops/repo_prepare.py`)

**Files:**
- Create: `ops/repo_prepare.py`
- Test: `ops/repo_prepare_test.py`

**Interfaces:**
- Consumes: `ops.repo_impacted.compute_impacted` (Task 5, called directly — not reimplemented, per Principle 9); `ops.module_map.ModuleMap`.
- Produces: `ModuleVerification(module, typecheck_passed, typecheck_output, tests_ran, tests_passed, tests_output, testing_policy_reminder)`; `PrepareReport(results: list[ModuleVerification])`; `run_prepare(repo_root, module_map, db_path) -> PrepareReport`. Consumed directly by Task 8 (`repo_commit`).

- [ ] **Step 1: Write the failing tests**

Create `ops/repo_prepare_test.py`:

```python
import json
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from ops.module_map import load_module_map
from ops.repo_prepare import ENGINE_TESTING_POLICY_REMINDER, _engine_reminder, _module_dir, run_prepare


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


class ModuleDirTest(unittest.TestCase):
    def test_finds_path_prefix_for_known_key(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "module_map.json"
            path.write_text(
                json.dumps(
                    {
                        "modules": [{"key": "engine", "pathPrefix": "packages/engine"}],
                        "unmatchedPolicy": "default",
                        "defaultKey": "api",
                    }
                )
            )
            module_map = load_module_map(path)
            self.assertEqual(_module_dir("engine", module_map), "packages/engine")

    def test_raises_for_unknown_key(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "module_map.json"
            path.write_text(json.dumps({"modules": [], "unmatchedPolicy": "default", "defaultKey": "api"}))
            module_map = load_module_map(path)
            with self.assertRaises(ValueError):
                _module_dir("nonexistent", module_map)


class EngineReminderTest(unittest.TestCase):
    def test_no_reminder_for_non_engine_module(self):
        self.assertIsNone(_engine_reminder("mobile", ["apps/mobile/App.tsx"]))

    def test_reminder_when_engine_changed_without_test_change(self):
        reminder = _engine_reminder("engine", ["packages/engine/src/games/pisti/rules.ts"])
        self.assertEqual(reminder, ENGINE_TESTING_POLICY_REMINDER)

    def test_no_reminder_when_a_test_file_also_changed(self):
        reminder = _engine_reminder(
            "engine",
            [
                "packages/engine/src/games/pisti/rules.ts",
                "packages/engine/src/games/pisti/rules.test.ts",
            ],
        )
        self.assertIsNone(reminder)


class RunPrepareTest(unittest.TestCase):
    def test_orchestrates_typecheck_and_tests_per_affected_module(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _git(repo, "init", "-q", "-b", "master")
            _git(repo, "config", "user.email", "test@example.com")
            _git(repo, "config", "user.name", "Test")
            (repo / "packages" / "engine").mkdir(parents=True)
            (repo / "packages" / "engine" / "index.ts").write_text("one")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "init")
            (repo / "packages" / "engine" / "index.ts").write_text("changed")

            module_map_path = repo / "module_map.json"
            module_map_path.write_text(
                json.dumps(
                    {
                        "modules": [{"key": "engine", "pathPrefix": "packages/engine"}],
                        "unmatchedPolicy": "default",
                        "defaultKey": "api",
                    }
                )
            )
            module_map = load_module_map(module_map_path)
            db_path = repo / "code_index.db"
            db_path.write_text("db")

            with patch("ops.repo_prepare._run_typecheck", return_value=(True, "no errors")), patch(
                "ops.repo_prepare._run_tests", return_value=(True, True, "1 passed")
            ):
                report = run_prepare(repo, module_map, db_path)

            self.assertEqual(len(report.results), 1)
            result = report.results[0]
            self.assertEqual(result.module, "engine")
            self.assertTrue(result.typecheck_passed)
            self.assertTrue(result.tests_passed)
            self.assertEqual(result.testing_policy_reminder, ENGINE_TESTING_POLICY_REMINDER)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo_prepare'`

- [ ] **Step 3: Write `ops/repo_prepare.py`**

```python
"""repo prepare (spec §2.3): narrowest applicable verification for repo
impacted's affected set. Calls compute_impacted directly (Principle 9:
composability through the upstream command's own function, never a
reimplementation) and inherits its staleness label rather than re-checking
(spec §1 "Staleness consumption rule")."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from ops.module_map import ModuleMap
from ops.repo_impacted import compute_impacted

# module key -> jest displayName, for modules with a jest project today (root
# jest.config.js's `projects` list). A module absent here has no test project
# to run — repo prepare skips the test step for it (spec §2.3 Inputs: "does
# not assume any of it is already wired as a runnable script").
JEST_PROJECTS = {"engine": "engine", "ui": "ui", "mobile": "mobile"}

ENGINE_TESTING_POLICY_REMINDER = (
    "engineering-principles.md #4: the engine stays test-covered by default — "
    "this diff touches packages/engine without a corresponding test change."
)


@dataclass
class ModuleVerification:
    module: str
    typecheck_passed: bool
    typecheck_output: str
    tests_ran: bool
    tests_passed: bool
    tests_output: str
    testing_policy_reminder: str | None = None


@dataclass
class PrepareReport:
    results: list[ModuleVerification]


def run_prepare(repo_root: Path, module_map: ModuleMap, db_path: Path) -> PrepareReport:
    affected = compute_impacted(repo_root, module_map, db_path)
    results = []
    for module_key in affected.changed_modules:
        module_dir = _module_dir(module_key, module_map)
        typecheck_passed, typecheck_output = _run_typecheck(repo_root, module_dir)
        tests_ran, tests_passed, tests_output = _run_tests(repo_root, module_key)
        results.append(
            ModuleVerification(
                module=module_key,
                typecheck_passed=typecheck_passed,
                typecheck_output=typecheck_output,
                tests_ran=tests_ran,
                tests_passed=tests_passed,
                tests_output=tests_output,
                testing_policy_reminder=_engine_reminder(module_key, affected.changed_files),
            )
        )
    return PrepareReport(results=results)


def _module_dir(module_key: str, module_map: ModuleMap) -> str:
    for module in module_map.modules:
        if module["key"] == module_key:
            return module["pathPrefix"]
    raise ValueError(f"Unknown module key: {module_key}")


def _run_typecheck(repo_root: Path, module_dir: str) -> tuple[bool, str]:
    tsconfig = repo_root / module_dir / "tsconfig.json"
    result = subprocess.run(
        ["npx", "tsc", "--noEmit", "-p", str(tsconfig)], cwd=repo_root, capture_output=True, text=True
    )
    return result.returncode == 0, result.stdout + result.stderr


def _run_tests(repo_root: Path, module_key: str) -> tuple[bool, bool, str]:
    project = JEST_PROJECTS.get(module_key)
    if project is None:
        return False, True, "(no jest project for this module)"
    result = subprocess.run(
        ["npx", "jest", "--selectProjects", project], cwd=repo_root, capture_output=True, text=True
    )
    return True, result.returncode == 0, result.stdout + result.stderr


def _engine_reminder(module_key: str, changed_files: list[str]) -> str | None:
    if module_key != "engine":
        return None
    touched_test = any(f.endswith(".test.ts") for f in changed_files if "packages/engine" in f)
    return None if touched_test else ENGINE_TESTING_POLICY_REMINDER
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (25 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/repo_prepare.py ops/repo_prepare_test.py
git commit -m "feat(ops): add repo prepare command"
```

---

## Task 8: `repo commit` (`ops/repo_commit.py`)

**Files:**
- Create: `ops/repo_commit.py`
- Test: `ops/repo_commit_test.py`

**Interfaces:**
- Consumes: `ops.repo_impacted.compute_impacted` (Task 5); `ops.module_map.ModuleMap`.
- Produces: `CommitDraft(staged_files: list[str], message: str)`; `draft_commit(repo_root, module_map, db_path) -> CommitDraft`. Never calls `git commit` (spec §2.4 Boundaries — verified explicitly in the test below).

- [ ] **Step 1: Write the failing test**

Create `ops/repo_commit_test.py`:

```python
import json
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.module_map import load_module_map
from ops.repo_commit import draft_commit


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True)
    return result.stdout


class DraftCommitTest(unittest.TestCase):
    def test_stages_changed_files_drafts_a_message_and_never_commits(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _git(repo, "init", "-q", "-b", "master")
            _git(repo, "config", "user.email", "test@example.com")
            _git(repo, "config", "user.name", "Test")
            (repo / "packages" / "engine").mkdir(parents=True)
            (repo / "packages" / "engine" / "index.ts").write_text("one")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "init")
            (repo / "packages" / "engine" / "index.ts").write_text("changed")

            module_map_path = repo / "module_map.json"
            module_map_path.write_text(
                json.dumps(
                    {
                        "modules": [{"key": "engine", "pathPrefix": "packages/engine"}],
                        "unmatchedPolicy": "default",
                        "defaultKey": "api",
                    }
                )
            )
            module_map = load_module_map(module_map_path)
            db_path = repo / "code_index.db"
            db_path.write_text("db")

            draft = draft_commit(repo, module_map, db_path)

            self.assertEqual(draft.staged_files, ["packages/engine/index.ts"])
            self.assertEqual(draft.message, "engine: update 1 file")

            staged = _git(repo, "diff", "--cached", "--name-only")
            self.assertIn("packages/engine/index.ts", staged)

            log_head = _git(repo, "log", "-1", "--pretty=%s")
            self.assertEqual(log_head.strip(), "init")  # draft_commit never actually commits


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo_commit'`

- [ ] **Step 3: Write `ops/repo_commit.py`**

```python
"""repo commit (spec §2.4): stage the affected set's changed files and draft
a commit message. Never invokes `git commit` itself — the only thing this
module ever returns is a draft for a human to review (spec §2.4 Boundaries,
the load-bearing boundary of the whole spec)."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from ops.module_map import ModuleMap
from ops.repo_impacted import compute_impacted


@dataclass
class CommitDraft:
    staged_files: list[str]
    message: str


def draft_commit(repo_root: Path, module_map: ModuleMap, db_path: Path) -> CommitDraft:
    affected = compute_impacted(repo_root, module_map, db_path)
    _stage_files(repo_root, affected.changed_files)
    return CommitDraft(
        staged_files=affected.changed_files,
        message=_draft_message(affected.changed_modules, affected.changed_files),
    )


def _stage_files(repo_root: Path, files: list[str]) -> None:
    if files:
        subprocess.run(["git", "add", *files], cwd=repo_root, check=True)


def _draft_message(changed_modules: list[str], changed_files: list[str]) -> str:
    if not changed_modules:
        return "chore: no module-scoped changes detected"
    scope = changed_modules[0] if len(changed_modules) == 1 else "+".join(sorted(changed_modules))
    file_count = len(changed_files)
    plural = "s" if file_count != 1 else ""
    return f"{scope}: update {file_count} file{plural}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (26 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/repo_commit.py ops/repo_commit_test.py
git commit -m "feat(ops): add repo commit command"
```

---

## Task 9: `repo publish` (`ops/repo_publish.py`)

**Files:**
- Create: `ops/repo_publish.py`
- Test: `ops/repo_publish_test.py`

**Interfaces:**
- Consumes: `ops.git_utils.get_commits_since`, `get_current_branch`, `get_remote_tracking_state`.
- Produces: `PushPreview(branch, commit_count, remote_tracking)`; `PublishDraft(pr_title, pr_body, push_preview)`; `draft_publish(repo_root, base_branch="master") -> PublishDraft`. Never pushes or creates a PR (spec §2.5 Boundaries).

- [ ] **Step 1: Write the failing test**

Create `ops/repo_publish_test.py`:

```python
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.repo_publish import draft_publish


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


class DraftPublishTest(unittest.TestCase):
    def test_drafts_pr_title_and_body_and_previews_the_push(self):
        with TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _git(repo, "init", "-q", "-b", "master")
            _git(repo, "config", "user.email", "test@example.com")
            _git(repo, "config", "user.name", "Test")
            (repo / "a.txt").write_text("one")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "init")

            _git(repo, "checkout", "-q", "-b", "feature/x")
            (repo / "b.txt").write_text("two")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "feat: add b")
            (repo / "c.txt").write_text("three")
            _git(repo, "add", ".")
            _git(repo, "commit", "-q", "-m", "feat: add c")

            draft = draft_publish(repo, base_branch="master")

            self.assertEqual(draft.pr_title, "feature/x: 2 commits")
            self.assertEqual(draft.pr_body, "- feat: add b\n- feat: add c")
            self.assertEqual(draft.push_preview.branch, "feature/x")
            self.assertEqual(draft.push_preview.commit_count, 2)
            self.assertEqual(draft.push_preview.remote_tracking, "(no upstream configured)")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo_publish'`

- [ ] **Step 3: Write `ops/repo_publish.py`**

```python
"""repo publish (spec §2.5): drafts an editable PR (title/body) and previews
an inert push status. Never invokes `git push` or PR creation (spec §2.5
Boundaries)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ops import git_utils


@dataclass
class PushPreview:
    branch: str
    commit_count: int
    remote_tracking: str


@dataclass
class PublishDraft:
    pr_title: str
    pr_body: str
    push_preview: PushPreview


def draft_publish(repo_root: Path, base_branch: str = "master") -> PublishDraft:
    commits = git_utils.get_commits_since(repo_root, base_branch)
    branch = git_utils.get_current_branch(repo_root)
    tracking = git_utils.get_remote_tracking_state(repo_root)

    pr_title = commits[0].subject if len(commits) == 1 else f"{branch}: {len(commits)} commits"
    pr_body = "\n".join(f"- {c.subject}" for c in commits) if commits else "(no commits yet)"
    remote_description = (
        f"{tracking.remote_branch} (+{tracking.ahead}/-{tracking.behind})"
        if tracking.remote_branch
        else "(no upstream configured)"
    )

    return PublishDraft(
        pr_title=pr_title,
        pr_body=pr_body,
        push_preview=PushPreview(
            branch=branch, commit_count=len(commits), remote_tracking=remote_description
        ),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (27 tests total)

- [ ] **Step 5: Commit**

```bash
git add ops/repo_publish.py ops/repo_publish_test.py
git commit -m "feat(ops): add repo publish command"
```

---

## Task 10: CLI dispatcher (`ops/repo.py`) and `package.json` entry

**Files:**
- Create: `ops/repo.py`
- Test: `ops/repo_test.py`
- Modify: `package.json` (add a `repo` script)

**Interfaces:**
- Consumes: `ops.module_map.load_module_map`; `ops.repo_status.compute_status`; `ops.repo_impacted.compute_impacted`; `ops.repo_prepare.run_prepare`; `ops.repo_commit.draft_commit`; `ops.repo_publish.draft_publish` (Tasks 2, 5, 6, 7, 8, 9).
- Produces: `build_parser() -> argparse.ArgumentParser`; `main() -> None`. Nothing downstream consumes this — it is the outermost entry point.

- [ ] **Step 1: Write the failing test**

Create `ops/repo_test.py`:

```python
import unittest

from ops.repo import build_parser


class BuildParserTest(unittest.TestCase):
    def test_status_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["status"])
        self.assertEqual(args.command, "status")

    def test_impacted_subcommand_with_flags(self):
        parser = build_parser()
        args = parser.parse_args(["impacted", "--range", "abc..def", "--check-docs"])
        self.assertEqual(args.command, "impacted")
        self.assertEqual(args.range, "abc..def")
        self.assertTrue(args.check_docs)

    def test_impacted_subcommand_defaults(self):
        parser = build_parser()
        args = parser.parse_args(["impacted"])
        self.assertIsNone(args.range)
        self.assertFalse(args.check_docs)

    def test_publish_subcommand_default_base(self):
        parser = build_parser()
        args = parser.parse_args(["publish"])
        self.assertEqual(args.base, "master")

    def test_prepare_and_commit_subcommands_parse(self):
        parser = build_parser()
        self.assertEqual(parser.parse_args(["prepare"]).command, "prepare")
        self.assertEqual(parser.parse_args(["commit"]).command, "commit")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `ModuleNotFoundError: No module named 'ops.repo'`

- [ ] **Step 3: Write `ops/repo.py`**

```python
"""Single CLI entry point for the Dev Workflow Operational Layer (spec §2):
`python ops/repo.py <status|impacted|prepare|commit|publish>`. Each subcommand
calls straight into the module that owns that command's logic — this file
only parses arguments and formats output, never reimplements a command's
behavior (Principle 9 "Composability")."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_MAP_PATH = REPO_ROOT / "code-index" / "module_map.json"
DB_PATH = REPO_ROOT / "code-index" / "code_index.db"
ROADMAP_PATH = REPO_ROOT / "docs" / "status" / "roadmap.md"
KNOWN_ISSUES_PATH = REPO_ROOT / "docs" / "status" / "known-issues.md"

sys.path.insert(0, str(REPO_ROOT))

from ops.module_map import load_module_map  # noqa: E402
from ops.repo_commit import draft_commit  # noqa: E402
from ops.repo_impacted import compute_impacted  # noqa: E402
from ops.repo_prepare import run_prepare  # noqa: E402
from ops.repo_publish import draft_publish  # noqa: E402
from ops.repo_status import compute_status  # noqa: E402


def _cmd_status(_args: argparse.Namespace) -> None:
    module_map = load_module_map(MODULE_MAP_PATH)
    report = compute_status(REPO_ROOT, module_map, DB_PATH, ROADMAP_PATH, KNOWN_ISSUES_PATH)
    print(f"branch: {report.branch}")
    tree = "clean" if report.working_tree_clean else f"{report.modified_count} modified, {report.untracked_count} untracked"
    print(f"working tree: {tree}")
    index = f"stale ({', '.join(report.staleness.stale_modules)})" if report.staleness.is_stale else "fresh"
    print(f"code index: {index}")
    print(f"roadmap: {report.roadmap_pointer}")
    print(f"known issues: {report.known_issues_count}")


def _cmd_impacted(args: argparse.Namespace) -> None:
    module_map = load_module_map(MODULE_MAP_PATH)
    result = compute_impacted(
        REPO_ROOT, module_map, DB_PATH, diff_range=args.range, check_docs=args.check_docs
    )
    print(f"changed files: {result.changed_files}")
    print(f"changed modules: {result.changed_modules}")
    print(f"dependent files: {result.dependent_files}")
    print(f"dependent modules: {result.dependent_modules}")
    if result.staleness.is_stale:
        print(f"WARNING: Code Index is stale for: {result.staleness.stale_modules}")
    if result.doc_drift is not None:
        print(f"doc drift: {result.doc_drift}")


def _cmd_prepare(_args: argparse.Namespace) -> None:
    module_map = load_module_map(MODULE_MAP_PATH)
    report = run_prepare(REPO_ROOT, module_map, DB_PATH)
    for r in report.results:
        print(f"[{r.module}] typecheck: {'PASS' if r.typecheck_passed else 'FAIL'}")
        if r.tests_ran:
            print(f"[{r.module}] tests: {'PASS' if r.tests_passed else 'FAIL'}")
        if r.testing_policy_reminder:
            print(f"[{r.module}] reminder: {r.testing_policy_reminder}")


def _cmd_commit(_args: argparse.Namespace) -> None:
    module_map = load_module_map(MODULE_MAP_PATH)
    draft = draft_commit(REPO_ROOT, module_map, DB_PATH)
    print(f"staged: {draft.staged_files}")
    print(f"draft message:\n  {draft.message}")
    print("(review and run `git commit` yourself — this tool never commits)")


def _cmd_publish(args: argparse.Namespace) -> None:
    draft = draft_publish(REPO_ROOT, base_branch=args.base)
    print(f"PR title: {draft.pr_title}")
    print(f"PR body:\n{draft.pr_body}")
    print(f"push preview: {draft.push_preview}")
    print("(review and run `git push` / open the PR yourself — this tool never pushes)")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="repo")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status").set_defaults(func=_cmd_status)

    impacted_parser = subparsers.add_parser("impacted")
    impacted_parser.add_argument("--range", default=None)
    impacted_parser.add_argument("--check-docs", action="store_true")
    impacted_parser.set_defaults(func=_cmd_impacted)

    subparsers.add_parser("prepare").set_defaults(func=_cmd_prepare)
    subparsers.add_parser("commit").set_defaults(func=_cmd_commit)

    publish_parser = subparsers.add_parser("publish")
    publish_parser.add_argument("--base", default="master")
    publish_parser.set_defaults(func=_cmd_publish)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (32 tests total)

- [ ] **Step 5: Add the `repo` script to `package.json`**

In `package.json`, add a `repo` entry to `scripts` alongside the existing `mobile`/`playground`/`test` entries:

```json
{
  "scripts": {
    "mobile": "npm run start --workspace=world-cards-mobile",
    "playground": "npm run start --workspace=world-cards-playground",
    "test": "jest",
    "repo": "python ops/repo.py"
  }
}
```

- [ ] **Step 6: Manually verify the CLI runs end-to-end**

Run: `npm run repo -- status`
Expected: prints `branch:`, `working tree:`, `code index:`, `roadmap:`, and `known issues:` lines with real values from this repo — confirms the whole chain (argparse → `compute_status` → git/staleness/doc-pointer helpers) is wired correctly, not just unit-tested in isolation.

- [ ] **Step 7: Commit**

```bash
git add ops/repo.py ops/repo_test.py package.json
git commit -m "feat(ops): add repo CLI dispatcher and npm script"
```

---

## Task 11: Code Index freshness guard (`ops/staleness_cli.py` + `code-index/update_codeindex.ps1`)

**Files:**
- Create: `ops/staleness_cli.py`
- Test: `ops/staleness_cli_test.py`
- Modify: `code-index/update_codeindex.ps1`

**Interfaces:**
- Consumes: `ops.module_map.load_module_map` (Task 2); `ops.staleness.check_staleness` (Task 3) — the *same* computation `repo status` and `repo impacted` use, per spec §2.6's "Interaction with other commands" (one consistent staleness result, never a second implementation).
- Produces: a process exit code (0 = fresh, 1 = stale) and a one-line stdout message, consumed by `update_codeindex.ps1`.

- [ ] **Step 1: Write the failing test**

Create `ops/staleness_cli_test.py`:

```python
import subprocess
import sys
import unittest
from pathlib import Path


class StalenessCliTest(unittest.TestCase):
    def test_runs_against_the_real_repo_and_exits_fresh_or_stale(self):
        repo_root = Path(__file__).resolve().parent.parent
        result = subprocess.run(
            [sys.executable, str(repo_root / "ops" / "staleness_cli.py")],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
        self.assertIn(result.returncode, (0, 1))
        self.assertIn(result.stdout.strip().split(":")[0], ("fresh", "stale"))


if __name__ == "__main__":
    unittest.main()
```

Note: unlike Tasks 1–10, this test runs against the *actual* repo's `code-index/module_map.json` and `code-index/code_index.db` rather than a temp fixture — `staleness_cli.py`'s only job is wiring the CLI shim to those two real, fixed paths, so a real-repo smoke test is the correct check here, not a unit test with an injected path.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: FAIL with `FileNotFoundError` (or non-zero from a missing script) — `ops/staleness_cli.py` doesn't exist yet

- [ ] **Step 3: Write `ops/staleness_cli.py`**

```python
"""Tiny CLI shim so update_codeindex.ps1 (PowerShell) can reuse
ops/staleness.py's single staleness computation (spec §2.6 / §1's staleness
consumption rule) instead of re-implementing the mtime comparison in
PowerShell. Exit 0 = fresh (skip rebuild), exit 1 = stale (rebuild)."""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from ops.module_map import load_module_map  # noqa: E402
from ops.staleness import check_staleness  # noqa: E402


def main() -> int:
    module_map = load_module_map(REPO_ROOT / "code-index" / "module_map.json")
    result = check_staleness(REPO_ROOT, module_map, REPO_ROOT / "code-index" / "code_index.db")
    if result.is_stale:
        print(f"stale: {', '.join(result.stale_modules)}")
        return 1
    print("fresh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s ops -p "*_test.py" -t .`
Expected: PASS (33 tests total)

- [ ] **Step 5: Add the freshness guard to `code-index/update_codeindex.ps1`**

In `code-index/update_codeindex.ps1`, add a `param()` block as the very first statement (comments may precede it) — change:

```powershell
$idx       = $PSScriptRoot
```

to:

```powershell
param([switch]$Force)

$idx       = $PSScriptRoot
```

Then, right after the existing preflight block that ends with `Write-Ok "python, node found"` and before the `# --- Phase 1 - Discover projects` comment, insert:

```powershell
# --- Freshness guard (Ops Layer spec §2.6): skip the full rebuild if nothing
# has changed since the last one. Reuses ops/staleness.py's single staleness
# computation via a thin CLI shim - this script never re-implements the mtime
# comparison itself (docs/superpowers/specs/2026-08-05-dev-workflow-operational-layer-design.md §1).
if (-not $Force -and (Test-Path $moduleMap) -and (Test-Path $db)) {
    Write-Stage "[freshness] Checking whether a rebuild is needed..."
    & python "$root\ops\staleness_cli.py" 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Code Index is already fresh - skipping rebuild. Use -Force to rebuild anyway."
        exit 0
    }
    Write-Host "  Code Index is stale - continuing with full rebuild." -ForegroundColor Yellow
}
```

- [ ] **Step 6: Manually verify the guard**

Run: `powershell -File code-index/update_codeindex.ps1` twice in a row.
Expected: the first run rebuilds as normal (or reports stale/missing db); the second run, with nothing changed in between, prints `[freshness] Checking whether a rebuild is needed...` followed by `OK: Code Index is already fresh - skipping rebuild. Use -Force to rebuild anyway.` and exits without running Phases 1–7.

Run: `powershell -File code-index/update_codeindex.ps1 -Force`
Expected: runs the full rebuild unconditionally, skipping the freshness check.

- [ ] **Step 7: Commit**

```bash
git add ops/staleness_cli.py ops/staleness_cli_test.py code-index/update_codeindex.ps1
git commit -m "feat(ops): add Code Index freshness guard to update_codeindex.ps1"
```

---

## Testing strategy

- **Framework:** `unittest` (standard library) — no new dependency; `pytest` is not installed in this environment.
- **Discovery:** `python -m unittest discover -s ops -p "*_test.py" -t .` from the repo root, run after every task (33 tests by the end of Task 11).
- **Isolation:** every test that touches git or SQLite builds its own throwaway `TemporaryDirectory` — a real `git init`'d repo or a hand-built `code_index.db` with only the columns the query under test needs. No test reads or writes this repo's actual `.git` or `code-index/code_index.db`, except:
  - Task 10 Step 6 and Task 11 Steps 1/6, which are explicitly manual/real-repo smoke checks, not part of the unit-test suite, and are called out as such in their own task.
- **Mocking:** `repo_prepare`'s orchestration test mocks `_run_typecheck`/`_run_tests` (Task 7) so the unit test suite never shells out to `npx tsc`/`npx jest` — those two functions are exercised for real only by Task 10 Step 6's manual end-to-end check.

## Acceptance criteria

Mapped directly to the frozen spec's own sections — each is a yes/no check against the finished implementation:

- [ ] `repo status`, `repo impacted`, `repo prepare`, `repo commit`, `repo publish` are each callable independently via `python ops/repo.py <name>` and independently unit-tested (spec Principle 9 "Composability" — Tasks 5–9 each have their own test file with no cross-task test dependency).
- [ ] No code path in `ops/` calls `git commit`, `git push`, or creates a PR (spec §0 constraint 4, §2.4/§2.5 Boundaries) — verified directly by Task 8's `log_head == "init"` assertion; grep `ops/` for `"commit"` / `"push"` as git subcommand arguments finds only the disallowed-string absent, not present.
- [ ] `repo_impacted.DOC_MAPPING` is empty and `--check-docs` reports `mapping_not_available` for every module (spec §2.2/§4/§5 open prerequisite) — verified by Task 5's test.
- [ ] `repo impacted`, `repo prepare`, and the freshness guard all route through the one `ops/staleness.check_staleness` function — verified by inspection: `ops/repo_impacted.py` and `ops/staleness_cli.py` both import `check_staleness` from `ops.staleness`, and `ops/repo_prepare.py` imports `compute_impacted` rather than staleness directly (spec §1 "Staleness consumption rule").
- [ ] `update_codeindex.ps1` skips its rebuild pipeline when fresh and always rebuilds under `-Force` (spec §2.6) — verified by Task 11 Step 6's manual check.
- [ ] No new Python or Node dependency was added anywhere in this plan (spec §0 constraint 2) — verified by `git diff` on `package.json`/`requirements.txt` showing no new dependency entries, only the `repo` script line.
