# 吉他谱分享站 — 项目记录与评估

## 1. 项目概述

| 项目 | 说明 |
|------|------|
| **名称** | 吉他谱分享站 (fwjita) |
| **网址** | https://fwjita.cc.cd (Cloudflare Pages) |
| **API** | https://fwjita-share.ss20211111705.workers.dev |
| **仓库** | https://github.com/cleanwrite/fwjita-share |
| **技术栈** | 原生 HTML/CSS/JS + alphaTab v1.8.4 (GPX渲染) |
| **后端** | Cloudflare Workers + KV |
| **数据格式** | GPX / PDF / 图片 (jpg/png/webp) |
| **域名** | fwjita.cc.cd (Cloudflare Pages 自定义域名) |

## 2. 当前数据

### 分类统计

| 分类 | 数量 | 贡献者 |
|------|------|--------|
| Marcin Patrzalek | 48 | 鱼飞罗冰冻 |
| undertale | 12 | fw |
| 单曲 | 17 | fw |
| 元子吉他 | 3 | 鱼飞罗冰冻 |
| 郑晟河 | 3 | fw(1) + 鱼飞罗冰冻(2) |
| 大树音乐屋 | 2 | 鱼飞罗冰冻 |
| 明日方舟 | 2 | fw |
| 黑暗之魂 | 2 | fw |
| 千与千寻 | 1 | fw |
| 寒蝉鸣泣之时 | 1 | fw |
| 我的世界 | 1 | fw |
| **总计** | **92** | fw(37) + 鱼飞罗冰冻(55) |

### 贡献者

| 姓名 | B站 | 谱子数 |
|------|-----|--------|
| fw | https://space.bilibili.com/590547783 | 37 |
| 鱼飞罗冰冻 | https://space.bilibili.com/3461580647827891 | 55 |

## 3. 功能清单

### 已实现 ✅
- [x] 三级导航：分类 → 歌曲列表 → 版本选择
- [x] GPX 乐谱渲染 (alphaTab v1.8.4, SVG 引擎)
- [x] PDF 预览 (iframe 嵌入)
- [x] 图片画廊 (lazy loading, 点击放大)
- [x] 搜索（分类内搜索，防抖 150ms）
- [x] 提交谱子（JSON 格式，base64 文件上传，密码鉴权）
- [x] 管理员面板（查看/删除谱子/操作日志/清空日志）
- [x] 致谢墙（贡献者列表，含 B站链接）
- [x] 移动端适配（响应式布局，谱名溢出修复）
- [x] 键盘无障碍 (ESC关闭弹窗, Tab焦点陷阱)
- [x] 贡献者 B站链接（点击不误触预览）
- [x] 操作日志（KV 存储，最近 100 条）
- [x] 原子性更新 tabs-data.js（SHA 冲突重试 3 次）
- [x] GitHub Actions 自动部署 Worker
- [x] CI/CD secret 管理（GITHUB_TOKEN + SUBMIT_PASSWORD）

### 待实现 🔧
- [ ] 缩略图/预览图
- [ ] 拼音搜索/模糊匹配
- [ ] 自定义域名路由 (fwjita.de5.net)
- [ ] 管理员 Tab 切换 active 状态修复

## 4. 架构

```
用户 → Cloudflare Pages (静态站点, fwjita.cc.cd)
         ↓ API调用 (fetch)
       Cloudflare Worker (fwjita-share.ss20211111705.workers.dev)
         ↓ 读取
       GitHub API (tabs-data.js + 文件)
         ↓ 写入 (需 GITHUB_TOKEN)
       GitHub API (提交新谱子)
         ↓ 缓存
       Cloudflare KV (操作日志/提交锁)
```

### CI/CD 流程

```
git push → GitHub Actions → wrangler-action@v3 → Cloudflare Workers
                ↓ env 注入
          GITHUB_TOKEN (来自 GitHub Secrets)
          SUBMIT_PASSWORD = 114514
```

### 关键文件

| 文件 | 说明 |
|------|------|
| `index.html` | 主页面（header, toolbar, modal, footer） |
| `assets/js/main.js` | 核心逻辑（~900行，状态管理/导航/搜索/预览） |
| `assets/js/tabs-data.js` | 谱子数据（92条，JSON 数组） |
| `assets/css/style.css` | 样式（~1050行，暗色主题） |
| `assets/css/tokens.css` | 设计令牌（颜色/间距/字体） |
| `fwjita-worker/worker.js` | Worker 代理 + API（~520行） |
| `fwjita-worker/wrangler.toml` | Worker 配置 |
| `.github/workflows/deploy-worker.yml` | GitHub Actions 自动部署 |

## 5. API 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/categories | 无 | 返回分类列表 |
| POST | /api/submit | SUBMIT_PASSWORD | 提交新谱子（JSON + base64 文件） |
| GET | /api/tabs-data | ADMIN_PASSWORD | 返回完整 tabs-data |
| DELETE | /api/tabs/:id | ADMIN_PASSWORD | 删除谱子 |
| GET | /api/admin/logs | ADMIN_PASSWORD | 查看操作日志 |
| POST | /api/admin/logs/clear | ADMIN_PASSWORD | 清空操作日志 |

## 6. 已知问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 自定义域名路由 | 🟡 | `fwjita.de5.net` 无法路由到 Worker（de5.net 不在 Cloudflare 账户） |
| 无缩略图 | 🟡 | 图片谱子列表无预览图 |
| 搜索不支持拼音 | 🟡 | 仅支持中文/英文精确匹配 |
| 管理员 Tab 切换 | 🟡 | active 状态可能不更新 |

## 7. Git 历史（关键提交）

| 提交 | 说明 |
|------|------|
| 87adc09 | 重新组织 Marcin Patrzalek 谱子（48首正确分类） |
| 76970c8 | 修复关闭按钮/去除作者名 |
| d0056ef | 全面清理：标题修复/搜索范围/返回逻辑 |
| 146c6cc | 修复提交/管理功能（FormData → JSON） |
| 1dc02ef | 移动端优化（谱名溢出、误触） |
| 8c45ccd | 恢复贡献者 B站链接 |
| 571c5e9 | 合并游戏音乐/朱一丹到单曲 |
| 53271b9 | 修复贡献者分配（10.10 → 鱼飞罗冰冻） |
| 5a3f981 | 修复误触（点击卡片不跳转 B站） |
| ef96829 | 修复 tabs-data.js 路径（大小写敏感） |
| fdd37a4 | 添加 GitHub Actions workflow |
| d9e2aae | Worker 代码移入主 repo |
| e837c04 | 清理测试数据 |

## 8. 技术债务

1. **tabs-data.js 体积** — 92 条数据，每次加载完整 JSON（可接受）
2. **无构建步骤** — 纯原生 JS，无打包/压缩
3. **Worker 冷启动** — 无影响（低流量）

## 9. 安全

- ✅ 提交密码鉴权（常量时间比较）
- ✅ 管理员密码鉴权（Bearer token）
- ✅ XSS 防护（escapeHtml）
- ✅ CORS 配置
- ✅ 文件类型白名单
- ✅ 文件大小限制（10MB/文件，50MB/总计）
- ✅ 路径安全（sanitizePath）
- ✅ CI/CD secret 管理（GitHub Actions Secrets）

## 10. 性能

- alphaTab 渲染：同步加载，useWorkers: false
- 图片：lazy loading
- 搜索：防抖 150ms
- 缓存：静态资源 5min，HTML no-cache
- Worker 部署：GitHub Actions 自动触发

## 11. 部署说明

### 自动部署（推荐）
```bash
git push origin main
# GitHub Actions 自动部署 Worker
```

### 手动部署
```bash
cd fwjita-worker
wrangler deploy
wrangler secret put GITHUB_TOKEN
wrangler secret put SUBMIT_PASSWORD
```

### 密码
- 提交/管理密码：`114514`
