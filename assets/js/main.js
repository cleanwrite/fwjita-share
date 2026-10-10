// 全局状态
let alphaTabApi = null;
let currentView = 'categories'; // 'categories' | 'tabs' | 'preview'
let currentCategory = '';
let currentPreviewTab = null;
let currentPreviewMode = 'gpx';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
});

// ========== 第一层：分类卡片 ==========

function renderCategories() {
  currentView = 'categories';
  document.getElementById('search-input').style.display = 'none';
  document.getElementById('back-btn').style.display = 'none';

  const grouped = {};
  tabsData.forEach(tab => {
    if (!grouped[tab.category]) grouped[tab.category] = [];
    grouped[tab.category].push(tab);
  });

  const container = document.getElementById('tab-list');
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === '单曲') return 1;
    if (b === '单曲') return -1;
    return a.localeCompare(b);
  });

  container.innerHTML = categories.map(cat => {
    const tabs = grouped[cat];
    const gpxCount = tabs.filter(t => t.formats.includes('gpx')).length;
    const pdfCount = tabs.filter(t => t.formats.includes('pdf')).length;
    const imgCount = tabs.filter(t => t.files.images).length;

    return `
      <div class="category-card" onclick="openCategory('${cat}')">
        <div class="card-header">
          <span class="category-icon">${getCategoryIcon(cat)}</span>
          <h3>${cat}</h3>
        </div>
        <p class="card-meta">${tabs.length} 首</p>
        <div class="category-formats">
          ${gpxCount ? `<span class="fmt-count gpx">${gpxCount} GPX</span>` : ''}
          ${pdfCount ? `<span class="fmt-count pdf">${pdfCount} PDF</span>` : ''}
          ${imgCount ? `<span class="fmt-count img">${imgCount} 图片</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function getCategoryIcon(cat) {
  const icons = {
    'undertale': '⚔️',
    '明日方舟': '🏴',
    '黑暗之魂（blacksouls': '🔥',
    '我的世界': '⛏️',
    '单曲': '🎵'
  };
  return icons[cat] || '📁';
}

// ========== 第二层：谱子列表 ==========

function openCategory(cat) {
  currentView = 'tabs';
  currentCategory = cat;
  document.getElementById('search-input').style.display = 'block';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').placeholder = `在「${cat}」中搜索...`;
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('back-btn').textContent = '← 返回分类';

  renderTabList(cat);
}

function renderTabList(cat) {
  const container = document.getElementById('tab-list');
  const tabs = tabsData.filter(t => t.category === cat);

  if (tabs.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--fg-muted);padding:40px;">该分类下没有谱子</p>';
    return;
  }

  // 按歌名分组
  const groups = {};
  tabs.forEach(tab => {
    const group = tab.song_group || tab.title;
    if (!groups[group]) groups[group] = [];
    groups[group].push(tab);
  });

  const songs = Object.keys(groups).sort();

  container.innerHTML = songs.map(song => {
    const versions = groups[song];
    const versionCount = versions.length;
    const formats = [...new Set(versions.flatMap(t => t.formats))];
    const contrib = versions[0].contributor
      ? `<a href="${versions[0].contributor.bilibili || versions[0].contributor.url || '#'}" target="_blank" rel="noopener" class="card-contributor" onclick="event.stopPropagation()">${versions[0].contributor.name || '匿名'}</a>`
      : '';

    if (versionCount === 1) {
      const tab = versions[0];
      return `
        <div class="tab-card" onclick="openPreview(${tab.id})">
          <div class="card-info">
            <h3>${song}</h3>
            <div class="card-meta-row">
              <span class="card-category">${cat}</span>
              ${contrib ? `<span class="card-dot">·</span>${contrib}` : ''}
            </div>
          </div>
          <div class="formats">
            ${formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
          </div>
        </div>`;
    }

    // 多版本
    return `
      <div class="tab-card song-group-card" onclick="openSongGroup('${song}')">
        <div class="card-info">
          <h3>${song}</h3>
          <div class="card-meta-row">
            <span class="card-category">${cat}</span>
            <span class="card-dot">·</span>
            <span class="card-versions">${versionCount} 个版本</span>
          </div>
        </div>
        <div class="formats">
          ${formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function openSongGroup(songName) {
  currentView = 'versions';
  document.getElementById('search-input').style.display = 'none';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('back-btn').textContent = '← 返回谱子';

  const container = document.getElementById('tab-list');
  const versions = tabsData.filter(tab => {
    const group = tab.song_group || tab.title;
    return group === songName && tab.category === currentCategory;
  });

  if (versions.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--fg-muted);padding:40px;">没有版本</p>';
    return;
  }

  container.innerHTML = versions.map(tab => {
    const contrib = tab.contributor
      ? `<a href="${tab.contributor.bilibili || tab.contributor.url || '#'}" target="_blank" rel="noopener" class="card-contributor" onclick="event.stopPropagation()">${tab.contributor.name || '匿名'}</a>`
      : '';

    return `
      <div class="tab-card version-card" onclick="openPreview(${tab.id})">
        <div class="card-info">
          <h3>${tab.title}</h3>
          <div class="card-meta-row">
            ${contrib ? `<span>·</span>${contrib}` : ''}
          </div>
        </div>
        <div class="formats">
          ${tab.formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ========== 搜索 =========

function filterTabs() {
  const keyword = document.getElementById('search-input').value.toLowerCase().trim();
  const container = document.getElementById('tab-list');

  if (!keyword) {
    renderTabList(currentCategory);
    return;
  }

  // 只在当前分类内搜索
  const matchedTabs = tabsData.filter(tab =>
    tab.category === currentCategory &&
    (tab.title.toLowerCase().includes(keyword) ||
     (tab.song_group && tab.song_group.toLowerCase().includes(keyword)))
  );

  if (matchedTabs.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:var(--fg-muted);padding:40px;">没有找到"${keyword}"相关的吉他谱</p>`;
    return;
  }

  // 按歌名分组
  const groups = {};
  matchedTabs.forEach(tab => {
    const group = tab.song_group || tab.title;
    if (!groups[group]) groups[group] = [];
    groups[group].push(tab);
  });

  const songs = Object.keys(groups).sort();

  container.innerHTML = songs.map(song => {
    const versions = groups[song];
    const versionCount = versions.length;
    const formats = [...new Set(versions.flatMap(t => t.formats))];
    const contrib = versions[0].contributor
      ? `<a href="${versions[0].contributor.bilibili || versions[0].contributor.url || '#'}" target="_blank" rel="noopener" class="card-contributor" onclick="event.stopPropagation()">${versions[0].contributor.name || '匿名'}</a>`
      : '';

    if (versionCount === 1) {
      const tab = versions[0];
      return `
        <div class="tab-card" onclick="openPreview(${tab.id})">
          <div class="card-info">
            <h3>${song}</h3>
            <div class="card-meta-row">
              <span class="card-category">${currentCategory}</span>
              ${contrib ? `<span class="card-dot">·</span>${contrib}` : ''}
            </div>
          </div>
          <div class="formats">
            ${formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
          </div>
        </div>`;
    }

    return `
      <div class="tab-card song-group-card" onclick="openSongGroup('${song}')">
        <div class="card-info">
          <h3>${song}</h3>
          <div class="card-meta-row">
            <span class="card-category">${currentCategory}</span>
            <span class="card-dot">·</span>
            <span class="card-versions">${versionCount} 个版本</span>
          </div>
        </div>
        <div class="formats">
          ${formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ========== 预览弹窗 ==========

function openPreview(id) {
  currentPreviewTab = tabsData.find(t => t.id === id);
  if (!currentPreviewTab) return;

  const tab = currentPreviewTab;
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  titleEl.textContent = tab.category !== '单曲' ? `${tab.title} [${tab.category}]` : tab.title;
  modal.classList.remove('hidden');

  let contributorHtml = '';
  if (tab.contributor) {
    const name = tab.contributor.name || tab.contributor.uid || '匿名';
    const url = tab.contributor.bilibili || tab.contributor.url || '#';
    contributorHtml = `<div class="contributor-tag">感谢 <a href="${url}" target="_blank" rel="noopener">${name}</a> 提供谱子</div>`;
  }

  const hasGpx = tab.formats.includes('gpx') && tab.files.gpx;
  const hasPdf = tab.formats.includes('pdf') && tab.files.pdf;
  const hasImages = tab.files.images && tab.files.images.length > 0;
  const hasMultiple = (hasGpx && hasPdf) || (hasGpx && hasImages) || (hasPdf && hasImages);

  document.getElementById('modal-contributor').innerHTML = contributorHtml;

  if (hasMultiple) {
    renderPreviewModeSelector(tab, body);
  } else if (hasGpx) {
    renderGpxPreview(tab, body);
  } else if (hasPdf) {
    renderPdfPreview(tab, body);
  } else if (hasImages) {
    renderImagesPreview(tab, body);
  } else {
    body.innerHTML += '<p style="text-align:center;color:var(--fg-muted);padding:40px;">没有可预览的资源</p>';
  }
}

function renderPreviewModeSelector(tab, body) {
  const modes = [];
  if (tab.files.gpx) modes.push({ key: 'gpx', label: '乐谱' });
  if (tab.files.pdf) modes.push({ key: 'pdf', label: 'PDF' });
  if (tab.files.images && tab.files.images.length > 0) modes.push({ key: 'images', label: '图片' });

  body.innerHTML = `
    <div class="preview-mode-selector">
      ${modes.map(m => `
        <button class="mode-btn ${m.key === 'gpx' ? 'active' : ''}" data-mode="${m.key}"
                onclick="switchPreviewMode('${m.key}')">${m.label}</button>
      `).join('')}
    </div>
    <div id="preview-content"></div>
  `;

  currentPreviewMode = 'gpx';
  const content = document.getElementById('preview-content');
  renderGpxPreview(tab, content);
}

function switchPreviewMode(mode) {
  currentPreviewMode = mode;
  const tab = currentPreviewTab;
  if (!tab) return;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const content = document.getElementById('preview-content');
  if (mode === 'gpx') renderGpxPreview(tab, content);
  else if (mode === 'pdf') renderPdfPreview(tab, content);
  else if (mode === 'images') renderImagesPreview(tab, content);
}

function renderGpxPreview(tab, container) {
  const gpxFilename = tab.files.gpx.split('/').pop();
  container.innerHTML = `
    <div class="player-controls">
      <button onclick="playerPlay()">▶ 播放</button>
      <button onclick="playerPause()">⏸ 暂停</button>
      <button onclick="playerStop()">⏹ 停止</button>
      <a href="${encodeAssetPath(tab.files.gpx)}" download="${gpxFilename}">下载 GPX</a>
      <div class="speed-control">
        <label>速度:</label>
        <input type="range" id="speed-slider" min="25" max="150" value="100"
               oninput="changeSpeed(this.value)">
        <span id="speed-value">100%</span>
      </div>
    </div>
    <div id="alphaTab-container" style="width:100%; min-height:400px; background:#fff; border-radius:8px; padding:16px; box-sizing:border-box; overflow-x:auto;">
      <p style="color:#8b949e;text-align:center;padding:40px;">正在加载乐谱...</p>
    </div>
  `;
  requestAnimationFrame(() => {
    initAlphaTab(tab.files.gpx);
  });
}

function renderPdfPreview(tab, container) {
  container.innerHTML = `<iframe class="preview-pdf" src="${encodeAssetPath(tab.files.pdf)}"></iframe>`;
}

function renderImagesPreview(tab, container) {
  container.innerHTML = `
    <div class="image-gallery">
      ${tab.files.images.map(img => {
        const filename = img.split('/').pop();
        return `
        <div class="image-item">
          <img class="preview-image" src="${encodeAssetPath(img)}" alt="${tab.title}" loading="lazy"
               onclick="window.open('${encodeAssetPath(img)}', '_blank')">
          <button class="img-download" onclick="event.stopPropagation(); window.open('${encodeAssetPath(img)}', '_blank')">
            下载 ${filename}
          </button>
        </div>`;
      }).join('')}
    </div>
  `;
}

function encodeAssetPath(path) {
  return path.split('/').map(s => encodeURIComponent(s)).join('/');
}

function initAlphaTab(gpxPath) {
  const container = document.getElementById('alphaTab-container');
  if (!container) return;

  if (alphaTabApi) {
    try { alphaTabApi.destroy(); } catch(e) {}
    alphaTabApi = null;
  }

  container.innerHTML = '<p style="color:#8b949e;text-align:center;padding:40px;">正在加载乐谱文件...</p>';

  const encodedUrl = encodeAssetPath(gpxPath);

  fetch(encodedUrl)
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.arrayBuffer();
    })
    .then(buffer => {
      container.innerHTML = '';
      setupAlphaTab(container, buffer);
    })
    .catch(err => {
      console.error('GPX load error:', err);
      container.innerHTML = `<p style="color:#f85149;text-align:center;padding:20px;">
        ⚠️ 乐谱文件加载失败：${err.message}<br>
        <small>路径: ${gpxPath}</small>
      </p>`;
    });
}

function setupAlphaTab(container, buffer) {
  if (!container.offsetWidth) {
    container.style.width = '100%';
    container.style.minWidth = '600px';
  }

  const settings = {
    core: { engine: 'svg', logLevel: 1, useWorkers: false },
    display: { staveProfile: 0, scale: 1.0 },
    player: {
      enablePlayer: true,
      enableCursor: true,
      enableUserInteraction: true,
      soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
    }
  };

  try {
    alphaTabApi = new alphaTab.AlphaTabApi(container, settings);
  } catch (e) {
    console.error('alphaTab init error:', e);
    container.innerHTML = `<p style="color:#f85149;text-align:center;padding:20px;">⚠️ alphaTab 初始化失败: ${e.message}</p>`;
    return;
  }

  alphaTabApi.error.on((error) => {
    console.error('alphaTab Error:', error);
  });

  alphaTabApi.scoreLoaded.on((score) => {
    console.log('Score loaded:', score?.title, 'Tracks:', score?.tracks?.length);
    if (score?.stylesheet) {
      const ss = score.stylesheet;
      if (!ss.perTrackMultiBarRest) ss.perTrackMultiBarRest = new Map();
      if (!ss.perTrackDisplayTuning) ss.perTrackDisplayTuning = new Map();
      if (!ss.perTrackChordDiagramsOnTop) ss.perTrackChordDiagramsOnTop = new Map();
    }
  });

  try {
    const uint8 = new Uint8Array(buffer);
    const success = alphaTabApi.load(uint8);
    console.log('alphaTab load returned:', success);
    if (!success) {
      container.innerHTML = '<p style="color:#f85149;text-align:center;padding:20px;">⚠️ 乐谱解析失败</p>';
    }
  } catch (e) {
    console.error('alphaTab load exception:', e);
    container.innerHTML = `<p style="color:#f85149;text-align:center;padding:20px;">⚠️ 加载异常: ${e.message}</p>`;
  }
}

// 返回按钮
function goBack() {
  if (currentView === 'versions') {
    currentView = 'tabs';
    document.getElementById('search-input').style.display = 'block';
    document.getElementById('back-btn').textContent = '← 返回分类';
    renderTabList(currentCategory);
  } else if (currentView === 'tabs' || currentView === 'search') {
    renderCategories();
  }
}

// 播放器控制
function playerPlay() { if (alphaTabApi) alphaTabApi.play(); }
function playerPause() { if (alphaTabApi) alphaTabApi.pause(); }
function playerStop() { if (alphaTabApi) alphaTabApi.stop(); }
function changeSpeed(percent) {
  if (alphaTabApi) {
    alphaTabApi.playbackSpeed = percent / 100;
    document.getElementById('speed-value').textContent = percent + '%';
  }
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  if (alphaTabApi) alphaTabApi.pause();
  currentPreviewTab = null;
  currentPreviewMode = 'gpx';
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeCredits();
  }
});

// ===== 提交谱子 =====

const API_BASE = ''; // 同域，Worker 反代
let isSubmitting = false;

async function openSubmitModal() {
  const modal = document.getElementById('submitModal');
  modal.classList.remove('hidden');

  const select = document.getElementById('submitCategory');
  select.innerHTML = '<option value="">-- 选择分类 --</option>';
  try {
    const resp = await fetch(API_BASE + '/api/categories');
    const data = await resp.json();
    if (data.success) {
      data.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ 新建分类';
  select.appendChild(newOpt);

  const fileInput = document.getElementById('submitFiles');
  if (!fileInput.dataset.bound) {
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.dataset.bound = '1';
  }
}

function handleFileSelect(e) {
  const tags = document.getElementById('fileTags');
  tags.innerHTML = '';
  const files = e.target.files;
  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    let type = 'unknown';
    if (['.gp', '.gp3', '.gp4', '.gp5', '.gp7', '.gp8', '.gpx'].includes(ext)) type = 'GPX';
    else if (ext === '.pdf') type = 'PDF';
    else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) type = '图片';

    const tag = document.createElement('span');
    tag.className = 'file-tag ' + (type === 'unknown' ? 'unsupported' : type.toLowerCase());
    tag.textContent = `${file.name} (${type}${file.size > 1024 * 1024 ? ' ' + (file.size / 1024 / 1024).toFixed(1) + 'MB' : ''})`;
    tags.appendChild(tag);
  }

  if (files.length > 0) {
    const sizeTag = document.createElement('span');
    sizeTag.className = 'file-tag total';
    sizeTag.textContent = `总计: ${(totalSize / 1024 / 1024).toFixed(1)}MB / 50MB`;
    sizeTag.style.background = totalSize > 50 * 1024 * 1024 ? 'rgba(248,81,73,0.2)' : '';
    tags.appendChild(sizeTag);
  }
}

function closeSubmitModal() {
  document.getElementById('submitModal').classList.add('hidden');
  document.getElementById('submitForm').reset();
  document.getElementById('fileTags').innerHTML = '';
  document.getElementById('submitResult').innerHTML = '';
  document.getElementById('newCategory').style.display = 'none';
  isSubmitting = false;
}

async function submitTab() {
  if (isSubmitting) return;
  isSubmitting = true;

  const btn = document.querySelector('.submit-form-btn');
  const result = document.getElementById('submitResult');
  btn.disabled = true;
  btn.textContent = '提交中...';
  result.innerHTML = '<p class="result-loading">⏳ 上传中，请稍候...</p>';

  const category = document.getElementById('submitCategory').value === '__new__'
    ? document.getElementById('newCategory').value.trim()
    : document.getElementById('submitCategory').value;
  const songGroup = document.getElementById('submitSongGroup').value.trim();
  const contributor = document.getElementById('submitContributor').value.trim();
  const bilibili = document.getElementById('submitBilibili').value.trim();
  const password = document.getElementById('submitPassword').value;
  const files = document.getElementById('submitFiles').files;

  if (!category || !songGroup) {
    result.innerHTML = '<p class="result-error">请填写分类和歌曲名</p>';
    resetSubmitBtn(btn);
    return;
  }
  if (files.length === 0) {
    result.innerHTML = '<p class="result-error">请至少上传一个文件</p>';
    resetSubmitBtn(btn);
    return;
  }
  if (!password) {
    result.innerHTML = '<p class="result-error">请输入提交密码</p>';
    resetSubmitBtn(btn);
    return;
  }

  const formData = new FormData();
  formData.append('category', category);
  formData.append('songGroup', songGroup);
  formData.append('contributor', contributor);
  formData.append('bilibili', bilibili);
  formData.append('password', password);
  for (const file of files) {
    formData.append('files', file);
  }

  try {
    const resp = await fetch(API_BASE + '/api/submit', {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json();
    if (data.success) {
      result.innerHTML = `<p class="result-success">✅ ${data.message}</p>`;
      btn.textContent = '提交成功！';
      setTimeout(() => closeSubmitModal(), 2000);
    } else {
      result.innerHTML = `<p class="result-error">❌ ${data.error}</p>`;
      resetSubmitBtn(btn);
    }
  } catch (e) {
    result.innerHTML = `<p class="result-error">❌ 网络错误，请稍后重试</p>`;
    resetSubmitBtn(btn);
  }
}

function resetSubmitBtn(btn) {
  isSubmitting = false;
  btn.disabled = false;
  btn.textContent = '提交';
}

// ===== 管理员面板 =====

let adminAuthed = false;

function openAdminPanel() {
  document.getElementById('adminModal').classList.remove('hidden');
  document.getElementById('adminContent').style.display = 'none';
  document.getElementById('adminPassword').value = '';
  adminAuthed = false;
}

function closeAdminPanel() {
  document.getElementById('adminModal').classList.add('hidden');
}

async function loginAdmin() {
  const pwd = document.getElementById('adminPassword').value;
  if (!pwd) return;

  try {
    const resp = await fetch(API_BASE + '/api/tabs-data', {
      headers: { Authorization: `Bearer ${pwd}` }
    });
    const data = await resp.json();

    if (data.success) {
      adminAuthed = true;
      document.getElementById('adminContent').style.display = 'block';
      document.querySelector('.admin-auth').style.display = 'none';
      window._adminTabsData = data.data;
      showAdminTab('tabs');
    } else {
      alert('密码错误');
    }
  } catch (e) {
    alert('登录失败');
  }
}

function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  const content = document.getElementById('adminTabContent');

  if (tab === 'tabs') {
    renderAdminTabs(content);
  } else if (tab === 'logs') {
    renderAdminLogs(content);
  }
}

function renderAdminTabs(container) {
  const tabs = window._adminTabsData || [];
  if (tabs.length === 0) {
    container.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px;">暂无谱子</p>';
    return;
  }

  container.innerHTML = `<div class="admin-actions">
    <span>${tabs.length} 首谱子</span>
    <button onclick="refreshAdminData()" class="admin-refresh-btn">刷新</button>
  </div>` + tabs.map(t => `
    <div class="admin-tab-item">
      <div class="admin-tab-info">
        <strong>${t.title}</strong>
        <span class="admin-tag">${t.category}</span>
        <span class="admin-tag">${t.formats?.join(', ') || ''}</span>
        <span class="admin-contrib">${t.contributor?.name || ''}</span>
      </div>
      <button onclick="deleteTab(${t.id})" class="admin-delete-btn">删除</button>
    </div>
  `).join('');
}

async function renderAdminLogs(container) {
  container.innerHTML = '<p style="text-align:center;padding:20px;">加载中...</p>';
  try {
    const resp = await fetch(API_BASE + '/api/admin/logs', {
      headers: { Authorization: `Bearer ${document.getElementById('adminPassword').value}` }
    });
    const data = await resp.json();
    if (!data.success || data.logs.length === 0) {
      container.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px;">暂无日志</p>';
      return;
    }
    container.innerHTML = data.logs.map(log => `
      <div class="admin-log-item">
        <span class="log-action ${log.action}">${log.action === 'submit' ? '新增' : '删除'}</span>
        <span class="log-title">${log.title}</span>
        <span class="log-meta">${log.category || ''} · ${log.contributor || ''}</span>
        <span class="log-time">${log.time ? log.time.replace('T', ' ').slice(0, 16) : ''}</span>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p style="color:#f85149;text-align:center;">加载失败</p>';
  }
}

async function deleteTab(id) {
  if (!confirm('确定要删除这首谱子吗？此操作不可恢复。')) return;

  const pwd = document.getElementById('adminPassword').value;
  try {
    const resp = await fetch(API_BASE + `/api/tabs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pwd}` }
    });
    const data = await resp.json();
    if (data.success) {
      window._adminTabsData = window._adminTabsData.filter(t => t.id !== id);
      renderAdminTabs(document.getElementById('adminTabContent'));
    } else {
      alert('删除失败: ' + data.error);
    }
  } catch (e) {
    alert('删除失败');
  }
}

async function refreshAdminData() {
  const pwd = document.getElementById('adminPassword').value;
  const resp = await fetch(API_BASE + '/api/tabs-data', {
    headers: { Authorization: `Bearer ${pwd}` }
  });
  const data = await resp.json();
  if (data.success) {
    window._adminTabsData = data.data;
    renderAdminTabs(document.getElementById('adminTabContent'));
  }
}

// ===== 致谢墙 =====

function showCredits() {
  const modal = document.getElementById('credits-modal');
  const list = document.getElementById('credits-list');

  const contributors = new Map();
  tabsData.forEach(tab => {
    if (tab.contributor) {
      const key = tab.contributor.bilibili || tab.contributor.name || tab.contributor.uid;
      if (!contributors.has(key)) {
        contributors.set(key, {
          name: tab.contributor.name || tab.contributor.uid || '匿名',
          bilibili: tab.contributor.bilibili || tab.contributor.url || null,
          count: 1
        });
      } else {
        contributors.get(key).count++;
      }
    }
  });

  if (contributors.size === 0) {
    list.innerHTML = `<li class="credits-empty">还没有贡献者，等你来当第一个！</li>`;
  } else {
    list.innerHTML = Array.from(contributors.values()).map(c => {
      const link = c.bilibili
        ? `<a href="${c.bilibili}" target="_blank" rel="noopener">${c.name}</a>`
        : c.name;
      return `<li><span class="credits-name">${link}</span><span class="credits-count">贡献 ${c.count} 首</span></li>`;
    }).join('');
  }

  modal.classList.remove('hidden');
}

function closeCredits() {
  document.getElementById('credits-modal').classList.add('hidden');
}

document.getElementById('credits-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('credits-modal')) closeCredits();
});
