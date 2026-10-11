#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, subprocess, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('assets/js/tabs-data.js', 'r', encoding='utf-8') as f:
    content = f.read()
data = json.loads(content[content.index('['):content.rindex(']')+1])

# Use git ls-files -z for proper handling of special chars
result = subprocess.check_output(
    ['git', 'ls-files', '-z', 'assets/tabs/'],
    text=False  # Get raw bytes
)

# Split by null bytes
git_files_raw = result.split(b'\x00')
git_files = set()
for raw in git_files_raw:
    if raw:
        # Decode as UTF-8
        git_files.add(raw.decode('utf-8'))

# Build lowercase map
git_lower = {}
for f in git_files:
    git_lower[f.lower()] = f

# Fix all paths
fixed = 0
for item in data:
    for key in list(item['files'].keys()):
        if key == 'images':
            new_imgs = []
            for img in item['files'][key]:
                actual = git_lower.get(img.lower())
                if actual and actual != img:
                    new_imgs.append(actual)
                    fixed += 1
                else:
                    new_imgs.append(img)
            item['files'][key] = new_imgs
        else:
            path = item['files'][key]
            actual = git_lower.get(path.lower())
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
    for id_, title, path in missing[:10]:
        print(f"  [{id_}] {title}: {path}")
else:
    print("All paths match git repo!")
