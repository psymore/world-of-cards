<#
.SYNOPSIS
    Stage and commit all local changes to the current branch. Nothing else.

.DESCRIPTION
    The lightweight sibling to sync-branch.ps1: just `git add -A` + `git commit`
    on whatever branch you're already on — no new branch, no merge, no push.
    Use this when you want to save progress without doing the full
    branch/merge/push sync.

    Safety:
      - Refuses to run if there are no local changes to commit.
      - Shows `git status --short` and asks for confirmation before committing,
        unless -Force is passed (for when the confirmation already happened in
        conversation, e.g. Claude running this on your behalf after you've
        explicitly asked for it).
      - Never touches branches, merges, or the remote.

.PARAMETER Message
    Commit message for the local changes.

.PARAMETER Force
    Skip the confirmation prompt.

.EXAMPLE
    .\scripts\git\commit-changes.ps1 -Message "wip: card hover state"
#>

param(
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

$currentBranch = git branch --show-current

Write-Host "About to commit the following to '$currentBranch':"
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

Write-Host "Done. Committed to '$currentBranch'."
