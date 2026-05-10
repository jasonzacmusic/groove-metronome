$ErrorActionPreference = "Stop"

Write-Host "Groove Metronome Plugin Installer"
Write-Host "Nathaniel School of Music"
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Candidates = @(
  (Join-Path $ScriptDir "Windows\Groove Metronome.vst3"),
  (Join-Path $ScriptDir "..\package\Windows\Groove Metronome.vst3"),
  (Join-Path $ScriptDir "..\build\GrooveMetronomePlugin_artefacts\Release\VST3\Groove Metronome.vst3")
)

$Source = $null
foreach ($Candidate in $Candidates) {
  if (Test-Path $Candidate) {
    $Source = $Candidate
    break
  }
}

if ($null -eq $Source) {
  Write-Host "Could not find Groove Metronome.vst3 next to the installer."
  Write-Host "Expected Windows\Groove Metronome.vst3."
  exit 1
}

$DestinationRoot = Join-Path $env:CommonProgramFiles "VST3"
$Destination = Join-Path $DestinationRoot "Groove Metronome.vst3"

try {
  New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
  if (Test-Path $Destination) {
    Remove-Item $Destination -Recurse -Force
  }
  Copy-Item $Source $Destination -Recurse -Force
  Write-Host ""
  Write-Host "Installed successfully:"
  Write-Host $Destination
} catch {
  Write-Host ""
  Write-Host "Could not write to the system VST3 folder."
  Write-Host "Run PowerShell as Administrator, or copy this folder manually:"
  Write-Host $Source
  Write-Host "to:"
  Write-Host $Destination
  exit 1
}

Write-Host ""
Write-Host "Open your DAW and rescan VST3 plugins."
Write-Host "Reaper: Preferences > Plug-ins > VST > Re-scan."
Write-Host ""
Read-Host "Press Enter to close this installer"
