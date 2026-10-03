// 全局 alphaTab API 实例
let alphaTabApi = null;
let currentCategory = '全部';
let currentPreviewTab = null;      // 当前打开的谱子
let currentPreviewMode = 'gpx';    // 当前预览模式: 'gpx' | 'pdf' | 'images'

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryTabs();
  renderTabList(tabsData);
});

// 渲染分类标签
function renderCategoryTabs() {
  const categories = ['全部', ...new Set(tabsData.map(t => t.category))];
  const container = document.getElementById('category-tabs');
  container.innerHTML = categories.map(cat => `
    <button class="category-btn ${cat === currentCategory ? 'active' : ''}"
            onclick="selectCategory('${cat}')">${cat}</button>
  `).join('');
}

// 选择分类
function selectCategory(cat) {
  currentCategory = cat;
  renderCategoryTabs();
  filterTabs();
}

// 渲染谱列表
function renderTabList(data) {
  const container = document.getElementById('tab-list');
  if (data.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#8b949e;padding:40px;">没有找到匹配的吉他谱</p>';
    return;
  }
  container.innerHTML = data.map(tab => {
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
  `}).join('');
}

// 搜索 + 分类过滤
function filterTabs() {
  const keyword = document.getElementById('search-input').value.toLowerCase();
  let filtered = tabsData;

  if (currentCategory !== '全部') {
    filtered = filtered.filter(tab => tab.category === currentCategory);
  }

  if (keyword) {
    filtered = filtered.filter(tab =>
      tab.title.toLowerCase().includes(keyword) ||
      tab.category.toLowerCase().includes(keyword)
    );
  }

  renderTabList(filtered);
}

// 打开预览
function openPreview(id) {
  currentPreviewTab = tabsData.find(t => t.id === id);
  if (!currentPreviewTab) return;

  const tab = currentPreviewTab;
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  titleEl.textContent = tab.title;
  if (tab.category !== '单曲') {
    titleEl.textContent += ` [${tab.category}]`;
  }
  modal.classList.remove('hidden');

  // 决定默认预览模式
  const hasGpx = tab.formats.includes('gpx') && tab.files.gpx;
  const hasPdf = tab.formats.includes('pdf') && tab.files.pdf;
  const hasImages = tab.files.images && tab.files.images.length > 0;
  const hasMultiple = (hasGpx && hasPdf) || (hasGpx && hasImages) || (hasPdf && hasImages);

  if (hasMultiple) {
    // 多格式：显示模式切换栏
    renderPreviewModeSelector(tab, body);
  } else {
    // 单格式：直接显示
    if (hasGpx) renderGpxPreview(tab, body);
    else if (hasPdf) renderPdfPreview(tab, body);
    else if (hasImages) renderImagesPreview(tab, body);
    else body.innerHTML = '<p style="text-align:center;color:#8b949e;padding:40px;">没有可预览的资源</p>';
  }
}

// 渲染预览模式切换栏（多格式时）
function renderPreviewModeSelector(tab, body) {
  const modes = [];
  if (tab.files.gpx) modes.push({ key: 'gpx', label: '🎸 乐谱 (GPX)', desc: '可播放' });
  if (tab.files.pdf) modes.push({ key: 'pdf', label: '📄 PDF', desc: '文档' });
  if (tab.files.images && tab.files.images.length > 0)
    modes.push({ key: 'images', label: `🖼️ 图片 (${tab.files.images.length}张)`, desc: '扫描件' });

  body.innerHTML = `
    <div class="preview-mode-selector">
      ${modes.map(m => `
        <button class="mode-btn ${m.key === 'gpx' ? 'active' : ''}"
                data-mode="${m.key}"
                onclick="switchPreviewMode('${m.key}')">
          <span class="mode-label">${m.label}</span>
          <span class="mode-desc">${m.desc}</span>
        </button>
      `).join('')}
    </div>
    <div id="preview-content"></div>
  `;

  // 默认显示 GPX
  currentPreviewMode = 'gpx';
  const content = document.getElementById('preview-content');
  renderGpxPreview(tab, content);
}

// 切换预览模式
function switchPreviewMode(mode) {
  currentPreviewMode = mode;
  const tab = currentPreviewTab;
  if (!tab) return;

  // 更新按钮状态
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const content = document.getElementById('preview-content');

  switch (mode) {
    case 'gpx':
      renderGpxPreview(tab, content);
      break;
    case 'pdf':
      renderPdfPreview(tab, content);
      break;
    case 'images':
      renderImagesPreview(tab, content);
      break;
  }
}

// 渲染 GPX 预览
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

// 渲染 PDF 预览
function renderPdfPreview(tab, container) {
  container.innerHTML = `<iframe class="preview-pdf" src="${encodeAssetPath(tab.files.pdf)}"></iframe>`;
}

// 渲染图片预览
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

// 编码资源路径（中文和特殊字符）
function encodeAssetPath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

// 初始化 alphaTab - 使用 fetch + ArrayBuffer 加载文件
function initAlphaTab(gpxPath) {
  const container = document.getElementById('alphaTab-container');
  if (!container) return;

  // 销毁旧实例
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

// 设置 alphaTab 并传入 ArrayBuffer
function setupAlphaTab(container, buffer) {
  console.log('alphaTab setup: buffer size =', buffer.length, 'bytes');

  const settings = {
    core: {
      engine: 'svg',
      logLevel: 1
    },
    display: {
      staveProfile: 'tab',
      scale: 1.0
    },
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

  alphaTabApi.renderStarted.on(() => {
    console.log('alphaTab rendering started');
  });

  alphaTabApi.renderFinished.on(() => {
    console.log('alphaTab rendering finished');
  });

  alphaTabApi.load(new Uint8Array(buffer), (success) => {
    console.log('alphaTab load callback: success =', success);
    if (!success) {
      container.innerHTML = '<p style="color:#f85149;text-align:center;padding:20px;">⚠️ 乐谱解析失败，文件可能损坏或格式不支持。</p>';
    }
  });
}

// 播放器控制
function playerPlay() {
  if (alphaTabApi) alphaTabApi.play();
}

function playerPause() {
  if (alphaTabApi) alphaTabApi.pause();
}

function playerStop() {
  if (alphaTabApi) alphaTabApi.stop();
}

function changeSpeed(percent) {
  if (alphaTabApi) {
    alphaTabApi.playbackSpeed = percent / 100;
    document.getElementById('speed-value').textContent = percent + '%';
  }
}

// 关闭模态框
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  if (alphaTabApi) {
    alphaTabApi.pause();
  }
  currentPreviewTab = null;
  currentPreviewMode = 'gpx';
}

// 点击模态框外部关闭
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) {
    closeModal();
  }
});

// ESC 关闭模态框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
