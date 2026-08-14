<#
.SYNOPSIS
    Branch off, commit everything, merge to master, push - in one step.

.DESCRIPTION
    Collapses this repo's everyday "wrap up a session's work" workflow -
    create a branch, commit all local changes onto it, merge it into master,
    push - into one command instead of the usual ~6 separate git commands
    (checkout -b, add, commit, checkout master, merge, push).

    Safety:
      - Refuses to run if there are no local changes to commit.
      - Shows `git status --short` and asks for confirmation before doing
        anything, unless -Force is passed (for when the confirmation already
        happened in conversation, e.g. Claude running this on your behalf
        after you've explicitly asked for it).
      - Never force-pushes. If the merge or push fails (conflicts, remote
        has diverged), it stops and leaves you to resolve it manually -
        nothing here overwrites or discards work.

.PARAMETER BranchName
    Name for the new branch, e.g. "ui/game-header-spacing" - follow this
    repo's category/name convention (ui/, feature/, game/) per
    docs/governance/guardrails.md.

.PARAMETER Message
    Commit message for the local changes.

.PARAMETER Force
    Skip the confirmation prompt. Use when you've already confirmed this
    exact action elsewhere (e.g. asked Claude to run it for you).

.EXAMPLE
    .\scripts\git\sync-branch.ps1 -BranchName "ui/card-hover-fix" -Message "fix(ui): correct hover state on card back"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BranchName,

    [Parameter(Mandatory = $true)]
    [string]$Message,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$status = git status --porcelain
if (-not $status) {
    Write-Host "No local changes to commit. Aborting."
    exit 1
}

Write-Host "About to commit the following onto '$BranchName', merge it into master, and push:"
git status --short

if (-not $Force) {
    $confirmation = Read-Host "Continue? [y/N]"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "Aborted."
        exit 1
    }
}

$originalBranch = git branch --show-current

git checkout -b $BranchName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not create branch '$BranchName' (does it already exist?). Aborting."
    exit 1
}

git add -A
git commit -m $Message

git checkout master
git merge --no-edit $BranchName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Merge failed - resolve conflicts manually on master, then push yourself."
    Write-Host "Your changes are safe on branch '$BranchName'."
    exit 1
}

git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed (remote may have diverged) - pull/rebase and push manually."
    Write-Host "Your changes are safe on master locally and on branch '$BranchName'."
    exit 1
}

Write-Host "Done. '$BranchName' merged into master and pushed."
Write-Host "(Started from '$originalBranch'; local branch '$BranchName' left in place.)"
