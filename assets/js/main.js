/* ==========================================================================
   main.js —— 启动、路由、全局弹窗、剧透联动、SW 注册
   ========================================================================== */
(function (global) {
  'use strict';

  var VIEWS = ['map', 'codex', 'quests', 'guide', 'memes', 'mods', 'save'];
  var booted = false;
  var mapInited = false;

  /* ---------------- 全局 UI 工具 ---------------- */
  var ui = {
    openModal: function () { document.getElementById('modal').hidden = false; },
    closeModal: function () { document.getElementById('modal').hidden = true; },
    go: function (view) {
      if (location.hash === '#/' + view) applyRoute();
      else location.hash = '#/' + view;
    },
    toast: function (text) {
      var el = document.createElement('div');
      el.className = 'tile-warn';
      el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:70;background:#121214';
      el.textContent = text;
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 2200);
    }
  };

  /* ---------------- 路由 ---------------- */
  function currentView() {
    var m = /^#\/(\w+)/.exec(location.hash);
    return (m && VIEWS.indexOf(m[1]) > -1) ? m[1] : 'map';
  }

  function applyRoute() {
    var view = currentView();

    VIEWS.forEach(function (v) {
      var section = document.getElementById('view-' + v);
      if (section) section.hidden = (v !== view);
    });

    document.querySelectorAll('.tabs a, .bottombar a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.view === view);
    });

    if (!ER.data) return;   // 数据未就绪时只切视图，不做模块初始化

    if (view === 'map') {
      if (!mapInited) {
        mapInited = true;
        // 等布局完成再初始化，避免容器尺寸为 0
        setTimeout(function () { ER.map.init(ER.data.pois, ER.quests.all()); }, 30);
      } else {
        ER.map.resize();
      }
    }

    // 树在隐藏状态下渲染时容器宽度为 0，切回来需要重绘一次
    if (view === 'quests' && ER.quests.reRender) ER.quests.reRender();

    window.scrollTo(0, 0);
  }

  /* ---------------- 剧透 ---------------- */
  function bindSpoiler() {
    var sel = document.getElementById('spoilerSelect');
    sel.value = String(ER.store.getSpoiler());
    sel.addEventListener('change', function () {
      ER.store.setSpoiler(Number(sel.value));
    });
    // 其它模块修改剧透时同步下拉框
    ER.store.on(function (type, value) {
      if (type === 'spoiler') sel.value = String(value);
    });
  }

  /* ---------------- PWA 安装 ---------------- */
  function bindInstall() {
    var btn = document.getElementById('installBtn');
    if (!btn) return;

    // 微信内不可安装；独立窗口已安装过
    if (/micromessenger/i.test(navigator.userAgent)) return;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;

    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });

    btn.addEventListener('click', function () {
      if (!deferred) { btn.hidden = true; return; }
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; btn.hidden = true; });
    });

    window.addEventListener('appinstalled', function () { deferred = null; btn.hidden = true; });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (booted) return;
    booted = true;

    // 路由先跑起来，视图切换不必等数据
    window.addEventListener('hashchange', applyRoute);
    if (!location.hash) location.hash = '#/map';

    bindSpoiler();
    bindInstall();
    document.getElementById('modalClose').addEventListener('click', ui.closeModal);
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target.id === 'modal') ui.closeModal();
    });

    Promise.all([
      ER.util.loadJSON('data/pois.json'),
      ER.util.loadJSON('data/codex.json'),
      ER.util.loadJSON('data/quests.json'),
      ER.util.loadJSON('data/memes.json'),
      ER.util.loadJSON('data/mods.json'),
      ER.util.loadJSON('data/guide.json')
    ]).then(function (res) {
      ER.data = { pois: res[0], codex: res[1], quests: res[2], memes: res[3], mods: res[4], guide: res[5] };

      ER.quests.init(ER.data.quests);      // 支线必须先初始化，引导页要按 id 取名字
      ER.codex.init(ER.data.codex);
      ER.guide.init(ER.data.guide);
      ER.memes.init(ER.data.memes);
      ER.mods.init(ER.data.mods);

      applyRoute();
    }).catch(function (err) {
      console.error(err);
      ui.toast('数据加载失败：请通过本地服务器打开（file:// 不能读取 JSON）');
    });

    // Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('[PWA]', e); });
      });
    }

    window.addEventListener('resize', ER.util.debounce(function () {
      if (mapInited) ER.map.resize();
    }, 200));
  }

  global.ER = global.ER || {};
  global.ER.ui = ui;
  global.ER.boot = boot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
