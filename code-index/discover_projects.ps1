# discover_projects.ps1
# Scans solution for .csproj files and generates module mappings

param(
    [Parameter(Mandatory=$false)][string]$RepoRoot = "."
)

$absoluteRoot = (Resolve-Path $RepoRoot).Path

$csprojFiles = @(Get-ChildItem -Path $absoluteRoot -Filter "*.csproj" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notlike "*\obj\*" -and $_.FullName -notlike "*\bin\*" })

$projects = @()
foreach ($csproj in $csprojFiles) {
    $projectDir = $csproj.Directory.FullName
    $relPath = [System.IO.Path]::GetRelativePath($absoluteRoot, $projectDir).Replace('\', '/')
    $name = $csproj.BaseName
    $projects += [PSCustomObject]@{
        Name     = $name
        RelPath  = $relPath
        FullPath = $projectDir
    }
}

$projects = $projects | Sort-Object RelPath

Write-Host "Found $($projects.Count) projects:" -ForegroundColor Cyan
$projects | Format-Table Name, RelPath -AutoSize

$response = Read-Host "`nGenerate get_module() rules for ingest.py? (y/n)"
if ($response -eq 'y' -or $response -eq 'yes') {
    Write-Host "`nCopy this into ingest.py's get_module() function:" -ForegroundColor Yellow
    Write-Host "def get_module(namespace, path):" -ForegroundColor Green
    Write-Host "    p = path.lower()" -ForegroundColor Gray

    foreach ($proj in $projects) {
        Write-Host "  [DEBUG] Name=$($proj.Name) RelPath=$($proj.RelPath)" -ForegroundColor DarkYellow
        if ($null -eq $proj.RelPath) {
            Write-Warning "Skipping $($proj.Name) — RelPath is null"
            continue
        }
        $folder = $proj.RelPath.ToLower()
        $key = $proj.Name.ToLower() -replace '[._]', ''
        Write-Host "    if `"$folder`" in p: return `"$key`"" -ForegroundColor Gray
    }

    Write-Host "    return `"api`"" -ForegroundColor Gray
}

return $projects
