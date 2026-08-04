# update_codeindex.ps1 — Rebuild the queryable code index from scratch
# Lives inside .codeindex/ — run from anywhere:
#   powershell -File path/to/.codeindex/update_codeindex.ps1

$ErrorActionPreference = "Stop"
$idx     = $PSScriptRoot
$root    = Split-Path $idx -Parent
$rawJson = Join-Path $idx "ctags_raw.json"
$db      = Join-Path $idx "code_index.db"

Write-Host "[update] Starting index rebuild..." -ForegroundColor Cyan

# Phase 0 — Clean generated artifacts
Write-Host "[0/5] Removing existing generated files..." -ForegroundColor Yellow
Remove-Item -Path "$idx\code_index.db" -ErrorAction SilentlyContinue
Remove-Item -Path "$idx\ctags_raw.json" -ErrorAction SilentlyContinue
Remove-Item -Path "$idx\LAYOUT*.md" -ErrorAction SilentlyContinue

# Phase 1 — Discover projects and refresh module mappings
Write-Host "[1/5] Discovering projects..." -ForegroundColor Yellow
python "$idx\discover_projects.py" $root
if ($LASTEXITCODE -ne 0) { throw "Project discovery failed" }

# Phase 2 — Extract symbols
Write-Host "[2/5] Extracting symbols with Roslyn..." -ForegroundColor Yellow
dotnet script --no-cache "$idx\extract_symbols.csx" -- $root $rawJson
if ($LASTEXITCODE -ne 0) { throw "Symbol extraction failed" }

# Phase 3 — Ingest into SQLite
Write-Host "[3/5] Ingesting symbols into SQLite..." -ForegroundColor Yellow
python "$idx\ingest.py" $rawJson $db
if ($LASTEXITCODE -ne 0) { throw "Ingest failed" }

# Phase 4 — Extract file edges
Write-Host "[4/5] Extracting import edges..." -ForegroundColor Yellow
python "$idx\extract_edges.py" $root $db
if ($LASTEXITCODE -ne 0) { throw "Edge extraction failed" }

# Phase 4b — Aggregate to module edges
python "$idx\aggregate_edges.py" $db
if ($LASTEXITCODE -ne 0) { throw "Edge aggregation failed" }

# Phase 5 — Regenerate layout files (output goes into .codeindex)
Write-Host "[5/5] Regenerating layout files..." -ForegroundColor Yellow
python "$idx\generate_layouts.py" $db $idx
if ($LASTEXITCODE -ne 0) { throw "Layout generation failed" }

Write-Host "[update] Done. .codeindex\code_index.db and LAYOUT*.md are current." -ForegroundColor Green

# .mcp.json — ensure VSCode extension can find the server
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
