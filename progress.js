// === Page Reading Progress Tracker (optimized) ===
(function() {
  var PAGE_KEY_PREFIX = 'gaoshu_progress_';

  function getUser() { return window.gaoshuUser || 'guest'; }

  function getStorageKey() {
    return PAGE_KEY_PREFIX + getUser();
  }

  function getAllProgress() {
    var key = getStorageKey();
    if (!key) return {};
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch(e) { return {}; }
  }

  function saveAllProgress(data) {
    var key = getStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(data));
  }

  function getPageId() {
    var path = window.location.pathname;
    var file = path.split('/').pop() || 'index';
    return file.replace('.html', '');
  }

  // === Content pages: save scroll progress ===
  function initContentProgress() {
    var pageId = getPageId();
    if (pageId === 'index' || pageId === 'login') return;

    var lastSave = 0;
    var dirty = false;
    var lastPercent = -1;

    function saveProgress() {
      var scrollTop = window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var percent = docHeight > 0 ? Math.min(100, Math.round(scrollTop / docHeight * 100)) : 0;

      // Only write if percent actually changed
      if (percent === lastPercent) return;
      lastPercent = percent;

      var data = getAllProgress();
      data[pageId] = {
        scrollPercent: percent,
        lastVisit: Date.now(),
        title: document.title
      };
      saveAllProgress(data);
      dirty = false;
    }

    // Throttled: mark dirty on scroll, save every 2s via interval
    window.addEventListener('scroll', function() { dirty = true; }, {passive: true});

    var saveInterval = setInterval(function() {
      if (dirty) saveProgress();
    }, 2000);

    // Save on page leave
    window.addEventListener('beforeunload', function() {
      clearInterval(saveInterval);
      saveProgress();
    });

    // Restore scroll position
    function restoreProgress() {
      var data = getAllProgress();
      var saved = data[pageId];
      if (saved && saved.scrollPercent > 0 && saved.scrollPercent < 100) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          window.scrollTo(0, (saved.scrollPercent / 100) * docHeight);
        }
      }
    }

    // Restore after KaTeX render
    setTimeout(restoreProgress, 800);

    // Initial save to mark visited
    setTimeout(saveProgress, 100);
  }

  // === Index page: show progress indicators ===
  function initIndexProgress() {
    if (getPageId() !== 'index') return;
    var data = getAllProgress();
    var links = document.querySelectorAll('a.sec');

    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var id = href.replace('.html', '');
      var info = data[id];
      var indicator = document.createElement('div');
      indicator.className = 'progress-indicator';

      if (info && info.scrollPercent !== undefined) {
        var pct = info.scrollPercent;
        indicator.innerHTML = '<div class="progress-bar-wrap">'
          + '<div class="progress-bar-fill" style="width:' + pct + '%"></div></div>'
          + '<span class="progress-label">'
          + (pct >= 100 ? '✅ 已读完' : pct + '% · ' + getTimeAgo(info.lastVisit))
          + '</span>';
        if (pct >= 100) indicator.classList.add('complete');
      } else {
        indicator.innerHTML = '<span class="progress-label not-started">未开始</span>';
      }
      link.appendChild(indicator);
    });
  }

  function getTimeAgo(timestamp) {
    if (!timestamp) return '';
    var mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + '小时前';
    return Math.floor(hours / 24) + '天前';
  }

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = '.progress-indicator{margin-top:6px;display:flex;align-items:center;gap:8px;}'
      + '.progress-bar-wrap{flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden;max-width:180px;}'
      + '.progress-bar-fill{height:100%;background:linear-gradient(90deg,#1a5276,#2980b9);border-radius:3px;transition:width .3s;}'
      + '.progress-indicator.complete .progress-bar-fill{background:linear-gradient(90deg,#27ae60,#2ecc71);}'
      + '.progress-label{font-size:.75em;color:#888;white-space:nowrap;}'
      + '.progress-label.not-started{color:#bbb;font-style:italic;}'
      + '.progress-indicator.complete .progress-label{color:#27ae60;font-weight:600;}';
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectStyles(); initContentProgress(); initIndexProgress();
    });
  } else {
    injectStyles(); initContentProgress(); initIndexProgress();
  }
})();
