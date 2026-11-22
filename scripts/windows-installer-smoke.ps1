<#
.SYNOPSIS
  Installs, launches, upgrades-in-place and uninstalls the CABO Learning Hub
  installer on a clean Windows runner, failing on any unexpected result.

.DESCRIPTION
  This is a smoke test, not a substitute for testing on school devices. It
  does not sign in (no credentials are available in CI) and uses no learner data.
#>
param(
  [Parameter(Mandatory)][string]$Installer,
  [Parameter(Mandatory)][string]$Version
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$appDir = Join-Path $env:LOCALAPPDATA 'Programs\CABO Learning Hub'
$exe = Join-Path $appDir 'CABO.Native.exe'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{6C1C2F2E-4B7A-4E0B-9D3C-CAB0A11E2026}_is1'
$dataDir = Join-Path $env:LOCALAPPDATA 'CABO\LearningHub'
$logDir = Join-Path $env:RUNNER_TEMP 'cabo-smoke'
New-Item -ItemType Directory -Force $logDir | Out-Null

function Install-Once([string]$Label) {
  $p = Start-Process -FilePath $Installer -Wait -PassThru -ArgumentList @(
    '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER', "/LOG=$logDir\install-$Label.log")
  if ($p.ExitCode -ne 0) { throw "Installer ($Label) exited with $($p.ExitCode)" }
  if (-not (Test-Path $exe)) { throw "Executable missing after install ($Label): $exe" }
  if (-not (Test-Path $uninstallKey)) { throw "Uninstall registration missing after install ($Label)" }
  $display = (Get-ItemProperty $uninstallKey).DisplayVersion
  if ($display -ne $Version) { throw "Registered version '$display' != '$Version'" }
  $fv = (Get-Item $exe).VersionInfo.FileVersion
  if ($fv -ne "$Version.0") { throw "Installed FileVersion '$fv' != '$Version.0'" }
  Write-Host "Install ($Label) OK: $exe v$fv"
}

Install-Once 'first'

# Launch: the window must start and stay alive without writing a crash log.
Remove-Item (Join-Path $dataDir 'logs') -Recurse -Force -ErrorAction SilentlyContinue
$app = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 15
$app.Refresh()
if ($app.HasExited) { throw "App exited during startup with code $($app.ExitCode)" }
$crash = Join-Path $dataDir 'logs\app.log'
if (Test-Path $crash) { Get-Content $crash | Write-Host; throw 'App wrote a crash log during startup' }
Write-Host "Launch OK: process $($app.Id) running, working set $([math]::Round($app.WorkingSet64 / 1MB)) MB"
Stop-Process -Id $app.Id -Force
Start-Sleep -Seconds 2

# Upgrade path: re-running the same installer over an existing install must succeed.
Install-Once 'reinstall'

# Simulate a stored session file to prove uninstall removes local app data.
New-Item -ItemType Directory -Force $dataDir | Out-Null
Set-Content (Join-Path $dataDir 'native-session.bin') 'placeholder-not-a-real-session'

$uninstaller = Join-Path $appDir 'unins000.exe'
if (-not (Test-Path $uninstaller)) { throw 'Uninstaller not found' }
$u = Start-Process -FilePath $uninstaller -Wait -PassThru -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART')
if ($u.ExitCode -ne 0) { throw "Uninstaller exited with $($u.ExitCode)" }
# The uninstaller copies itself to temp and finishes asynchronously.
for ($i = 0; $i -lt 30 -and ((Test-Path $exe) -or (Test-Path $uninstallKey)); $i++) { Start-Sleep -Seconds 1 }
if (Test-Path $exe) { throw 'Executable still present after uninstall' }
if (Test-Path $uninstallKey) { throw 'Uninstall registration still present after uninstall' }
if (Test-Path $dataDir) { throw 'Local session/log directory still present after uninstall' }
Write-Host 'Uninstall OK: files, registration and local session data removed'
