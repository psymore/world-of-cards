# update_codeindex.ps1 - Rebuild the queryable code index from scratch
# Lives inside .codeindex/ - run from anywhere:
#   powershell -File path/to/.codeindex/update_codeindex.ps1
#
# Phase 8.1: drives the full multi-language pipeline. Which language
# extractors run is decided from module_map.json (already written by
# discover_projects.py in Phase 1) - not a second filesystem scan. A
# module's pathPrefix is the exact directory discover_projects.py found
# its marker file in, so checking for *.csproj / package.json directly in
# that one directory (non-recursive) tells us which marker produced it,
# at near-zero cost.
#
# Error handling note: deliberately NOT setting
# $ErrorActionPreference = "Stop" at script scope. In Windows PowerShell
# 5.1, a native command's stderr output is wrapped as a NativeCommandError
# and, under "Stop", becomes an immediately terminating exception
# regardless of the process's actual exit code - bypassing this script's
# own $LASTEXITCODE checks below and surfacing a confusing raw system
# error instead of the intended messages (observed directly during Phase 8's
# review: a missing dotnet-script produced a raw "could not execute"
# error instead of the script's own "Symbol extraction failed" message).
# Native command failures are instead detected purely via $LASTEXITCODE,
# via the Invoke-Step helper below. PowerShell-native operations (JSON
# parsing) use try/catch with -ErrorAction Stop locally, where that
# behaves predictably and isn't subject to this issue.
#
# Note: this file is plain ASCII on purpose. Non-ASCII characters (box-
# drawing, em dashes) in a .ps1 with no BOM can be misread under Windows
# PowerShell 5.1's default codepage handling and corrupt parsing further
# down the file - confirmed directly while writing this script.

$idx       = $PSScriptRoot
$root      = Split-Path $idx -Parent
$rawJson   = Join-Path $idx "ctags_raw.json"
$edgesRaw  = Join-Path $idx "edges_raw.jsonl"
$db        = Join-Path $idx "code_index.db"
$moduleMap = Join-Path $idx "module_map.json"

$csharpSymbolsTmp = Join-Path $idx "ctags_csharp.json"
$tsSymbolsTmp     = Join-Path $idx "ctags_typescript.json"
$csharpEdgesTmp   = Join-Path $idx "edges_csharp.jsonl"
$tsEdgesTmp       = Join-Path $idx "edges_typescript.jsonl"

function Write-Stage([string]$msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok([string]$msg)    { Write-Host "  OK: $msg" -ForegroundColor Green }
function Fail([string]$msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

# Runs a native command and checks $LASTEXITCODE explicitly - the
# deterministic replacement for relying on $ErrorActionPreference = "Stop"
# (see note above).
function Invoke-Step([string]$exe, [string[]]$exeArgs, [string]$label) {
    & $exe @exeArgs
    if ($LASTEXITCODE -ne 0) {
        Fail "$label failed (exit code $LASTEXITCODE)"
    }
}

# Appends a generated JSONL file's content into the combined artifact,
# preserving UTF-8 (Add-Content/Get-Content default to the system ANSI
# codepage in Windows PowerShell 5.1, which would corrupt non-ASCII
# content - e.g. this repo's own game/UI text).
function Add-Jsonl([string]$sourceFile, [string]$destFile) {
    if ((Test-Path $sourceFile) -and (Get-Item $sourceFile).Length -gt 0) {
        Get-Content $sourceFile -Encoding utf8 | Add-Content $destFile -Encoding utf8
    }
}

Write-Host "[update] Starting index rebuild..." -ForegroundColor Cyan

# --- Preflight: always-required tools ---------------------------------------
Write-Stage "[preflight] Checking required tools..."
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Fail "'python' is required but was not found on PATH."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "'node' is required but was not found on PATH."
}
Write-Ok "python, node found"

# --- Phase 1 - Discover projects (non-destructive; safe before cleanup) -----
Write-Stage "[1/7] Discovering projects..."
Invoke-Step "python" @("$idx\discover_projects.py", $root) "Project discovery"
if (-not (Test-Path $moduleMap)) {
    Fail "discover_projects.py did not produce module_map.json"
}

# --- Determine which language extractors are needed -------------------------
try {
    $moduleMapData = Get-Content $moduleMap -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
} catch {
    Fail "Could not parse module_map.json: $($_.Exception.Message)"
}

$hasCsharp = $false
$hasTypeScript = $false
foreach ($m in $moduleMapData.modules) {
    $moduleDir = Join-Path $root $m.pathPrefix
    if (-not $hasCsharp -and (Test-Path (Join-Path $moduleDir "*.csproj"))) { $hasCsharp = $true }
    if (-not $hasTypeScript -and (Test-Path (Join-Path $moduleDir "package.json"))) { $hasTypeScript = $true }
}
Write-Ok "C# projects detected: $hasCsharp | TypeScript packages detected: $hasTypeScript"

if (-not $hasCsharp -and -not $hasTypeScript) {
    Fail "No recognized project markers (*.csproj, package.json) found under any discovered module - nothing to index."
}

# --- Preflight: language-specific tools --------------------------------------
if ($hasCsharp -and -not (Get-Command dotnet-script -ErrorAction SilentlyContinue)) {
    Fail "C# projects were detected but 'dotnet-script' is not installed. Run: dotnet tool install -g dotnet-script"
}
if ($hasCsharp) { Write-Ok "dotnet-script found" }

# --- Phase 0 - Clean generated artifacts (only once prerequisites confirmed) -
Write-Stage "[0/7] Removing existing generated files..."
$artifactsToClean = @(
    $db, $rawJson, $edgesRaw, "$idx\LAYOUT*.md",
    $csharpSymbolsTmp, $tsSymbolsTmp, $csharpEdgesTmp, $tsEdgesTmp
)
Remove-Item -Path $artifactsToClean -ErrorAction SilentlyContinue
Write-Ok "cleaned"

# --- Phase 2 - Extract symbols ------------------------------------------------
Write-Stage "[2/7] Extracting symbols..."
New-Item -ItemType File -Path $rawJson | Out-Null
if ($hasCsharp) {
    Invoke-Step "dotnet" @("script", "--no-cache", "$idx\extractor\csharp\extract_symbols.csx", "--", $root, $csharpSymbolsTmp) "C# symbol extraction"
    Add-Jsonl $csharpSymbolsTmp $rawJson
    Write-Ok "C# symbols extracted"
}
if ($hasTypeScript) {
    Invoke-Step "node" @("$idx\extractor\typescript\extract_symbols.js", $root, $tsSymbolsTmp) "TypeScript symbol extraction"
    Add-Jsonl $tsSymbolsTmp $rawJson
    Write-Ok "TypeScript symbols extracted"
}

# --- Phase 3 - Ingest symbols into SQLite -------------------------------------
Write-Stage "[3/7] Ingesting symbols into SQLite..."
Invoke-Step "python" @("$idx\ingest.py", $rawJson, $db) "Symbol ingest"
Write-Ok "symbols ingested"

# --- Phase 4 - Extract dependency edges ---------------------------------------
Write-Stage "[4/7] Extracting import edges..."
New-Item -ItemType File -Path $edgesRaw | Out-Null
if ($hasCsharp) {
    Invoke-Step "python" @("$idx\extractor\csharp\extract_edges.py", $root, $db, $csharpEdgesTmp) "C# edge extraction"
    Add-Jsonl $csharpEdgesTmp $edgesRaw
    Write-Ok "C# edges extracted"
}
if ($hasTypeScript) {
    Invoke-Step "node" @("$idx\extractor\typescript\extract_edges.js", $root, $tsEdgesTmp) "TypeScript edge extraction"
    Add-Jsonl $tsEdgesTmp $edgesRaw
    Write-Ok "TypeScript edges extracted"
}

# --- Phase 5 - Ingest edges into file_edges -----------------------------------
Write-Stage "[5/7] Ingesting edges into file_edges..."
Invoke-Step "python" @("$idx\ingest_edges.py", $edgesRaw, $db) "Edge ingest"
Write-Ok "edges ingested"

# --- Phase 6 - Aggregate to module-level edges --------------------------------
Write-Stage "[6/7] Aggregating module-level edges..."
Invoke-Step "python" @("$idx\aggregate_edges.py", $db) "Edge aggregation"
Write-Ok "edges aggregated"

# --- Phase 7 - Regenerate layout files ----------------------------------------
Write-Stage "[7/7] Regenerating layout files..."
Invoke-Step "python" @("$idx\generate_layouts.py", $db, $idx) "Layout generation"
Write-Ok "layouts generated"

# Per-language temp files are intermediate - the combined $rawJson/$edgesRaw
# are the real artifacts, matching the existing generated-artifact contract.
Remove-Item -Path $csharpSymbolsTmp, $tsSymbolsTmp, $csharpEdgesTmp, $tsEdgesTmp -ErrorAction SilentlyContinue

Write-Host "[update] Done. code-index\code_index.db and LAYOUT*.md are current." -ForegroundColor Green

# .mcp.json - ensure VSCode extension can find the server
$mcpJson = Join-Path $root ".mcp.json"
$dbAbs   = (Resolve-Path $db).Path
$mcpContent = @"
{
  "mcpServers": {
    "code-index": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "$($dbAbs -replace '\\', '\\\\')"]
    }
  }
}
"@

if (Test-Path $mcpJson) {
    $parsed = Get-Content $mcpJson -Raw | ConvertFrom-Json
    if ($null -eq $parsed.mcpServers) {
        $parsed | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([PSCustomObject]@{})
    }
    if ($parsed.mcpServers.PSObject.Properties["code-index"]) {
        Write-Host "[mcp] .mcp.json already contains code-index entry." -ForegroundColor Green
    } else {
        $entry = [PSCustomObject]@{ command = "uvx"; args = @("mcp-server-sqlite", "--db-path", $dbAbs) }
        $parsed.mcpServers | Add-Member -NotePropertyName "code-index" -NotePropertyValue $entry
        $parsed | ConvertTo-Json -Depth 5 | Set-Content $mcpJson -Encoding utf8
        Write-Host "[mcp] Added code-index entry to existing .mcp.json." -ForegroundColor Green
    }
} else {
    Set-Content $mcpJson $mcpContent -Encoding utf8
    Write-Host "[mcp] Created .mcp.json for VSCode extension." -ForegroundColor Green
}

# MCP registration check (CLI)
$registered = $false
try {
    $mcpList = & claude mcp list 2>$null
    if ($LASTEXITCODE -eq 0 -and $mcpList -match "code-index") { $registered = $true }
} catch { }

if ($registered) {
    Write-Host "[mcp] code-index server already registered in CLI." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[mcp] code-index MCP server is NOT registered for CLI. Run:" -ForegroundColor Yellow
    Write-Host "  claude mcp add code-index --scope local -- uvx mcp-server-sqlite --db-path `"$dbAbs`"" -ForegroundColor Cyan
}
