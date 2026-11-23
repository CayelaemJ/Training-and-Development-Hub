"""Check 64-bit native library load segments in Android release packages."""

from pathlib import Path
import subprocess
import sys
import tempfile
from zipfile import ZipFile


for package in map(Path, sys.argv[1:]):
    libraries_checked = 0
    with ZipFile(package) as archive, tempfile.TemporaryDirectory() as directory:
        library = Path(directory) / "library.so"
        for entry in archive.namelist():
            parts = entry.split("/")
            if len(parts) < 3 or parts[-3] != "lib" or not entry.endswith(".so"):
                continue
            if parts[-2] not in ("arm64-v8a", "x86_64"):
                continue
            library.write_bytes(archive.read(entry))
            headers = subprocess.check_output(
                ["readelf", "--wide", "--program-headers", library], text=True
            )
            alignments = [
                int(columns[-1], 16)
                for line in headers.splitlines()
                if (columns := line.split()) and columns[0] == "LOAD"
            ]
            if not alignments or min(alignments) < 16384:
                sys.exit(f"{package.name}: {entry} lacks 16 KB load-segment alignment")
            libraries_checked += 1
    print(f"{package.name}: verified {libraries_checked} 64-bit native libraries")
