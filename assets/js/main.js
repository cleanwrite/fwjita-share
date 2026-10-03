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

  container.innerHTML = tabs.map(tab => `
    <div class="tab-card" onclick="openPreview(${tab.id})">
      <div class="card-info">
        <h3>${tab.title}</h3>
        <p class="card-category">${tab.category}</p>
      </div>
      <div class="formats">
        ${tab.formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
      </div>
    </div>
  `).join('');
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

  container.innerHTML = tabs.map(tab => `
    <div class="tab-card" onclick="openPreview(${tab.id})">
      <div class="card-info">
        <h3>${tab.title}</h3>
        <p class="card-category">${tab.category}</p>
      </div>
      <div class="formats">
        ${tab.formats.map(f => `<span class="format-badge ${f}">${f}</span>`).join('')}
      </div>
    </div>
  `).join('');
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

  // Show contributor credit
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

  // Insert contributor credit after title
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
    body.innerHTML += '<p style="text-align:center;color:#8b949e;padding:40px;">没有可预览的资源</p>';
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
      <a href="${encodeAssetPath(tab.files.gpx)}" download="${gpxFilename}">
        下载 GPX
      </a>
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
  // Give browser a moment to calculate layout before init alphaTab
  requestAnimationFrame(() => {
    initAlphaTab(tab.files.gpx);
  });
}

function renderPdfPreview(tab, container) {
  container.innerHTML = `<iframe class="preview-pdf" src="${encodeAssetPath(tab.files.pdf)}"></iframe>`;
}

function renderImagesPreview(tab, container) {
  const multiMode = (tab.formats.includes('gpx') && tab.files.gpx) || (tab.formats.includes('pdf') && tab.files.pdf);
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
  if (!container.offsetWidth) {
    container.style.width = '100%';
    container.style.minWidth = '600px';
  }

  const settings = {
    core: {
      engine: 'svg',
      logLevel: 1,
      useWorkers: false
    },
    display: {
      staveProfile: 0,  // StaveProfile.Default = 0
      scale: 1.0
    },
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
    // Fix missing per-track stylesheet maps that cause "Cannot read properties of undefined (reading 'has')"
    if (score?.stylesheet) {
      const ss = score.stylesheet;
      if (!ss.perTrackMultiBarRest) ss.perTrackMultiBarRest = new Map();
      if (!ss.perTrackDisplayTuning) ss.perTrackDisplayTuning = new Map();
      if (!ss.perTrackChordDiagramsOnTop) ss.perTrackChordDiagramsOnTop = new Map();
    }
  });

  // alphaTab 1.8: load(data) returns boolean (sync)
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

// ===== 致谢墙 =====

function showCredits() {
  const modal = document.getElementById('credits-modal');
  const list = document.getElementById('credits-list');

  // Collect all contributors from tabsData
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
      return `<li>${link} <span class="credits-count">${c.count} 首</span></li>`;
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
