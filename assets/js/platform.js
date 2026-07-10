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
  // 客户端即时过滤
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
  // Enter 键触发客户端过滤（已在首页卡片上生效）
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
      var key = cb.getAttribute('data-filter-key') || 'keywords';
      if (!active[key]) active[key] = [];
      if (cb.checked) active[key].push(cb.value.trim().toLowerCase());
    });
    return active;
  }

  function filterCards() {
    var filters = getActiveFilters();
    var cards = document.querySelectorAll('.paper-card');
    var hasVisible = false;
    cards.forEach(function(card) {
      var visible = true;
      // keywords filter
      if (filters['keywords'] && filters['keywords'].length > 0) {
        var kwAttr = card.getAttribute('data-keywords') || '';
        var cardKWs = kwAttr.split(',').map(function(k) { return k.trim().toLowerCase(); });
        var match = filters['keywords'].some(function(v) { return cardKWs.indexOf(v) !== -1; });
        if (!match) visible = false;
      }
      // year filter
      if (filters['year'] && filters['year'].length > 0) {
        var cardYear = (card.getAttribute('data-year') || '').trim();
        if (filters['year'].indexOf(cardYear) === -1) visible = false;
      }
      card.style.display = visible ? '' : 'none';
      if (visible) hasVisible = true;
    });
    var noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = hasVisible ? 'none' : 'block';
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
    // 触发上传转换（调用 upload.html 中的全局函数）
    if (window.setUploadFile) {
      window.setUploadFile(file);
    }
  }

  function updatePreview(xmlContent) {
    // 不再显示原始 XML；upload API 返回渲染后的 HTML。
    // 如果还未上传，显示提示
    var placeholder = document.querySelector('.preview-placeholder');
    var statusEl2 = document.getElementById('upload-status');
    if (statusEl2 && placeholder && placeholder.style.display !== 'none') {
      statusEl2.innerHTML = '<span style="color:var(--color-accent)">正在处理文件，请稍候...</span>';
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

// ── 文章页全局函数 ──
(function() {
  // 下载文章 PDF
  window.downloadArticlePDF = function(articleId, refStyle, twoColumn) {
    var params = new URLSearchParams({
      ref_style: refStyle || 'elsevier',
      two_column: twoColumn ? 'true' : 'false'
    });
    var url = '/api/articles/' + articleId + '/pdf?' + params.toString();
    var a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 下载文章 HTML
  window.downloadArticleHTML = function(articleId, refStyle, twoColumn) {
    var params = new URLSearchParams({
      ref_style: refStyle || 'elsevier',
      two_column: twoColumn ? 'true' : 'false'
    });
    var url = '/api/articles/' + articleId + '/html?' + params.toString();
    var a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
})();
