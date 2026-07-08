/**
 * 学术期刊优化平台 — 交互脚本
 * =============================
 * 功能:
 *  - 返回顶部按钮显隐
 *  - 移动端导航汉堡菜单
 *  - 搜索过滤论文列表
 *  - 上传区拖拽交互
 *  - 论文详情侧边目录高亮
 *  - 筛选面板重置
 */

// ── 返回顶部按钮 ──
(function() {
  var btn = document.querySelector('.back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
})();

// ── 移动端导航 ──
(function() {
  var toggle = document.querySelector('.navbar-toggle');
  var links = document.querySelector('.navbar-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', function() {
    links.classList.toggle('open');
  });
  // 点击链接后关闭
  links.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() { links.classList.remove('open'); });
  });
})();

// ── 搜索过滤 ──
(function() {
  var searchInput = document.querySelector('.search-bar input');
  if (!searchInput) return;
  searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    var cards = document.querySelectorAll('.paper-card');
    var hasResults = false;
    cards.forEach(function(card) {
      var text = (card.textContent || '').toLowerCase();
      var match = !query || text.indexOf(query) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) hasResults = true;
    });
    var noResults = document.getElementById('no-results');
    if (noResults) {
      noResults.style.display = hasResults ? 'none' : 'block';
    }
  });
})();

// ── 筛选面板 ──
(function() {
  var filterPanel = document.querySelector('.filter-panel');
  if (!filterPanel) return;

  var checkboxes = filterPanel.querySelectorAll('input[type="checkbox"]');
  var resetBtn = filterPanel.querySelector('.filter-reset');

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      checkboxes.forEach(function(cb) { cb.checked = true; });
      filterCards();
    });
  }

  checkboxes.forEach(function(cb) {
    cb.addEventListener('change', filterCards);
  });

  function getActiveFilters() {
    var active = {};
    checkboxes.forEach(function(cb) {
      var group = cb.closest('.filter-group');
      if (!group) return;
      var label = group.querySelector('.filter-group-label');
      var groupName = label ? label.textContent.trim() : 'other';
      if (!active[groupName]) active[groupName] = [];
      if (cb.checked) active[groupName].push(cb.value);
    });
    return active;
  }

  function filterCards() {
    var filters = getActiveFilters();
    var cards = document.querySelectorAll('.paper-card');
    cards.forEach(function(card) {
      var visible = true;
      // 检查每个筛选组
      for (var group in filters) {
        var values = filters[group];
        if (values.length === 0) continue;
        var dataAttr = card.getAttribute('data-' + group.toLowerCase().replace(/\s+/g, '-'));
        if (dataAttr) {
          var cardValues = dataAttr.split(',');
          var match = values.some(function(v) { return cardValues.indexOf(v) !== -1; });
          if (!match) visible = false;
        }
      }
      card.style.display = visible ? '' : 'none';
    });
  }
})();

// ── 上传拖拽交互 ──
(function() {
  var uploadZone = document.querySelector('.upload-zone');
  if (!uploadZone) return;
  var fileInput = uploadZone.querySelector('input[type="file"]');
  var statusEl = document.getElementById('upload-status');

  // 点击触发文件选择
  uploadZone.addEventListener('click', function() {
    if (fileInput) fileInput.click();
  });

  // 拖拽事件
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(evt) {
    uploadZone.addEventListener(evt, function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(function(evt) {
    uploadZone.addEventListener(evt, function() {
      uploadZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function(evt) {
    uploadZone.addEventListener(evt, function() {
      uploadZone.classList.remove('dragover');
    });
  });

  uploadZone.addEventListener('drop', function(e) {
    var files = e.dataTransfer.files;
    handleFiles(files);
  });

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      handleFiles(this.files);
    });
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    var file = files[0];
    if (!file.name.endsWith('.xml')) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--color-danger)">请上传 .xml 格式的 JATS 文件</span>';
      return;
    }
    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--color-success)">已选择: ' + file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)</span>';
    }
    // 读取文件内容用于预览
    var reader = new FileReader();
    reader.onload = function(e) {
      var content = e.target.result;
      // 可以将内容传给预览区（iframe srcdoc）或触发转换
      updatePreview(content);
    };
    reader.readAsText(file);
  }

  function updatePreview(xmlContent) {
    var previewFrame = document.querySelector('.preview-area iframe');
    var placeholder = document.querySelector('.preview-placeholder');
    if (previewFrame) {
      // 简单预览：显示XML源码（实际应由后端解析后渲染）
      previewFrame.srcdoc = '<pre style="padding:16px;font-size:12px;white-space:pre-wrap;word-break:break-all">' +
        xmlContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
        '</pre>';
      if (placeholder) placeholder.style.display = 'none';
      previewFrame.style.display = 'block';
    }
  }
})();

// ── 论文目录高亮（滚动监听） ──
(function() {
  var tocLinks = document.querySelectorAll('.article-toc a');
  if (tocLinks.length === 0) return;

  var headings = [];
  tocLinks.forEach(function(link) {
    var href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      var el = document.querySelector(href);
      if (el) headings.push({ el: el, link: link });
    }
  });

  if (headings.length === 0) return;

  window.addEventListener('scroll', function() {
    var scrollPos = window.scrollY + 120;
    var current = null;
    headings.forEach(function(item) {
      if (item.el.offsetTop <= scrollPos) {
        current = item;
      }
    });
    tocLinks.forEach(function(link) { link.classList.remove('active'); });
    if (current) current.link.classList.add('active');
  });
})();

// ── 列表页无结果提示 ──
(function() {
  var noResults = document.getElementById('no-results');
  if (noResults) noResults.style.display = 'none';
})();
