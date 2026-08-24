<#
.SYNOPSIS
    "CMP": commit everything on the current branch, merge it into master, push. Then rebuild the code-index.

.DESCRIPTION
    Implements the "CMP" shorthand from docs/governance/guardrails.md Rule 7 as a
    single script instead of ~5 separate git commands: commit onto whatever branch
    is already checked out (no new branch - that's BCMP / sync-branch.ps1's job),
    merge that branch into master, push master, then rebuild the code-index so it
    doesn't silently drift (Rule 10).

    If the current branch is already master, the merge step is skipped (nothing to
    merge into itself) and it just commits + pushes.

    Safety:
      - Refuses to run if there are no local changes to commit.
      - Shows `git status --short` and asks for confirmation before doing
        anything, unless -Force is passed (the word "CMP" itself is the
        confirmation per Rule 7 - Claude passes -Force when the user typed it).
      - Never force-pushes. If the merge or push fails, it stops and leaves you
        to resolve it manually - nothing here overwrites or discards work.
      - A code-index rebuild failure is reported but does NOT fail the script -
        the git operations already succeeded by that point; rebuild manually
        later with .\code-index\update_codeindex.ps1 if needed.

.PARAMETER Message
    Commit message for the local changes.

.PARAMETER Force
    Skip the confirmation prompt.

.PARAMETER SkipIndex
    Skip the code-index rebuild step (e.g. for a repo/branch with no code-index).

.EXAMPLE
    .\scripts\git\cmp.ps1 -Message "fix(ui): correct hover state on card back" -Force
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Message,

    [switch]$Force,

    [switch]$SkipIndex
)

$ErrorActionPreference = 'Stop'

$status = git status --porcelain
if (-not $status) {
    Write-Host "No local changes to commit. Aborting."
    exit 1
}

$currentBranch = git branch --show-current
$isMaster = $currentBranch -eq 'master'

if ($isMaster) {
    Write-Host "About to commit the following directly on 'master' and push:"
} else {
    Write-Host "About to commit the following onto '$currentBranch', merge it into master, and push:"
}
git status --short

if (-not $Force) {
    $confirmation = Read-Host "Continue? [y/N]"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "Aborted."
        exit 1
    }
}

git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed - see output above."
    exit 1
}

if (-not $isMaster) {
    git checkout master
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Could not check out master. Your changes are committed on '$currentBranch'."
        exit 1
    }

    git merge --no-edit $currentBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Merge failed - resolve conflicts manually on master, then push yourself."
        Write-Host "Your changes are safe on branch '$currentBranch'."
        exit 1
    }
}

git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed (remote may have diverged) - pull/rebase and push manually."
    if ($isMaster) {
        Write-Host "Your changes are safe on master locally."
    } else {
        Write-Host "Your changes are safe on master locally and on branch '$currentBranch'."
    }
    exit 1
}

Write-Host "Done. $(if ($isMaster) { 'Committed and pushed on master.' } else { "'$currentBranch' merged into master and pushed." })"

# --- code-index rebuild (guardrails.md Rule 10: rebuild after every push) ----
if (-not $SkipIndex) {
    $repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $indexScript = Join-Path $repoRoot "code-index\update_codeindex.ps1"
    if (Test-Path $indexScript) {
        Write-Host ""
        Write-Host "Rebuilding code-index..." -ForegroundColor Cyan
        & $indexScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: code-index rebuild failed (exit $LASTEXITCODE)." -ForegroundColor Yellow
            Write-Host "Push already succeeded. Rebuild manually later with .\code-index\update_codeindex.ps1" -ForegroundColor Yellow
        } else {
            Write-Host "code-index rebuilt." -ForegroundColor Green
        }
    }
}
