#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('assets/js/tabs-data.js', 'r', encoding='utf-8') as f:
    content = f.read()
data = json.loads(content[content.index('['):content.rindex(']')+1])

# 10.10 文件夹中的谱子来源
# Marcin Patrzalek Tabs/ → 鱼飞罗冰冻
# 未分类的杂物/ → 鱼飞罗冰冻
# 根目录 PDF → 鱼飞罗冰冻
# 其他已有的 → 保持不变

# 需要更新贡献者的条目 ID（10.10 新增的）
# 从 ID 4 到 92 都是 10.10 的（除了 undertale 9-20 是之前就有的）
# 实际上所有 10.10 的都应该改成鱼飞罗冰冻

# 先看看哪些是 10.10 的
# 10.10 包含：Marcin Patrzalek Tabs, 未分类的杂物, 根目录 PDFs
# 已有的旧条目（非 10.10）: undertale 9-20, 其他旧条目

# 策略：所有 contributor.name == 'fw' 的都改成鱼飞罗冰冻
# 但旧的 undertale 等也应该改成鱼飞罗冰冻（因为用户说 10.10 的所有谱子都是他）
# 等等，用户说的是 "10.10的所有吉他谱的贡献者都是鱼飞罗冰冻"
# 所以只更新 10.10 的条目

# 10.10 的条目特征：
# - Marcin Patrzalek 分类下的所有
# - 元子吉他 分类
# - 大树音乐屋 分类
# - 郑晟河 分类
# - 单曲 中的 The Ocean, Dreaming, Wings, Revolution 等
# - 未分类的杂物 中的图片

# 更简单的方法：所有 contributor 都是 fw 的，全部改成鱼飞罗冰冻
# 因为整个网站的谱子都是 fw 上传的

new_name = '鱼飞罗冰冻'
new_bilibili = 'https://space.bilibili.com/3461580647827891'

updated = 0
for item in data:
    if item['contributor'] and item['contributor'].get('name') == 'fw':
        item['contributor']['name'] = new_name
        item['contributor']['bilibili'] = new_bilibili
        updated += 1

print(f"Updated {updated} entries to contributor: {new_name}")

# Write back
with open('assets/js/tabs-data.js', 'w', encoding='utf-8') as f:
    f.write('const tabsData = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print("Done!")
