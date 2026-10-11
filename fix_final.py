#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, subprocess, sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('assets/js/tabs-data.js', 'r', encoding='utf-8') as f:
    content = f.read()
data = json.loads(content[content.index('['):content.rindex(']')+1])

result = subprocess.check_output(
    ['git', 'ls-tree', '--name-only', '-r', 'HEAD', '--', 'assets/tabs/'],
    text=True, encoding='utf-8'
)

git_files = set()
for line in result.strip().split('\n'):
    if line:
        if line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
            # Decode octal escapes: \357 -> byte 0xEF
            i = 0
            decoded = ''
            while i < len(line):
                if i + 3 < len(line) and line[i] == '\\' and line[i+1:i+4].isdigit():
                    byte_val = int(line[i+1:i+4], 8)
                    decoded += chr(byte_val)
                    i += 4
                else:
                    decoded += line[i]
                    i += 1
            line = decoded
        git_files.add(line)

# Build exact map
git_exact = {f: f for f in git_files}

# Fix all paths
fixed = 0
for item in data:
    for key in list(item['files'].keys()):
        if key == 'images':
            new_imgs = []
            for img in item['files'][key]:
                actual = git_exact.get(img)
                if not actual:
                    # Try case-insensitive
                    for gf in git_files:
                        if gf.lower() == img.lower():
                            actual = gf
                            break
                if actual and actual != img:
                    new_imgs.append(actual)
                    fixed += 1
                else:
                    new_imgs.append(img)
            item['files'][key] = new_imgs
        else:
            path = item['files'][key]
            actual = git_exact.get(path)
            if not actual:
                for gf in git_files:
                    if gf.lower() == path.lower():
                        actual = gf
                        break
            if actual and actual != path:
                item['files'][key] = actual
                fixed += 1

with open('assets/js/tabs-data.js', 'w', encoding='utf-8') as f:
    f.write('const tabsData = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print(f"Fixed {fixed} paths")

# Verify
missing = []
for item in data:
    for key, path in item['files'].items():
        if key == 'images':
            for img in path:
                if img not in git_files:
                    missing.append((item['id'], item['title'], img))
        else:
            if path not in git_files:
                missing.append((item['id'], item['title'], path))

if missing:
    print(f"Missing: {len(missing)}")
    for id_, title, path in missing[:5]:
        print(f"  [{id_}] {title}: {path}")
else:
    print("All paths match git repo!")
