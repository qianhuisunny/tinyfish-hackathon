"""Create a source-only runnable archive; never include runtime data or credentials."""
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/tinyfish-app.zip')
files = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(files)):
        if not name or name.startswith(('data/', 'node_modules/', '.git/', '.superpowers/')):
            continue
        if Path(name).name.startswith('.env') and name != '.env.example':
            continue
        if name.endswith(('.zip', '.log')):
            continue
        path = root / name
        if path.is_file():
            archive.write(path, name)
print(output)
