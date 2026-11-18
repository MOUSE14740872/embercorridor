/* ==========================================================================
   mods.js —— MOD 指引：标签筛选 + 关键词搜索
   ========================================================================== */
(function (global) {
  'use strict';

  var data = [];
  var tag = 'all';
  var kw = '';

  var RISK = { '低': 'risk-low', '中': 'risk-mid', '高': 'risk-high' };

  function init(list) {
    data = list || [];
    drawTags();
    document.getElementById('modSearch').addEventListener('input', function (e) {
      kw = e.target.value.trim().toLowerCase();
      render();
    });
    render();
  }

  function tags() {
    var set = {};
    data.forEach(function (m) { (m.tags || []).forEach(function (t) { set[t] = 1; }); });
    return Object.keys(set);
  }

  function drawTags() {
    var box = document.getElementById('modTags');
    var items = ['all'].concat(tags());
    box.innerHTML = items.map(function (t) {
      return '<button class="chip' + (t === tag ? ' active' : '') + '" data-tag="' + t + '">' +
        (t === 'all' ? '全部' : ER.util.esc(t)) + '</button>';
    }).join('');

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tag]');
      if (!btn) return;
      tag = btn.dataset.tag;
      box.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === btn); });
      render();
    });
  }

  function render() {
    var list = data.filter(function (m) {
      if (tag !== 'all' && (m.tags || []).indexOf(tag) === -1) return false;
      if (!kw) return true;
      return (m.t + m.d + (m.tags || []).join('')).toLowerCase().indexOf(kw) > -1;
    });

    document.getElementById('modList').innerHTML = list.map(function (m) {
      return '<div class="mod-row">' +
        '<h3>' + ER.util.esc(m.t) + '</h3>' +
        '<p>' + ER.util.esc(m.d) + '</p>' +
        '<div class="mod-tags">' +
        (m.tags || []).map(function (t) { return '<span class="mod-tag">' + ER.util.esc(t) + '</span>'; }).join('') +
        '<span class="mod-tag ' + (RISK[m.risk] || '') + '">风险 ' + ER.util.esc(m.risk || '未知') + '</span>' +
        '</div></div>';
    }).join('') || '<p class="empty">没有匹配的 MOD。</p>';
  }

  global.ER = global.ER || {};
  global.ER.mods = { init: init };
})(window);
