# scripts/assets/convert-heic-winrt.ps1
#
# One-off dev tool, Windows-only: decodes a HEIC/HEIF file via the OS's own WinRT imaging
# pipeline (Windows.Graphics.Imaging.BitmapDecoder/BitmapEncoder) and writes it out as PNG.
#
# Why this exists instead of a Node/sharp script like the rest of scripts/: sharp's bundled
# libvips, and the actively-maintained libheif-js WASM decoder, both fail identically on some
# Photoroom-sourced HEIC files with "Unsupported image type: Image item of type 'unci' is not
# supported" — 'unci' is the ISO/IEC 23001-17:2024 "uncompressed image" HEIF item type, and
# decoding it depends on an "uncompressed" codec plugin that neither of those builds ships
# enabled. Windows' own HEIF codec (used here via WinRT) decodes it fine, so this is the only
# reliable decoder available on this machine for that specific case.
#
# This is NOT part of the app build and is not reproducible on non-Windows machines — it's a
# manual fallback for the rare stray HEIC that slips through. The real fix is avoiding HEIC at
# the source (Photoroom only exports PNG/JPEG/WebP — check its export-format setting if a HEIC
# shows up unexpectedly; something else in the save/share pipeline produced it, not Photoroom).
#
# Usage: powershell -File scripts/assets/convert-heic-winrt.ps1 -InputPath <path.heic> -OutputPath <path.png>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1
})[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 0
})[0]

# WinRT async calls (IAsyncOperation<T>/IAsyncAction) aren't .NET Tasks by default in
# PowerShell — AsTask() is an extension method that only becomes callable via reflection once
# the assembly above is loaded, hence the explicit MakeGenericMethod/Invoke dance below instead
# of a normal `.AsTask()` call.
function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

function AwaitAction($WinRtAction) {
    $netTask = $asTaskAction.Invoke($null, @($WinRtAction))
    $netTask.Wait(-1) | Out-Null
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}
New-Item -ItemType File -Path $OutputPath | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $OutputPath).Path

$inputFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedInput)) ([Windows.Storage.StorageFile])
$inputStream = Await ($inputFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($inputStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$outputFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedOutput)) ([Windows.Storage.StorageFile])
$outputStream = Await ($outputFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
$encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::PngEncoderId, $outputStream)) ([Windows.Graphics.Imaging.BitmapEncoder])
$encoder.SetSoftwareBitmap($softwareBitmap)
AwaitAction ($encoder.FlushAsync())

$outputStream.Dispose()
$inputStream.Dispose()

Write-Host "Converted $resolvedInput -> $resolvedOutput"
