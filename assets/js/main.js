// 全局 alphaTab API 实例
let alphaTabApi = null;
let currentCategory = '全部';

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
  container.innerHTML = data.map(tab => `
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
        ${tab.files.gpx ? `<a href="${encodePath(tab.files.gpx)}" class="btn" download onclick="event.stopPropagation();">📥 GPX</a>` : ''}
        ${tab.files.pdf ? `<a href="${encodePath(tab.files.pdf)}" class="btn" target="_blank" onclick="event.stopPropagation();">📄 PDF</a>` : ''}
      </div>
    </div>
  `).join('');
}

// 编码中文路径
function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
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
  const tab = tabsData.find(t => t.id === id);
  if (!tab) return;

  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  titleEl.textContent = tab.title;
  if (tab.category !== '单曲') {
    titleEl.textContent += ` [${tab.category}]`;
  }
  modal.classList.remove('hidden');

  let html = '';

  // GPX 渲染
  if (tab.formats.includes('gpx') && tab.files.gpx) {
    html += `
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
      <div id="alphaTab-container"></div>
    `;
    setTimeout(() => initAlphaTab(tab.files.gpx), 100);
  }

  // 图片预览
  if (tab.files.images) {
    html += '<div class="image-gallery">';
    tab.files.images.forEach(img => {
      html += `<img class="preview-image" src="${encodePath(img)}" alt="${tab.title}" loading="lazy"
                    onclick="window.open('${encodePath(img)}', '_blank')">`;
    });
    html += '</div>';
  }

  // PDF 预览
  if (tab.formats.includes('pdf') && tab.files.pdf) {
    html += `<iframe class="preview-pdf" src="${encodePath(tab.files.pdf)}"></iframe>`;
  }

  body.innerHTML = html;
}

// 初始化 alphaTab
function initAlphaTab(gpxUrl) {
  const container = document.getElementById('alphaTab-container');
  if (!container) return;

  if (alphaTabApi) {
    alphaTabApi.destroy();
    alphaTabApi = null;
  }

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

  alphaTabApi.load(gpxUrl, (success) => {
    if (!success) {
      container.innerHTML = '<p style="color:#f85149;text-align:center;padding:20px;">⚠️ 乐谱加载失败。可能原因：文件路径包含中文（建议改用英文路径）或文件损坏。</p>';
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
