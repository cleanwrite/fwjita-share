#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('assets/js/tabs-data.js', 'r', encoding='utf-8') as f:
    content = f.read()
data = json.loads(content[content.index('['):content.rindex(']')+1])

# Remove test entries (category or title contains 测试)
original_count = len(data)
data = [item for item in data if '测试' not in item['title'] and '测试' not in item['category'] and '测试' not in item['song_group']]

# Re-number IDs
for i, item in enumerate(data):
    item['id'] = i + 1

with open('assets/js/tabs-data.js', 'w', encoding='utf-8') as f:
    f.write('const tabsData = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print(f"Removed {original_count - len(data)} test entries, {len(data)} remaining")
