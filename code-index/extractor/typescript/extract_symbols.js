#!/usr/bin/env node
// extract_symbols.js — TypeScript/TSX symbol extractor
// Produces JSONL records conforming to ../CONTRACT.md. Mirrors the C#
// extractor's CLI shape and separation of concerns: this script only
// extracts symbols and writes the contract's wire format — it has no
// knowledge of module_map.json, modules, or the SQLite pipeline.
//
// Usage: node extract_symbols.js [repoRoot] [outputFile]
//
// Scope (deliberately minimal — see extractor/typescript/LIMITATIONS.md):
//   - top-level function/const-arrow declarations, classes (+ their
//     methods/properties/constructor), interfaces, and type aliases
//   - no nested/local declarations inside function bodies
//   - no full type-checking — signatures are printed from syntax only

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const repoRoot = process.argv[2] || ".";
const outputFile = process.argv[3] || "ctags_raw.json";

// "worktrees" excluded: a git worktree checkout duplicates the main tree's
// own files under a second path, which otherwise get double-indexed.
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".expo", ".git", "build", ".next", "worktrees"]);

function findSourceFiles(root) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const isTsLike = entry.name.endsWith(".ts") || entry.name.endsWith(".tsx");
        if (isTsLike && !entry.name.endsWith(".d.ts")) {
          results.push(path.join(dir, entry.name));
        }
      }
    }
  }
  walk(root);
  return results.sort();
}

const absRoot = path.resolve(repoRoot);
const files = findSourceFiles(absRoot);
process.stderr.write(`[extract] ${files.length} .ts/.tsx files found (node_modules/dist/etc excluded)\n`);

const out = fs.createWriteStream(outputFile, { encoding: "utf8" });
let symbolCount = 0;

function emit(record) {
  out.write(JSON.stringify(record) + "\n");
  symbolCount++;
}

function isExported(node) {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!mods && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

// Class members have real public/private/protected keywords in TS — used
// directly when present. Unmarked members default to "public", which is
// TypeScript's actual default visibility (mirrors how the C# extractor's
// GetAccess() defaults unmarked class members to "private" — same idea,
// each language's own real default, not a borrowed one).
function classMemberAccess(member) {
  const mods = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
  if (mods) {
    if (mods.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) return "private";
    if (mods.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)) return "protected";
    if (mods.some((m) => m.kind === ts.SyntaxKind.PublicKeyword)) return "public";
  }
  return "public";
}

// Top-level declarations don't have public/private in TS — the real
// analogous concept is module export. "exported" / "module-private" is
// TypeScript's own vocabulary, not a forced mapping onto C#'s public/private.
function topLevelAccess(node) {
  return isExported(node) ? "exported" : "module-private";
}

function containsJsx(node) {
  let found = false;
  function visit(n) {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  }
  if (node) visit(node);
  return found;
}

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

// React function component heuristic: PascalCase name, declared in a .tsx
// file, body contains a JSX node somewhere. No type-checking involved —
// syntactic only, matching the "simplest reliable approach" this extractor
// is built on. Everything else callable is "function".
function classifyFunctionKind(name, body, isTsx) {
  if (name && isTsx && isPascalCase(name) && containsJsx(body)) return "component";
  return "function";
}

// Destructured-object parameter types (common in React props) span multiple
// source lines; collapsed to single-line so the signature stays readable
// as one string instead of embedding raw newlines.
function oneLine(text) {
  return text.replace(/\s+/g, " ").trim();
}

function functionSignature(sourceFile, params, returnTypeNode) {
  const ps = params.map((p) => (p.type ? oneLine(p.type.getText(sourceFile)) : "?")).join(", ");
  const rt = returnTypeNode ? oneLine(returnTypeNode.getText(sourceFile)) : "";
  return rt ? `(${ps}): ${rt}` : `(${ps})`;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function visitClassMember(sourceFile, member, className, relPath) {
  if (ts.isConstructorDeclaration(member)) {
    emit({
      name: "constructor",
      kind: "constructor",
      scope: className,
      namespace: null,
      signature: functionSignature(sourceFile, member.parameters, undefined),
      access: classMemberAccess(member),
      path: relPath,
      line: lineOf(sourceFile, member),
    });
  } else if (ts.isMethodDeclaration(member) && member.name) {
    emit({
      name: member.name.getText(sourceFile),
      kind: "method",
      scope: className,
      namespace: null,
      signature: functionSignature(sourceFile, member.parameters, member.type),
      access: classMemberAccess(member),
      path: relPath,
      line: lineOf(sourceFile, member),
    });
  } else if (ts.isPropertyDeclaration(member) && member.name) {
    emit({
      name: member.name.getText(sourceFile),
      kind: "property",
      scope: className,
      namespace: null,
      signature: member.type ? oneLine(member.type.getText(sourceFile)) : null,
      access: classMemberAccess(member),
      path: relPath,
      line: lineOf(sourceFile, member),
    });
  }
}

function visitFile(sourceFile, relPath, isTsx) {
  // Only top-level statements — deliberately not a general recursive AST
  // walk. Nested/local declarations inside function bodies are out of
  // scope for this minimal extractor (see LIMITATIONS.md).
  for (const node of sourceFile.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const name = node.name.getText(sourceFile);
      emit({
        name,
        kind: classifyFunctionKind(name, node.body, isTsx),
        scope: null,
        namespace: null,
        signature: functionSignature(sourceFile, node.parameters, node.type),
        access: topLevelAccess(node),
        path: relPath,
        line: lineOf(sourceFile, node),
      });
    } else if (ts.isVariableStatement(node)) {
      const exported = topLevelAccess(node);
      for (const decl of node.declarationList.declarations) {
        if (!decl.name || !ts.isIdentifier(decl.name)) continue;
        const init = decl.initializer;
        if (!init || !(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue;
        const name = decl.name.getText(sourceFile);
        emit({
          name,
          kind: classifyFunctionKind(name, init.body, isTsx),
          scope: null,
          namespace: null,
          signature: functionSignature(sourceFile, init.parameters, init.type),
          access: exported,
          path: relPath,
          line: lineOf(sourceFile, decl),
        });
      }
    } else if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.getText(sourceFile);
      emit({
        name: className,
        kind: "class",
        scope: null,
        namespace: null,
        signature: null,
        access: topLevelAccess(node),
        path: relPath,
        line: lineOf(sourceFile, node),
      });
      for (const member of node.members) visitClassMember(sourceFile, member, className, relPath);
    } else if (ts.isInterfaceDeclaration(node)) {
      emit({
        name: node.name.getText(sourceFile),
        kind: "interface",
        scope: null,
        namespace: null,
        signature: null,
        access: topLevelAccess(node),
        path: relPath,
        line: lineOf(sourceFile, node),
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      emit({
        name: node.name.getText(sourceFile),
        kind: "type",
        scope: null,
        namespace: null,
        signature: null,
        access: topLevelAccess(node),
        path: relPath,
        line: lineOf(sourceFile, node),
      });
    }
  }
}

for (const filePath of files) {
  let code;
  try {
    code = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    process.stderr.write(`[SKIP] ${filePath}: ${e.message}\n`);
    continue;
  }

  const relPath = path.relative(absRoot, filePath).split(path.sep).join("/");
  const isTsx = filePath.endsWith(".tsx");
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  visitFile(sourceFile, relPath, isTsx);
}

out.end();
process.stderr.write(`[extract] ${symbolCount} symbols written to ${outputFile}\n`);
