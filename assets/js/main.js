// ===== 吉他谱分享站 — 核心脚本 =====
// 无外部依赖，纯原生 JS

(function () {
  'use strict';

  // === 状态 ===
  let alphaTabApi = null;
  let currentView = 'categories'; // 'categories' | 'tabs' | 'search'
  let currentCategory = '';
  let currentPreviewTab = null;
  let currentPreviewMode = 'gpx';
  let isSubmitting = false;
  let adminAuthed = false;
  let searchTimer = null;
  let lastTriggerElement = null; // 用于焦点恢复

  // === 工具函数 ===

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function encodeAssetPath(path) {
    return path.split('/').map(function (s) { return encodeURIComponent(s); }).join('/');
  }

  // === 焦点陷阱 ===
  function trapFocus(modal) {
    var focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    first.focus();

    function handleTab(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleTab);
    modal._trapHandler = handleTab;
  }

  function releaseFocus(modal) {
    if (modal._trapHandler) {
      modal.removeEventListener('keydown', modal._trapHandler);
      modal._trapHandler = null;
    }
  }

  function openModal(modalId, triggerEl) {
    var modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    lastTriggerElement = triggerEl || null;
    trapFocus(modal);
  }

  function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    releaseFocus(modal);
    if (lastTriggerElement) {
      lastTriggerElement.focus();
      lastTriggerElement = null;
    }
  }

  // === 第一层：分类卡片 ===

  function renderCategories() {
    currentView = 'categories';
    document.getElementById('search-input').style.display = 'block';
    document.getElementById('search-input').value = '';
    document.getElementById('search-input').placeholder = '🔍 搜索所有吉他谱...';
    document.getElementById('back-btn').style.display = 'none';

    var grouped = {};
    tabsData.forEach(function (tab) {
      if (!grouped[tab.category]) grouped[tab.category] = [];
      grouped[tab.category].push(tab);
    });

    var container = document.getElementById('tab-list');
    var categories = Object.keys(grouped).sort(function (a, b) {
      if (a === '单曲') return 1;
      if (b === '单曲') return -1;
      return a.localeCompare(b);
    });

    container.innerHTML = categories.map(function (cat) {
      var tabs = grouped[cat];
      var gpxCount = tabs.filter(function (t) { return t.formats.includes('gpx'); }).length;
      var pdfCount = tabs.filter(function (t) { return t.formats.includes('pdf'); }).length;
      var imgCount = tabs.filter(function (t) { return t.files.images; }).length;

      return '<div class="category-card" data-category="' + escapeHtml(cat) + '" role="button" tabindex="0">' +
        '<div class="card-header">' +
          '<span class="category-icon">' + getCategoryIcon(cat) + '</span>' +
          '<h3>' + escapeHtml(cat) + '</h3>' +
        '</div>' +
        '<p class="card-meta">' + tabs.length + ' 首</p>' +
        '<div class="category-formats">' +
          (gpxCount ? '<span class="fmt-count gpx">' + gpxCount + ' GPX</span>' : '') +
          (pdfCount ? '<span class="fmt-count pdf">' + pdfCount + ' PDF</span>' : '') +
          (imgCount ? '<span class="fmt-count img">' + imgCount + ' 图片</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function getCategoryIcon(cat) {
    var icons = {
      'undertale': '⚔️',
      '明日方舟': '🏴',
      '黑暗之魂（blacksouls': '🔥',
      '我的世界': '⛏️',
      '单曲': '🎵'
    };
    return icons[cat] || '📁';
  }

  // === 第二层：谱子列表 ===

  function openCategory(cat) {
    currentView = 'tabs';
    currentCategory = cat;
    document.getElementById('search-input').style.display = 'block';
    document.getElementById('search-input').value = '';
    document.getElementById('search-input').placeholder = '在「' + cat + '」中搜索...';
    document.getElementById('back-btn').style.display = 'block';
    document.getElementById('back-btn').textContent = '← 返回分类';
    renderTabList(cat);
  }

  function renderTabList(cat) {
    var container = document.getElementById('tab-list');
    var tabs = tabsData.filter(function (t) { return t.category === cat; });

    if (tabs.length === 0) {
      container.innerHTML = '<p class="empty-state">该分类下没有谱子</p>';
      return;
    }

    container.innerHTML = renderGroupedTabs(tabs, cat);
  }

  // 通用分组渲染（搜索结果和分类列表共用）
  function renderGroupedTabs(tabs, category) {
    var groups = {};
    tabs.forEach(function (tab) {
      var group = tab.song_group || tab.title;
      if (!groups[group]) groups[group] = [];
      groups[group].push(tab);
    });

    var songs = Object.keys(groups).sort();

    return songs.map(function (song) {
      var versions = groups[song];
      var versionCount = versions.length;
      var formats = [];
      versions.forEach(function (t) { t.formats.forEach(function (f) { if (formats.indexOf(f) === -1) formats.push(f); }); });
      var contrib = versions[0].contributor
        ? '<a href="' + (versions[0].contributor.bilibili || versions[0].contributor.url || '#') + '" target="_blank" rel="noopener" class="card-contributor" onclick="event.stopPropagation()">' + escapeHtml(versions[0].contributor.name || '匿名') + '</a>'
        : '';

      if (versionCount === 1) {
        var tab = versions[0];
        return '<div class="tab-card" data-id="' + tab.id + '" role="button" tabindex="0">' +
          '<div class="card-info"><h3>' + escapeHtml(song) + '</h3>' +
          '<div class="card-meta-row"><span class="card-category">' + escapeHtml(category) + '</span>' +
          (contrib ? '<span class="card-dot">·</span>' + contrib : '') + '</div></div>' +
          '<div class="formats">' + formats.map(function (f) { return '<span class="format-badge ' + f + '">' + f + '</span>'; }).join('') + '</div>' +
        '</div>';
      }

      return '<div class="tab-card song-group-card" data-song="' + escapeHtml(song) + '" role="button" tabindex="0">' +
        '<div class="card-info"><h3>' + escapeHtml(song) + '</h3>' +
        '<div class="card-meta-row"><span class="card-category">' + escapeHtml(category) + '</span>' +
        '<span class="card-dot">·</span><span class="card-versions">' + versionCount + ' 个版本</span></div></div>' +
        '<div class="formats">' + formats.map(function (f) { return '<span class="format-badge ' + f + '">' + f + '</span>'; }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  function openSongGroup(songName) {
    currentView = 'search'; // 借用 search 状态表示版本列表
    document.getElementById('search-input').style.display = 'none';
    document.getElementById('back-btn').style.display = 'block';
    document.getElementById('back-btn').textContent = '← 返回谱子';

    var container = document.getElementById('tab-list');
    var versions = tabsData.filter(function (tab) {
      var group = tab.song_group || tab.title;
      return group === songName && tab.category === currentCategory;
    });

    if (versions.length === 0) {
      container.innerHTML = '<p class="empty-state">没有版本</p>';
      return;
    }

    container.innerHTML = versions.map(function (tab) {
      var contrib = tab.contributor
        ? '<a href="' + (tab.contributor.bilibili || tab.contributor.url || '#') + '" target="_blank" rel="noopener" class="card-contributor" onclick="event.stopPropagation()">' + escapeHtml(tab.contributor.name || '匿名') + '</a>'
        : '';
      return '<div class="tab-card version-card" data-id="' + tab.id + '" role="button" tabindex="0">' +
        '<div class="card-info"><h3>' + escapeHtml(tab.title) + '</h3>' +
        '<div class="card-meta-row">' + (contrib ? '<span>·</span>' + contrib : '') + '</div></div>' +
        '<div class="formats">' + tab.formats.map(function (f) { return '<span class="format-badge ' + f + '">' + f + '</span>'; }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  // === 搜索（全局搜索，防抖）===

  function filterTabs() {
    var keyword = document.getElementById('search-input').value.toLowerCase().trim();
    var container = document.getElementById('tab-list');

    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      // 空搜索 → 显示分类卡片
      if (!keyword) {
        renderCategories();
        return;
      }

      // 全局搜索：匹配歌名、分类名
      var matched = tabsData.filter(function (tab) {
        return tab.title.toLowerCase().includes(keyword) ||
               (tab.song_group && tab.song_group.toLowerCase().includes(keyword)) ||
               tab.category.toLowerCase().includes(keyword);
      });

      if (matched.length === 0) {
        container.innerHTML = '<p class="empty-state">没有找到"' + escapeHtml(keyword) + '"相关的吉他谱</p>';
        return;
      }

      // 显示搜索结果
      currentView = 'search';
      document.getElementById('back-btn').style.display = 'block';
      document.getElementById('back-btn').textContent = '← 返回';
      container.innerHTML = renderGroupedTabs(matched, '搜索结果');
    }, 150);
  }

  // === 预览弹窗 ===

  function openPreviewById(id) {
    currentPreviewTab = tabsData.find(function (t) { return t.id === id; });
    if (!currentPreviewTab) return;

    var tab = currentPreviewTab;
    var modal = document.getElementById('modal');
    var titleEl = document.getElementById('modal-title');
    var body = document.getElementById('modal-body');

    titleEl.textContent = tab.category !== '单曲' ? tab.title + ' [' + tab.category + ']' : tab.title;

    var contributorHtml = '';
    if (tab.contributor) {
      var name = tab.contributor.name || tab.contributor.uid || '匿名';
      var url = tab.contributor.bilibili || tab.contributor.url || '#';
      contributorHtml = '<div class="contributor-tag">感谢 <a href="' + url + '" target="_blank" rel="noopener">' + escapeHtml(name) + '</a> 提供谱子</div>';
    }
    document.getElementById('modal-contributor').innerHTML = contributorHtml;

    var hasGpx = tab.formats.includes('gpx') && tab.files.gpx;
    var hasPdf = tab.formats.includes('pdf') && tab.files.pdf;
    var hasImages = tab.files.images && tab.files.images.length > 0;
    var hasMultiple = (hasGpx && hasPdf) || (hasGpx && hasImages) || (hasPdf && hasImages);

    if (hasMultiple) {
      renderPreviewModeSelector(tab, body);
    } else if (hasGpx) {
      renderGpxPreview(tab, body);
    } else if (hasPdf) {
      renderPdfPreview(tab, body);
    } else if (hasImages) {
      renderImagesPreview(tab, body);
    } else {
      body.innerHTML += '<p class="empty-state">没有可预览的资源</p>';
    }

    openModal('modal', document.activeElement);
  }

  function renderPreviewModeSelector(tab, body) {
    var modes = [];
    if (tab.files.gpx) modes.push({ key: 'gpx', label: '乐谱' });
    if (tab.files.pdf) modes.push({ key: 'pdf', label: 'PDF' });
    if (tab.files.images && tab.files.images.length > 0) modes.push({ key: 'images', label: '图片' });

    body.innerHTML = '<div class="preview-mode-selector">' +
      modes.map(function (m) {
        return '<button class="mode-btn ' + (m.key === 'gpx' ? 'active' : '') + '" data-mode="' + m.key + '">' + m.label + '</button>';
      }).join('') +
    '</div><div id="preview-content"></div>';

    currentPreviewMode = 'gpx';
    renderGpxPreview(tab, document.getElementById('preview-content'));
  }

  function switchPreviewMode(mode) {
    currentPreviewMode = mode;
    var tab = currentPreviewTab;
    if (!tab) return;

    document.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    var content = document.getElementById('preview-content');
    if (mode === 'gpx') renderGpxPreview(tab, content);
    else if (mode === 'pdf') renderPdfPreview(tab, content);
    else if (mode === 'images') renderImagesPreview(tab, content);
  }

  function renderGpxPreview(tab, container) {
    var gpxFilename = tab.files.gpx.split('/').pop();
    container.innerHTML = '<div class="player-controls">' +
      '<button onclick="window._playerPlay()">▶ 播放</button>' +
      '<button onclick="window._playerPause()">⏸ 暂停</button>' +
      '<button onclick="window._playerStop()">⏹ 停止</button>' +
      '<a href="' + encodeAssetPath(tab.files.gpx) + '" download="' + escapeHtml(gpxFilename) + '">下载 GPX</a>' +
      '<div class="speed-control"><label>速度:</label><input type="range" id="speed-slider" min="25" max="150" value="100" oninput="window._changeSpeed(this.value)"><span id="speed-value">100%</span></div>' +
    '</div>' +
    '<div id="alphaTab-container" class="alpha-tab-container">' +
      '<p class="loading-text">正在加载乐谱...</p>' +
    '</div>';
    requestAnimationFrame(function () { initAlphaTab(tab.files.gpx); });
  }

  function renderPdfPreview(tab, container) {
    container.innerHTML = '<iframe class="preview-pdf" src="' + encodeAssetPath(tab.files.pdf) + '"></iframe>';
  }

  function renderImagesPreview(tab, container) {
    container.innerHTML = '<div class="image-gallery">' + tab.files.images.map(function (img) {
      var filename = img.split('/').pop();
      return '<div class="image-item">' +
        '<img class="preview-image" src="' + encodeAssetPath(img) + '" alt="' + escapeHtml(tab.title) + '" loading="lazy" onclick="window.open(\'' + encodeAssetPath(img) + '\', \'_blank\')">' +
        '<button class="img-download" onclick="window.open(\'' + encodeAssetPath(img) + '\', \'_blank\')">下载 ' + escapeHtml(filename) + '</button>' +
      '</div>';
    }).join('') + '</div>';
  }

  function encodeAssetPath(path) {
    return path.split('/').map(function (s) { return encodeURIComponent(s); }).join('/');
  }

  function initAlphaTab(gpxPath) {
    var container = document.getElementById('alphaTab-container');
    if (!container) return;

    if (alphaTabApi) {
      try { alphaTabApi.destroy(); } catch (e) {}
      alphaTabApi = null;
    }

    container.innerHTML = '<p class="loading-text">正在加载乐谱文件...</p>';

    var encodedUrl = encodeAssetPath(gpxPath);

    fetch(encodedUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        container.innerHTML = '';
        setupAlphaTab(container, buffer);
      })
      .catch(function (err) {
        console.error('GPX load error:', err);
        container.innerHTML = '<p class="error-text">⚠️ 乐谱文件加载失败：' + err.message + '<br><small>路径: ' + gpxPath + '</small></p>';
      });
  }

  function setupAlphaTab(container, buffer) {
    if (!container.offsetWidth) {
      container.style.width = '100%';
      container.style.minWidth = '600px';
    }

    var settings = {
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
      container.innerHTML = '<p class="error-text">⚠️ alphaTab 初始化失败: ' + e.message + '</p>';
      return;
    }

    alphaTabApi.error.on(function (error) {
      console.error('alphaTab Error:', error);
    });

    alphaTabApi.scoreLoaded.on(function (score) {
      console.log('Score loaded:', score ? score.title : 'null', 'Tracks:', score ? score.tracks.length : 0);
      if (score && score.stylesheet) {
        var ss = score.stylesheet;
        if (!ss.perTrackMultiBarRest) ss.perTrackMultiBarRest = new Map();
        if (!ss.perTrackDisplayTuning) ss.perTrackDisplayTuning = new Map();
        if (!ss.perTrackChordDiagramsOnTop) ss.perTrackChordDiagramsOnTop = new Map();
      }
    });

    try {
      var uint8 = new Uint8Array(buffer);
      var success = alphaTabApi.load(uint8);
      console.log('alphaTab load returned:', success);
      if (!success) {
        container.innerHTML = '<p class="error-text">⚠️ 乐谱解析失败</p>';
      }
    } catch (e) {
      console.error('alphaTab load exception:', e);
      container.innerHTML = '<p class="error-text">⚠️ 加载异常: ' + e.message + '</p>';
    }
  }

  // 播放器控制（挂到 window 供内联事件使用）
  window._playerPlay = function () { if (alphaTabApi) alphaTabApi.play(); };
  window._playerPause = function () { if (alphaTabApi) alphaTabApi.pause(); };
  window._playerStop = function () { if (alphaTabApi) alphaTabApi.stop(); };
  window._changeSpeed = function (percent) {
    if (alphaTabApi) {
      alphaTabApi.playbackSpeed = percent / 100;
      document.getElementById('speed-value').textContent = percent + '%';
    }
  };

  function closeMainModal() {
    closeModal('modal');
    if (alphaTabApi) {
      alphaTabApi.destroy();
      alphaTabApi = null;
    }
    currentPreviewTab = null;
    currentPreviewMode = 'gpx';
  }

  // === 提交谱子 ===

  var API_BASE = ''; // 同域，Worker 反代

  function openSubmitModal() {
    var modal = document.getElementById('submitModal');
    modal.classList.remove('hidden');

    var select = document.getElementById('submitCategory');
    select.innerHTML = '<option value="">-- 选择分类 --</option>';
    fetch(API_BASE + '/api/categories')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          data.categories.forEach(function (cat) {
            var opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
          });
        }
      })
      .catch(function () {});

    var newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ 新建分类';
    select.appendChild(newOpt);

    var fileInput = document.getElementById('submitFiles');
    if (!fileInput._bound) {
      fileInput.addEventListener('change', handleFileSelect);
      fileInput._bound = true;
    }

    openModal('submitModal', document.activeElement);
  }

  function handleFileSelect(e) {
    var tags = document.getElementById('fileTags');
    tags.innerHTML = '';
    var files = e.target.files;
    var totalSize = 0;

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      totalSize += file.size;
      var ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      var type = 'unknown';
      if (['.gp', '.gp3', '.gp4', '.gp5', '.gp7', '.gp8', '.gpx'].includes(ext)) type = 'GPX';
      else if (ext === '.pdf') type = 'PDF';
      else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) type = '图片';

      var tag = document.createElement('span');
      tag.className = 'file-tag ' + (type === 'unknown' ? 'unsupported' : type.toLowerCase());
      tag.textContent = file.name + ' (' + type + (file.size > 1024 * 1024 ? ' ' + (file.size / 1024 / 1024).toFixed(1) + 'MB' : '') + ')';
      tags.appendChild(tag);
    }

    if (files.length > 0) {
      var sizeTag = document.createElement('span');
      sizeTag.className = 'file-tag total';
      sizeTag.textContent = '总计: ' + (totalSize / 1024 / 1024).toFixed(1) + 'MB / 50MB';
      sizeTag.style.background = totalSize > 50 * 1024 * 1024 ? 'rgba(248,81,73,0.2)' : '';
      tags.appendChild(sizeTag);
    }
  }

  function closeSubmitModal() {
    closeModal('submitModal');
    document.getElementById('submitForm').reset();
    document.getElementById('fileTags').innerHTML = '';
    document.getElementById('submitResult').innerHTML = '';
    document.getElementById('newCategory').style.display = 'none';
    isSubmitting = false;
  }

  function submitTab() {
    if (isSubmitting) return;
    isSubmitting = true;

    var btn = document.querySelector('.submit-form-btn');
    var result = document.getElementById('submitResult');
    btn.disabled = true;
    btn.textContent = '提交中...';
    result.innerHTML = '<p class="result-loading">⏳ 上传中，请稍候...</p>';

    var category = document.getElementById('submitCategory').value === '__new__'
      ? document.getElementById('newCategory').value.trim()
      : document.getElementById('submitCategory').value;
    var songGroup = document.getElementById('submitSongGroup').value.trim();
    var contributor = document.getElementById('submitContributor').value.trim();
    var bilibili = document.getElementById('submitBilibili').value.trim();
    var password = document.getElementById('submitPassword').value;
    var files = document.getElementById('submitFiles').files;

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

    var formData = new FormData();
    formData.append('category', category);
    formData.append('songGroup', songGroup);
    formData.append('contributor', contributor);
    formData.append('bilibili', bilibili);
    formData.append('password', password);
    for (var i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    fetch(API_BASE + '/api/submit', { method: 'POST', body: formData })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          result.innerHTML = '<p class="result-success">✅ ' + data.message + '</p>';
          btn.textContent = '提交成功！';
          setTimeout(function () { closeSubmitModal(); }, 2000);
        } else {
          result.innerHTML = '<p class="result-error">❌ ' + data.error + '</p>';
          resetSubmitBtn(btn);
        }
      })
      .catch(function () {
        result.innerHTML = '<p class="result-error">❌ 网络错误，请稍后重试</p>';
        resetSubmitBtn(btn);
      });
  }

  function resetSubmitBtn(btn) {
    isSubmitting = false;
    btn.disabled = false;
    btn.textContent = '提交';
  }

  // === 管理员面板 ===

  function openAdminPanel() {
    document.getElementById('adminModal').classList.remove('hidden');
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    adminAuthed = false;
    openModal('adminModal', document.activeElement);
  }

  function closeAdminPanel() {
    closeModal('adminModal');
  }

  function loginAdmin() {
    var pwd = document.getElementById('adminPassword').value;
    if (!pwd) return;

    fetch(API_BASE + '/api/tabs-data', { headers: { Authorization: 'Bearer ' + pwd } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          adminAuthed = true;
          document.getElementById('adminContent').style.display = 'block';
          document.querySelector('.admin-auth').style.display = 'none';
          window._adminTabsData = data.data;
          showAdminTabList();
        } else {
          alert('密码错误');
        }
      })
      .catch(function () { alert('登录失败'); });
  }

  function showAdminTabList() {
    var container = document.getElementById('adminTabContent');
    var tabs = window._adminTabsData || [];
    if (tabs.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无谱子</p>';
      return;
    }
    container.innerHTML = '<div class="admin-actions"><span>' + tabs.length + ' 首谱子</span>' +
      '<button onclick="refreshAdminData()" class="admin-refresh-btn">刷新</button></div>' +
      tabs.map(function (t) {
        return '<div class="admin-tab-item">' +
          '<div class="admin-tab-info">' +
            '<strong>' + escapeHtml(t.title) + '</strong>' +
            '<span class="admin-tag">' + escapeHtml(t.category) + '</span>' +
            '<span class="admin-tag">' + (t.formats || []).join(', ') + '</span>' +
            '<span class="admin-contrib">' + escapeHtml((t.contributor && t.contributor.name) || '') + '</span>' +
          '</div>' +
          '<button onclick="deleteTab(' + t.id + ')" class="admin-delete-btn">删除</button>' +
        '</div>';
      }).join('');
  }

  function showAdminLogs() {
    var container = document.getElementById('adminTabContent');
    container.innerHTML = '<p class="loading-text">加载中...</p>';
    fetch(API_BASE + '/api/admin/logs', { headers: { Authorization: 'Bearer ' + document.getElementById('adminPassword').value } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success || !data.logs.length) {
          container.innerHTML = '<p class="empty-state">暂无日志</p>';
          return;
        }
        container.innerHTML = data.logs.map(function (log) {
          return '<div class="admin-log-item">' +
            '<span class="log-action ' + log.action + '">' + (log.action === 'submit' ? '新增' : '删除') + '</span>' +
            '<span class="log-title">' + escapeHtml(log.title) + '</span>' +
            '<span class="log-meta">' + escapeHtml(log.category || '') + ' · ' + escapeHtml(log.contributor || '') + '</span>' +
            '<span class="log-time">' + (log.time ? log.time.replace('T', ' ').slice(0, 16) : '') + '</span>' +
          '</div>';
        }).join('');
      })
      .catch(function () { container.innerHTML = '<p class="error-text">加载失败</p>'; });
  }

  function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
    event.target.classList.add('active');
    if (tab === 'tabs') showAdminTabList();
    else if (tab === 'logs') showAdminLogs();
  }

  function deleteTab(id) {
    if (!confirm('确定要删除这首谱子吗？此操作不可恢复。')) return;
    var pwd = document.getElementById('adminPassword').value;
    fetch(API_BASE + '/api/tabs/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + pwd } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          window._adminTabsData = window._adminTabsData.filter(function (t) { return t.id !== id; });
          showAdminTabList();
        } else {
          alert('删除失败: ' + data.error);
        }
      })
      .catch(function () { alert('删除失败'); });
  }

  function refreshAdminData() {
    var pwd = document.getElementById('adminPassword').value;
    fetch(API_BASE + '/api/tabs-data', { headers: { Authorization: 'Bearer ' + pwd } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          window._adminTabsData = data.data;
          showAdminTabList();
        }
      });
  }

  // === 致谢墙 ===

  function showCredits() {
    var modal = document.getElementById('credits-modal');
    var list = document.getElementById('credits-list');

    var contributors = {};
    tabsData.forEach(function (tab) {
      if (tab.contributor) {
        var key = tab.contributor.bilibili || tab.contributor.name || tab.contributor.uid;
        if (!contributors[key]) {
          contributors[key] = { name: tab.contributor.name || tab.contributor.uid || '匿名', bilibili: tab.contributor.bilibili || tab.contributor.url, count: 1 };
        } else {
          contributors[key].count++;
        }
      }
    });

    var keys = Object.keys(contributors);
    if (keys.length === 0) {
      list.innerHTML = '<li class="credits-empty">还没有贡献者，等你来当第一个！</li>';
    } else {
      list.innerHTML = keys.map(function (key) {
        var c = contributors[key];
        var link = c.bilibili ? '<a href="' + c.bilibili + '" target="_blank" rel="noopener">' + escapeHtml(c.name) + '</a>' : escapeHtml(c.name);
        return '<li><span class="credits-name">' + link + '</span><span class="credits-count">贡献 ' + c.count + ' 首</span></li>';
      }).join('');
    }

    openModal('credits-modal', document.activeElement);
  }

  function closeCredits() {
    closeModal('credits-modal');
  }

  // === 事件绑定 ===

  function bindEvents() {
    // 分类卡片点击
    document.getElementById('tab-list').addEventListener('click', function (e) {
      var card = e.target.closest('.category-card');
      if (card) {
        openCategory(card.dataset.category);
        return;
      }

      var tabCard = e.target.closest('.tab-card');
      if (tabCard) {
        if (tabCard.dataset.id) {
          openPreviewById(parseInt(tabCard.dataset.id));
        } else if (tabCard.dataset.song) {
          openSongGroup(tabCard.dataset.song);
        }
      }
    });

    // 键盘支持
    document.getElementById('tab-list').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.category-card, .tab-card');
      if (card) {
        e.preventDefault();
        card.click();
      }
    });

    // 返回按钮
    document.getElementById('back-btn').addEventListener('click', goBack);

    // 搜索框清空时恢复
    document.getElementById('search-input').addEventListener('input', filterTabs);

    // 模态框关闭（点击背景）
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target === this) closeMainModal();
    });
    document.getElementById('credits-modal').addEventListener('click', function (e) {
      if (e.target === this) closeCredits();
    });
    document.getElementById('submitModal').addEventListener('click', function (e) {
      if (e.target === this) closeSubmitModal();
    });
    document.getElementById('adminModal').addEventListener('click', function (e) {
      if (e.target === this) closeAdminPanel();
    });

    // 关闭按钮
    document.querySelectorAll('.close-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var modal = btn.closest('.modal');
        if (!modal) return;
        var modalId = modal.id;
        if (modalId === 'modal') closeMainModal();
        else if (modalId === 'credits-modal') closeCredits();
        else if (modalId === 'submitModal') closeSubmitModal();
        else if (modalId === 'adminModal') closeAdminPanel();
      });
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('modal').classList.contains('hidden')) closeMainModal();
      if (!document.getElementById('credits-modal').classList.contains('hidden')) closeCredits();
      if (!document.getElementById('submitModal').classList.contains('hidden')) closeSubmitModal();
      if (!document.getElementById('adminModal').classList.contains('hidden')) closeAdminPanel();
    });

    // 提交表单按钮
    document.getElementById('submitWish').addEventListener('click', submitTab);
    document.getElementById('submitFiles').addEventListener('change', handleFileSelect);

    // 管理员登录
    document.getElementById('adminLoginBtn').addEventListener('click', loginAdmin);
    document.getElementById('adminPassword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loginAdmin();
    });
  }

  function goBack() {
    if (currentView === 'search') {
      renderCategories();
    } else if (currentView === 'versions') {
      currentView = 'tabs';
      document.getElementById('search-input').style.display = 'block';
      document.getElementById('back-btn').textContent = '← 返回分类';
      renderTabList(currentCategory);
    } else if (currentView === 'tabs') {
      renderCategories();
    }
  }

  // === 启动 ===
  document.addEventListener('DOMContentLoaded', function () {
    renderCategories();
    bindEvents();
  });

  // 暴露给内联事件（兼容旧代码）
  window.openPreview = openPreviewById;
  window.openSubmitModal = openSubmitModal;
  window.closeSubmitModal = closeSubmitModal;
  window.openAdminPanel = openAdminPanel;
  window.closeAdminPanel = closeAdminPanel;
  window.showCredits = showCredits;
  window.closeCredits = closeCredits;
  window.submitTab = submitTab;
  window.loginAdmin = loginAdmin;
  window.switchAdminTab = switchAdminTab;
  window.deleteTab = deleteTab;
  window.refreshAdminData = refreshAdminData;
  window.showAdminTab = showAdminTabList;
  window.showAdminLogs = showAdminLogs;
  window.handleFileSelect = handleFileSelect;
})();
