"""Print the directory of a stable Xcode with an App Store-eligible SDK."""

import os
from pathlib import Path
import re
import subprocess
import sys


def sdk_version(directory: Path) -> tuple[int, ...]:
    result = subprocess.run(
        ["xcrun", "--sdk", "iphoneos", "--show-sdk-version"],
        env={**os.environ, "DEVELOPER_DIR": str(directory)},
        capture_output=True,
        text=True,
        check=False,
    )
    version = result.stdout.strip()
    if result.returncode or not re.fullmatch(r"\d+(?:\.\d+)*", version):
        return ()
    return tuple(map(int, version.split(".")))


directories = {
    path / "Contents/Developer"
    for path in Path("/Applications").glob("Xcode*.app")
    if re.fullmatch(r"Xcode(?:_\d+(?:\.\d+)*)?\.app", path.name)
}
configured = os.environ.get("DEVELOPER_DIR")
if configured:
    directories.add(Path(configured))
else:
    selected = subprocess.run(
        ["xcode-select", "-p"], capture_output=True, text=True, check=False
    )
    if not selected.returncode:
        directories.add(Path(selected.stdout.strip()))

eligible = []
for directory in directories:
    version = sdk_version(directory)
    if version and version[0] >= 26:
        xcode = subprocess.run(
            ["xcodebuild", "-version"],
            env={**os.environ, "DEVELOPER_DIR": str(directory)},
            capture_output=True,
            text=True,
            check=False,
        )
        match = re.match(r"Xcode (\d+)", xcode.stdout)
        if not xcode.returncode and match and int(match[1]) >= 26:
            eligible.append((version, directory))

if not eligible:
    sys.exit("No Xcode 26 or newer with the iOS 26 SDK or newer is installed.")
print(max(eligible)[1])
