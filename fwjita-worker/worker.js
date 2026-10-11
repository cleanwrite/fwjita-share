// 🎸 吉他谱站 Worker：反代 GitHub Pages + 提交/管理 API
//
// 路由：
//   GET  /api/categories     → 返回分类列表
//   POST /api/submit         → 提交新谱子（需 SUBMIT_PASSWORD）
//   GET  /api/tabs-data      → 返回原始 tabs-data（需 ADMIN_PASSWORD）
//   DELETE /api/tabs/:id     → 删除谱子（需 ADMIN_PASSWORD）
//   GET  /api/admin/logs     → 查看操作日志（需 ADMIN_PASSWORD）
/*  其他                     → 反代 GitHub Pages */

const GITHUB_PAGES = "https://cleanwrite.github.io/fwjita-share";
const GITHUB_API = "https://api.github.com/repos/cleanwrite/fwjita-share";
const ALLOWED_EXT = {
  gpx: [".gp", ".gp3", ".gp4", ".gp5", ".gp7", ".gp8", ".gpx"],
  pdf: [".pdf"],
  jpg: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // API 路由
    if (url.pathname === "/api/categories" && request.method === "GET") {
      return await handleGetCategories(env);
    }
    if (url.pathname === "/api/submit" && request.method === "POST") {
      return await handleSubmit(request, env);
    }
    if (url.pathname === "/api/tabs-data" && request.method === "GET") {
      if (!await checkAdminAuth(request, env)) return jsonResponse({ error: "未授权" }, 403);
      return await handleGetTabsData(env);
    }
    if (url.pathname.startsWith("/api/tabs/") && request.method === "DELETE") {
      if (!await checkAdminAuth(request, env)) return jsonResponse({ error: "未授权" }, 403);
      const id = parseInt(url.pathname.split("/").pop());
      return await handleDeleteTab(id, env);
    }
    if (url.pathname === "/api/admin/logs" && request.method === "GET") {
      if (!await checkAdminAuth(request, env)) return jsonResponse({ error: "未授权" }, 403);
      return await handleGetLogs(env);
    }

    // 反代 GitHub Pages
    return await proxyToGitHub(request, url);
  }
};

// ===== 获取分类列表 =====
async function handleGetCategories(env) {
  try {
    const tabsData = await fetchTabsData(env);
    const categories = [...new Set(tabsData.map(t => t.category))].sort();
    return jsonResponse({ success: true, categories });
  } catch (e) {
    return jsonResponse({ success: false, error: "获取分类失败" }, 500);
  }
}

// ===== 获取 tabs-data =====
async function handleGetTabsData(env) {
  try {
    const tabsData = await fetchTabsData(env);
    return jsonResponse({ success: true, count: tabsData.length, data: tabsData });
  } catch (e) {
    return jsonResponse({ success: false, error: "获取数据失败" }, 500);
  }
}

// ===== 删除谱子 =====
async function handleDeleteTab(id, env) {
  try {
    const tabsData = await fetchTabsData(env);
    const idx = tabsData.findIndex(t => t.id === id);
    if (idx === -1) return jsonResponse({ success: false, error: "谱子不存在" }, 404);

    const tab = tabsData[idx];
    // 删除关联文件
    const filesToDelete = [];
    if (tab.files.gpx) filesToDelete.push(tab.files.gpx);
    if (tab.files.pdf) filesToDelete.push(tab.files.pdf);
    if (tab.files.images) filesToDelete.push(...tab.files.images);

    for (const filePath of filesToDelete) {
      await deleteFileFromGitHub(env, filePath);
    }

    // 删除空目录
    const dirPath = `assets/tabs/${tab.category}/${tab.song_group || tab.title}`;
    await tryDeleteDir(env, dirPath);

    // 更新 tabs-data.js
    tabsData.splice(idx, 1);
    await updateTabsData(env, tabsData, `Delete tab: ${tab.title} (id=${id})`);

    // 记录日志
    await appendLog(env, { action: "delete", tabId: id, title: tab.title, time: new Date().toISOString() });

    return jsonResponse({ success: true, message: `已删除 "${tab.title}"` });
  } catch (e) {
    return jsonResponse({ success: false, error: "删除失败" }, 500);
  }
}

// ===== 获取操作日志 =====
async function handleGetLogs(env) {
  try {
    const logs = await getLogs(env);
    return jsonResponse({ success: true, logs });
  } catch (e) {
    return jsonResponse({ success: false, error: "获取日志失败" }, 500);
  }
}

// ===== 提交新谱子 =====
async function handleSubmit(request, env) {
  // 检查 GITHUB_TOKEN
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ success: false, error: "服务器未配置 GITHUB_TOKEN，提交功能暂不可用" }, 503);
  }

  try {
    const contentType = request.headers.get("Content-Type") || "";

    let category, songGroup, contributor, bilibili, password;
    let files = [];

    if (contentType.includes("application/json")) {
      // JSON 格式提交（推荐，避免编码问题）
      const json = await request.json();
      category = sanitizePath(json.category?.trim() || "");
      songGroup = sanitizePath(json.songGroup?.trim() || "");
      contributor = sanitizeName(json.contributor?.trim() || "");
      bilibili = (json.bilibili || "").trim();
      password = json.password || "";

      // 文件以 base64 编码
      if (json.files && Array.isArray(json.files)) {
        for (const f of json.files) {
          if (f.base64 && f.name) {
            files.push({ name: f.name, base64: f.base64 });
          }
        }
      }
    } else {
      // FormData 格式提交（兼容旧版）
      const formData = await request.formData();
      password = formData.get("password");
      category = sanitizePath(formData.get("category")?.toString().trim() || "");
      songGroup = sanitizePath(formData.get("songGroup")?.toString().trim() || "");
      contributor = sanitizeName(formData.get("contributor")?.toString().trim() || "");
      bilibili = formData.get("bilibili")?.toString().trim() || "";

      const fileEntries = formData.getAll("files");
      for (const value of fileEntries) {
        if (value instanceof File) {
          files.push({ name: value.name, file: value });
        }
      }
    }

    // 验证密码（常量时间比较）
    if (!await timingSafeEqual(password?.toString() || "", env.SUBMIT_PASSWORD?.toString() || "")) {
      return jsonResponse({ success: false, error: "密码错误" }, 403);
    }

    if (!category || !songGroup) {
      return jsonResponse({ success: false, error: "分类和歌曲名不能为空" }, 400);
    }

    if (files.length === 0) {
      return jsonResponse({ success: false, error: "请至少上传一个文件" }, 400);
    }

    // 并发生锁检查
    const lockKey = "submit_lock";
    const lock = await env.KV_LOCK?.get(lockKey);
    if (lock) {
      return jsonResponse({ success: false, error: "系统繁忙，请稍后重试" }, 429);
    }

    try {
      // 设置锁（60秒过期防止死锁）
      await env.KV_LOCK?.put(lockKey, "1", { expirationTtl: 60 });

      // 上传文件到 GitHub
      const uploadedFiles = [];
      const formats = new Set();

      for (const f of files) {
        const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
        let fileType = null;
        for (const [type, exts] of Object.entries(ALLOWED_EXT)) {
          if (exts.includes(ext)) { fileType = type; break; }
        }
        if (!fileType) {
          return jsonResponse({ success: false, error: `不支持的文件格式: ${f.name}` }, 400);
        }

        let base64Content;
        if (f.base64) {
          // JSON 格式：直接使用 base64
          base64Content = f.base64;
        } else {
          // FormData 格式：从 File 对象读取
          const buffer = await f.file.arrayBuffer();
          base64Content = base64Encode(buffer);
        }

        const safeName = sanitizeFilename(f.name);
        const filePath = `assets/tabs/${category}/${songGroup}/${safeName}`;

        const uploaded = await uploadToGitHub(env, filePath, base64Content, `Add ${songGroup} - ${safeName}`);
        if (!uploaded) return jsonResponse({ success: false, error: `上传失败: ${f.name}` }, 500);

        uploadedFiles.push({ name: safeName, path: filePath, type: fileType });
        formats.add(fileType);
      }

      // 原子性更新 tabs-data.js
      const result = await atomicUpdateTabsData(env, (tabsData) => {
        const newId = Math.max(0, ...tabsData.map(t => t.id || 0)) + 1;
        const newEntry = {
          id: newId,
          title: songGroup,
          artist: "",
          formats: [...formats],
          files: buildFilesObject(uploadedFiles),
          category,
          song_group: songGroup,
          contributor: { name: contributor || "匿名", bilibili },
        };
        tabsData.push(newEntry);
        return newEntry;
      });

      // 记录日志
      await appendLog(env, {
        action: "submit",
        tabId: result.entry.id,
        title: result.entry.title,
        category,
        contributor: contributor || "匿名",
        files: uploadedFiles.length,
        time: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        message: "提交成功！刷新页面即可看到新谱子",
        entry: result.entry,
      });
    } finally {
      await env.KV_LOCK?.delete(lockKey).catch(() => {});
    }
  } catch (e) {
    console.error("Submit error:", e);
    return jsonResponse({ success: false, error: "提交失败: " + (e.message || "请稍后重试") }, 500);
  }
}

// ===== 反代 GitHub Pages =====
async function proxyToGitHub(request, url) {
  const targetUrl = GITHUB_PAGES + url.pathname + url.search;
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
      Accept: request.headers.get("Accept") || "*/*",
    },
    redirect: "follow",
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
  } else {
    newHeaders.set("Cache-Control", "public, max-age=300");
  }

  // 所有资源：显式 UTF-8 解码 + 禁用自动压缩
  newHeaders.set("Content-Encoding", "identity"); // 禁用 Brotli/Gzip 自动压缩

  if (contentType.includes("text/") || contentType.includes("application/javascript") || contentType.includes("application/json")) {
    newHeaders.set("Content-Type", contentType + "; charset=utf-8");
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ===== GitHub API 操作 =====
function decodeBase64Content(base64) {
  // 正确解码 UTF-8 base64 内容
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchTabsData(env) {
  const headers = {
    "User-Agent": "fwjita-worker",
    Accept: "application/vnd.github.v3+json",
  };
  if (env.GITHUB_TOKEN) headers["Authorization"] = `token ${env.GITHUB_TOKEN}`;

  const resp = await fetch(`${GITHUB_API}/contents/assets/js/tabs-data.js`, { headers });
  if (!resp.ok) throw new Error("Failed to fetch tabs-data.js: HTTP " + resp.status);
  const data = await resp.json();
  const raw = decodeBase64Content(data.content);
  const json = raw.replace(/^const\s+tabsData\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(json);
}

async function uploadToGitHub(env, path, base64Content, message) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const headers = {
    "User-Agent": "fwjita-worker",
    Accept: "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
  };

  let sha = null;
  const checkResp = await fetch(`${GITHUB_API}/contents/${path}`, { headers });
  if (checkResp.ok) {
    const existing = await checkResp.json();
    sha = existing.sha;
  }

  const resp = await fetch(`${GITHUB_API}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: base64Content, ...(sha && { sha }) }),
  });
  return resp.ok;
}

async function deleteFileFromGitHub(env, path) {
  const token = env.GITHUB_TOKEN;
  const headers = {
    "User-Agent": "fwjita-worker",
    Accept: "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
  };
  const checkResp = await fetch(`${GITHUB_API}/contents/${path}`, { headers });
  if (!checkResp.ok) return;
  const { sha } = await checkResp.json();
  await fetch(`${GITHUB_API}/contents/${path}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ message: `Delete ${path}`, sha }),
  });
}

async function tryDeleteDir(env, dirPath) {
  // GitHub API 不支持直接删目录，通过删目录下的 .gitkeep 实现
  await deleteFileFromGitHub(env, `${dirPath}/.gitkeep`).catch(() => {});
}

async function updateTabsDataWithSha(env, tabsData, message, sha) {
  const token = env.GITHUB_TOKEN;
  const headers = {
    "User-Agent": "fwjita-worker",
    Accept: "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
  };
  const content = `const tabsData = ${JSON.stringify(tabsData, null, 2)};`;
  const base64 = base64Encode(content);

  const resp = await fetch(`${GITHUB_API}/contents/assets/js/tabs-data.js`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: base64, sha }),
  });
  return resp.ok;
}

// ===== 原子性更新 tabs-data.js =====
async function atomicUpdateTabsData(env, updateFn) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { tabsData, sha } = await fetchTabsDataWithSha(env);
      const entry = updateFn(tabsData);
      const success = await updateTabsDataWithSha(env, tabsData, `Add tab: ${entry.title}`, sha);
      if (success) return { success: true, entry };
      // SHA 冲突，重试
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  throw new Error("Concurrent update failed after retries");
}

async function fetchTabsDataWithSha(env) {
  const headers = {
    "User-Agent": "fwjita-worker",
    Accept: "application/vnd.github.v3+json",
  };
  if (env.GITHUB_TOKEN) headers["Authorization"] = `token ${env.GITHUB_TOKEN}`;

  const resp = await fetch(`${GITHUB_API}/contents/assets/js/tabs-data.js`, { headers });
  if (!resp.ok) throw new Error("Failed to fetch: HTTP " + resp.status);
  const data = await resp.json();
  const raw = decodeBase64Content(data.content);
  const json = raw.replace(/^const\s+tabsData\s*=\s*/, "").replace(/;\s*$/, "");
  return { tabsData: JSON.parse(json), sha: data.sha };
}

// ===== 日志系统 =====
async function getLogs(env) {
  try {
    const data = await env.KV_LOCK?.get("admin_logs");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function appendLog(env, logEntry) {
  if (!env.KV_LOCK) return;
  const logs = await getLogs(env);
  logs.unshift(logEntry);
  // 保留最近 100 条
  if (logs.length > 100) logs.length = 100;
  await env.KV_LOCK.put("admin_logs", JSON.stringify(logs));
}

// ===== 辅助函数 =====
function base64Encode(bufferOrString) {
  // 支持 ArrayBuffer 和 String
  let binary;
  if (bufferOrString instanceof ArrayBuffer) {
    const bytes = new Uint8Array(bufferOrString);
    binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
  } else {
    binary = unescape(encodeURIComponent(bufferOrString));
  }
  return btoa(binary);
}

function sanitizePath(input) {
  // 保留中文、字母、数字、空格，替换危险字符
  return input
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, " ")  // 保留空格，GitHub 可处理
    .trim();
}

function sanitizeFilename(name) {
  // 保留中文、字母、数字、点、横线，替换其他
  return name.replace(/[^\w.\-一-龥]/g, "_").replace(/_+/g, "_");
}

function sanitizeName(name) {
  return name.replace(/[<>]/g, "").slice(0, 50);
}

function buildFilesObject(uploadedFiles) {
  const files = {};
  const gpxFiles = uploadedFiles.filter(f => f.type === "gpx");
  const pdfFiles = uploadedFiles.filter(f => f.type === "pdf");
  const imgFiles = uploadedFiles.filter(f => f.type === "jpg");
  if (gpxFiles.length > 0) files.gpx = gpxFiles[0].path;
  if (pdfFiles.length > 0) files.pdf = pdfFiles[0].path;
  if (imgFiles.length > 0) files.images = imgFiles.map(f => f.path);
  return files;
}

async function checkAdminAuth(request, env) {
  const provided = request.headers.get("Authorization")?.replace("Bearer ", "") || new URL(request.url).searchParams.get("key") || "";
  // 优先检查 ADMIN_PASSWORD，否则回退到 SUBMIT_PASSWORD
  const adminPwd = env.ADMIN_PASSWORD || env.SUBMIT_PASSWORD || "";
  return await timingSafeEqual(provided, adminPwd);
}

async function timingSafeEqual(provided, expected) {
  if (!provided || !expected) return false;
  try {
    const enc = new TextEncoder();
    const a = enc.encode(provided);
    const b = enc.encode(expected);
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
    return result === 0;
  } catch {
    return false;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(),
    },
  });
}
