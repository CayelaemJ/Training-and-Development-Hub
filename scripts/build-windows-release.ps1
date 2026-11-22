<#
.SYNOPSIS
  Publishes the CABO Learning Hub Windows client and builds its installer.

.DESCRIPTION
  1. Publishes the standard (never test-login) WinUI client, self-contained.
  2. Verifies the published binaries do not contain the isolated-test code path.
  3. Optionally Authenticode-signs the executable and installer when a
     certificate is supplied through WINDOWS_CERT_PFX_BASE64 and
     WINDOWS_CERT_PASSWORD. Without them the output is clearly marked UNSIGNED.
  4. Builds the Inno Setup installer and a portable zip, plus SHA-256 sums.

  Run on Windows with Visual Studio Build Tools (MSBuild) and Inno Setup 6.3+.
#>
param(
  [string]$Version = '1.1.0',
  [ValidateSet('x64', 'arm64')][string]$Arch = 'x64',
  [string]$OutDir = 'native-apps/windows/artifacts/release'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must be MAJOR.MINOR.PATCH, got '$Version'" }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = Join-Path $root 'native-apps/windows/CABO.Native/CABO.Native.csproj'
$platform = if ($Arch -eq 'arm64') { 'ARM64' } else { 'x64' }
$rid = "win-$Arch"
$publishDir = Join-Path $root "native-apps/windows/artifacts/publish/$rid"
$out = Join-Path $root $OutDir
Remove-Item -Recurse -Force $publishDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $publishDir, $out | Out-Null

Write-Host "Publishing CABO Learning Hub $Version ($rid, Release, standard sign-in only)"
& msbuild $project -restore -t:Publish -verbosity:minimal `
  "-p:Configuration=Release" "-p:Platform=$platform" "-p:RuntimeIdentifier=$rid" `
  "-p:SelfContained=true" "-p:CaboIsolatedTestBuild=false" "-p:CaboVersion=$Version" `
  "-p:PublishDir=$publishDir/"
if ($LASTEXITCODE -ne 0) { throw "msbuild publish failed ($LASTEXITCODE)" }

$exe = Join-Path $publishDir 'CABO.Native.exe'
if (-not (Test-Path $exe)) { throw "Published executable not found at $exe" }
$projectDir = Split-Path $project
$appPri = Get-ChildItem $publishDir -Filter '*.pri' -File | Where-Object { $_.Name -in 'CABO.Native.pri', 'resources.pri' }
if (-not $appPri) {
  Write-Host 'PRI/XBF files produced by the build (diagnostic):'
  Get-ChildItem $projectDir -Recurse -Include *.pri, *.xbf -File | ForEach-Object { Write-Host "  $($_.FullName.Substring($projectDir.Length))" }
  throw "Published output is missing the app PRI (CABO.Native.pri); the app would fail at startup."
}
foreach ($required in 'CABO.Native.Core.dll', 'Assets\cabo.ico') {
  if (-not (Test-Path (Join-Path $publishDir $required))) { throw "Published output is missing $required." }
}
$fileVersion = (Get-Item $exe).VersionInfo.FileVersion
if ($fileVersion -ne "$Version.0") { throw "Executable FileVersion '$fileVersion' does not match $Version.0" }

# The isolated password sign-in is compiled out of release builds; its
# environment-variable name must not appear anywhere in the shipped binaries.
# .NET stores string literals as UTF-16LE at any byte offset, so search the raw
# bytes (Latin-1 maps each byte to one char) for the NUL-interleaved pattern.
$needle = ('CABO_ISOLATED_TEST_ORIGIN'.ToCharArray() -join "`0")
$leak = Get-ChildItem $publishDir -Filter 'CABO.Native*' -File | Where-Object { $_.Extension -in '.dll', '.exe' } | Where-Object {
  [System.Text.Encoding]::Latin1.GetString([System.IO.File]::ReadAllBytes($_.FullName)).Contains($needle)
}
if ($leak) { throw "Release build contains the isolated test origin switch: $($leak.Name -join ', ')" }

function Invoke-Sign([string]$Path) {
  if (-not $env:WINDOWS_CERT_PFX_BASE64 -or -not $env:WINDOWS_CERT_PASSWORD) { return $false }
  $pfx = Join-Path ([System.IO.Path]::GetTempPath()) ('cabo-signing-' + [guid]::NewGuid().ToString('N') + '.pfx')
  try {
    [System.IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:WINDOWS_CERT_PFX_BASE64))
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
      Where-Object FullName -match '\\x64\\' | Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $signtool) { throw 'signtool.exe not found' }
    & $signtool.FullName sign /f $pfx /p $env:WINDOWS_CERT_PASSWORD /fd SHA256 /td SHA256 `
      /tr http://timestamp.digicert.com /d 'CABO Learning Hub' $Path
    if ($LASTEXITCODE -ne 0) { throw "signtool failed for $Path" }
    return $true
  } finally { Remove-Item $pfx -Force -ErrorAction SilentlyContinue }
}

$signed = Invoke-Sign $exe

$iscc = @(
  (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 (ISCC.exe) is required to build the installer.' }

& $iscc "/DAppVersion=$Version" "/DSourceDir=$publishDir" "/DOutputDir=$out" "/DArch=$Arch" `
  (Join-Path $root 'native-apps/windows/installer/CABOLearningHub.iss')
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed ($LASTEXITCODE)" }

$installer = Join-Path $out "CABO-LearningHub-Setup-$Version-$Arch.exe"
if (-not (Test-Path $installer)) { throw "Installer not produced at $installer" }
if ($signed) { [void](Invoke-Sign $installer) }

$portable = Join-Path $out "CABO-LearningHub-$Version-$Arch-portable.zip"
Compress-Archive -Path (Join-Path $publishDir '*') -DestinationPath $portable -Force

$status = if ($signed) { 'SIGNED' } else { 'UNSIGNED — Windows SmartScreen will warn; not for production distribution' }
Set-Content -Path (Join-Path $out 'SIGNING_STATUS.txt') -Value "CABO Learning Hub $Version ($Arch): $status"
Copy-Item (Join-Path $root 'native-apps/windows/RELEASE_NOTES.md') $out -Force

Get-ChildItem $out -File -Include *.exe, *.zip -Recurse | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
} | Set-Content (Join-Path $out 'SHA256SUMS.txt')

Write-Host "Installer: $installer ($status)"
Write-Host "Portable:  $portable"
