$ErrorActionPreference = 'Stop'
# Package only the standard Debug build (never the isolated test-login variant
# or a Release publish that may also exist under bin/).
$target = Get-ChildItem "native-apps/windows/CABO.Native/bin" -Recurse -Filter "CABO.Native.exe" -File |
  Where-Object { $_.FullName -match '[\\/]Debug[\\/]' } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $target) { throw "Compiled WinUI Debug executable not found" }
$folder = $target.Directory.FullName
New-Item -ItemType Directory -Force "native-apps/windows/artifacts" | Out-Null
Compress-Archive -Path (Join-Path $folder '*') -DestinationPath "native-apps/windows/artifacts/CABO-Windows-DEBUG-no-test-login.zip" -Force
