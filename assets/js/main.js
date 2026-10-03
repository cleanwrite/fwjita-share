// 全局状态
let alphaTabApi = null;
let currentCategory = '全部';
let currentView = 'categories';  // 'categories' | 'tabs'
let currentPreviewTab = null;
let currentPreviewMode = 'gpx';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
});

// ========== 第一层：大分类页面 ==========

function renderCategories() {
  currentView = 'categories';
  const search = document.getElementById('search-input');
  search.style.display = 'block';
  document.getElementById('back-btn').style.display = 'none';
  search.value = '';
  search.placeholder = '🔍 搜索所有吉他谱...';

  const grouped = {};
  tabsData.forEach(tab => {
    if (!grouped[tab.category]) grouped[tab.category] = [];
    grouped[tab.category].push(tab);
  });

  const container = document.getElementById('tab-list');
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === '单曲') return 1;  // 单曲排最后
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
        <div class="category-icon">${getCategoryIcon(cat)}</div>
        <h3>${cat}</h3>
        <p class="category-count">${tabs.length} 首</p>
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

// ========== 第二层：分类内的谱子列表 ==========

function openCategory(cat) {
  currentView = 'tabs';
  currentCategory = cat;

  const search = document.getElementById('search-input');
  search.style.display = 'block';
  search.value = '';
  search.placeholder = '🔍 在当前分类中搜索...';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('back-btn').textContent = '← 返回分类';

  renderTabListInCategory(cat);
}

function renderTabListInCategory(cat) {
  const container = document.getElementById('tab-list');
  const tabs = tabsData.filter(t => t.category === cat);

  if (tabs.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#8b949e;padding:40px;">该分类下没有谱子</p>';
    return;
  }

  container.innerHTML = tabs.map(tab => {
    const hasMultiple = tab.formats.length > 1;
    return `
      <div class="tab-card" onclick="openPreview(${tab.id})">
        <h3>${tab.title}</h3>
        <div class="formats">
          ${tab.formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="event.stopPropagation(); openPreview(${tab.id})">
            👁 预览
          </button>
          ${hasMultiple ? `<span class="multi-hint" style="font-size:0.75em;color:#8b949e;">（多格式可选）</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ========== 搜索（全局搜索 / 分类内搜索） ==========

function filterTabs() {
  const keyword = document.getElementById('search-input').value.toLowerCase().trim();
  const container = document.getElementById('tab-list');

  if (!keyword) {
    // 空搜索 → 回到当前视图
    if (currentView === 'categories') {
      renderCategories();
    } else {
      renderTabListInCategory(currentCategory);
    }
    return;
  }

  // 判断搜索范围
  let tabs;
  if (currentView === 'categories') {
    // 全局搜索：搜所有谱子
    tabs = tabsData.filter(t => t.title.toLowerCase().includes(keyword));
  } else {
    // 分类内搜索
    tabs = tabsData.filter(t =>
      t.category === currentCategory &&
      t.title.toLowerCase().includes(keyword)
    );
  }

  if (tabs.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#8b949e;padding:40px;">没有找到"${keyword}"相关的吉他谱</p>`;
    return;
  }

  // 全局搜索时切换到列表视图
  if (currentView === 'categories' && tabs.length > 0) {
    currentView = 'tabs';
    document.getElementById('back-btn').style.display = 'block';
    document.getElementById('back-btn').textContent = '← 返回分类';
  }

  container.innerHTML = tabs.map(tab => {
    const hasMultiple = tab.formats.length > 1;
    return `
      <div class="tab-card" onclick="openPreview(${tab.id})">
        <h3>${tab.title}</h3>
        <p class="category-tag">${tab.category}</p>
        <div class="formats">
          ${tab.formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="event.stopPropagation(); openPreview(${tab.id})">
            👁 预览
          </button>
          ${hasMultiple ? `<span class="multi-hint" style="font-size:0.75em;color:#8b949e;">（多格式可选）</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ========== 第三层：预览弹窗 ==========

function openPreview(id) {
  currentPreviewTab = tabsData.find(t => t.id === id);
  if (!currentPreviewTab) return;

  const tab = currentPreviewTab;
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  titleEl.textContent = tab.category !== '单曲' ? `${tab.title} [${tab.category}]` : tab.title;
  modal.classList.remove('hidden');

  const hasGpx = tab.formats.includes('gpx') && tab.files.gpx;
  const hasPdf = tab.formats.includes('pdf') && tab.files.pdf;
  const hasImages = tab.files.images && tab.files.images.length > 0;
  const hasMultiple = (hasGpx && hasPdf) || (hasGpx && hasImages) || (hasPdf && hasImages);

  if (hasMultiple) {
    renderPreviewModeSelector(tab, body);
  } else if (hasGpx) {
    renderGpxPreview(tab, body);
  } else if (hasPdf) {
    renderPdfPreview(tab, body);
  } else if (hasImages) {
    renderImagesPreview(tab, body);
  } else {
    body.innerHTML = '<p style="text-align:center;color:#8b949e;padding:40px;">没有可预览的资源</p>';
  }
}

function renderPreviewModeSelector(tab, body) {
  const modes = [];
  if (tab.files.gpx) modes.push({ key: 'gpx', label: '🎸 乐谱', desc: 'GPX 可播放' });
  if (tab.files.pdf) modes.push({ key: 'pdf', label: '📄 PDF', desc: '文档预览' });
  if (tab.files.images && tab.files.images.length > 0)
    modes.push({ key: 'images', label: `🖼️ 图片`, desc: `${tab.files.images.length} 张` });

  body.innerHTML = `
    <div class="preview-mode-selector">
      ${modes.map(m => `
        <button class="mode-btn ${m.key === 'gpx' ? 'active' : ''}" data-mode="${m.key}"
                onclick="switchPreviewMode('${m.key}')">
          <span class="mode-label">${m.label}</span>
          <span class="mode-desc">${m.desc}</span>
        </button>
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
  container.innerHTML = `
    <div class="player-controls">
      <button onclick="playerPlay()">▶ 播放</button>
      <button onclick="playerPause()">⏸ 暂停</button>
      <button onclick="playerStop()">⏹ 停止</button>
      <div class="speed-control">
        <label>速度:</label>
        <input type="range" id="speed-slider" min="25" max="150" value="100"
               oninput="changeSpeed(this.value)">
        <span id="speed-value">100%</span>
      </div>
    </div>
    <div id="alphaTab-container">
      <p style="color:#8b949e;text-align:center;padding:40px;">正在加载乐谱...</p>
    </div>
  `;
  initAlphaTab(tab.files.gpx);
}

function renderPdfPreview(tab, container) {
  container.innerHTML = `<iframe class="preview-pdf" src="${encodeAssetPath(tab.files.pdf)}"></iframe>`;
}

function renderImagesPreview(tab, container) {
  container.innerHTML = `
    <div class="image-gallery">
      ${tab.files.images.map(img => `
        <img class="preview-image" src="${encodeAssetPath(img)}" alt="${tab.title}" loading="lazy"
             onclick="window.open('${encodeAssetPath(img)}', '_blank')">
      `).join('')}
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
  console.log('Fetching GPX:', encodedUrl);

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
  const settings = {
    core: { engine: 'svg', logLevel: 1 },
    display: { staveProfile: 'tab', scale: 1.0 },
    player: {
      enablePlayer: true,
      enableCursor: true,
      enableUserInteraction: true,
      soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
    }
  };

  alphaTabApi = new alphaTab.AlphaTabApi(container, settings);

  alphaTabApi.error.on((error) => {
    console.error('alphaTab Error:', error);
    container.innerHTML = `<p style="color:#f85149;text-align:center;padding:20px;">
      ⚠️ 乐谱解析失败: ${error.message || error}
    </p>`;
  });

  alphaTabApi.load(new Uint8Array(buffer), (success) => {
    if (!success) {
      container.innerHTML = '<p style="color:#f85149;text-align:center;padding:20px;">⚠️ 乐谱解析失败</p>';
    }
  });
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
  if (e.key === 'Escape') closeModal();
});
