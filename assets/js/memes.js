/* ==========================================================================
   memes.js —— 梗百科（可跳转地图点位）
   ========================================================================== */
(function (global) {
  'use strict';

  var data = [];

  function init(list) {
    data = list || [];
    render();
    ER.store.on(function (type) { if (type === 'spoiler') render(); });
  }

  function render() {
    var lv = ER.store.getSpoiler();
    var grid = document.getElementById('memeGrid');

    var list = data.filter(function (m) { return m.spoiler <= lv; });

    grid.innerHTML = list.map(function (m) {
      return '<article class="card">' +
        '<div class="card-tag">' + ER.util.esc(m.tag) + '</div>' +
        '<h3>' + ER.util.esc(m.t) + '</h3>' +
        '<p>' + ER.util.esc(m.d) + '</p>' +
        (m.poi
          ? '<div class="card-actions"><button class="btn-ghost" data-poi="' + ER.util.esc(m.poi) + '">在地图查看</button></div>'
          : '<div class="card-meta" style="margin-top:12px">无关联点位</div>') +
        '</article>';
    }).join('') || '<p class="empty">当前剧透等级下没有可显示的条目。</p>';

    grid.querySelectorAll('[data-poi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.poi;
        ER.ui.go('map');
        setTimeout(function () {
          if (!ER.map.focus(name)) ER.ui.toast('地图上没有找到该点位');
        }, 320);
      });
    });
  }

  global.ER = global.ER || {};
  global.ER.memes = { init: init };
})(window);
