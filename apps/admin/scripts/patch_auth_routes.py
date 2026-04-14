from pathlib import Path

root = Path('app/api/v1')
patterns = [
    (
        'const userId = Number(req.headers.get("x-user-id"));\n  if (!userId) return err("Unauthorized", 401);',
        'const auth = await requireAuth(req);\n  if (!auth) return err("Unauthorized", 401);\n  const userId = auth.userId;'
    ),
    (
        'const currentUserId = Number(req.headers.get("x-user-id"));\n  if (!currentUserId) return err("Unauthorized", 401);',
        'const auth = await requireAuth(req);\n  if (!auth) return err("Unauthorized", 401);\n  const currentUserId = auth.userId;'
    ),
    (
        'const adminId = Number(req.headers.get("x-user-id"));\n  if (!adminId) return err("Unauthorized", 401);',
        'const auth = await requireRole(req, ["admin"]);\n  if (!auth) return err("Forbidden", 403);\n  const adminId = auth.userId;'
    ),
]

import_line = 'import { requireAuth, requireRole } from "@/lib/auth";\n'

def add_imports(content, need_auth, need_role):
    if not (need_auth or need_role):
        return content
    if 'from "@/lib/auth"' in content:
        return content
    lines = content.splitlines(True)
    for i, line in enumerate(lines):
        if line.startswith('import ') and i + 1 < len(lines) and not lines[i + 1].startswith('import '):
            lines.insert(i + 1, import_line)
            return ''.join(lines)
    return import_line + content

for path in root.rglob('*.ts'):
    text = path.read_text(encoding='utf-8')
    original = text
    if 'req.headers.get("x-user-id")' not in text and "req.headers.get('x-user-id')" not in text:
        continue
    need_auth = False
    need_role = False
    for old, new in patterns:
        if old in text:
            text = text.replace(old, new)
            if 'requireAuth' in new:
                need_auth = True
            if 'requireRole' in new:
                need_role = True
    if text != original:
        text = add_imports(text, need_auth, need_role)
        path.write_text(text, encoding='utf-8')
        print(f'Patched {path}')
