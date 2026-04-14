from pathlib import Path

root = Path('app/api/v1')
old = 'import { requireAuth, requireRole } from "@/lib/auth";'
for path in root.rglob('*.ts'):
    text = path.read_text(encoding='utf-8')
    if old not in text:
        continue
    uses_role = 'requireRole(' in text
    uses_auth = 'requireAuth(' in text
    if uses_auth and uses_role:
        continue
    if uses_auth:
        text = text.replace(old, 'import { requireAuth } from "@/lib/auth";')
    elif uses_role:
        text = text.replace(old, 'import { requireRole } from "@/lib/auth";')
    path.write_text(text, encoding='utf-8')
    print(f'Cleaned import in {path}')
