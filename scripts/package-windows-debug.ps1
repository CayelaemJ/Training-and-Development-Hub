$ErrorActionPreference = 'Stop'
$target = Get-ChildItem "native-apps/windows/CABO.Native/bin" -Recurse -Filter "CABO.Native.exe" -File | Select-Object -First 1
if (-not $target) { throw "Compiled WinUI executable not found" }
$folder = $target.Directory.FullName
New-Item -ItemType Directory -Force "native-apps/windows/artifacts" | Out-Null
Compress-Archive -Path (Join-Path $folder '*') -DestinationPath "native-apps/windows/artifacts/CABO-Windows-DEBUG-test-only.zip" -Force
