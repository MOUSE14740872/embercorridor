/* ==========================================================================
   guide.js —— 新手开荒引导（按剧透等级 + 支线进度动态给建议）
   ========================================================================== */
(function (global) {
  'use strict';

  var data = [];

  function init(list) {
    data = list || [];
    render();
    ER.store.on(function (type) {
      if (type === 'spoiler' || type === 'progress') render();
    });
  }

  function render() {
    var lv = ER.store.getSpoiler();
    var prog = ER.store.getAllProgress();
    var box = document.getElementById('guideList');

    var rows = data
      .filter(function (t) { return t.spoiler <= lv; })
      .map(function (t) {
        var locked = !!(t.need && !(prog[t.need] > 0));
        return { t: t, locked: locked };
      })
      // 已解锁的排前面
      .sort(function (a, b) { return (a.locked ? 1 : 0) - (b.locked ? 1 : 0); });

    if (!rows.length) {
      box.innerHTML = '<p class="empty">当前剧透等级下没有可显示的建议。把等级调到 1 级试试。</p>';
      return;
    }

    box.innerHTML = rows.map(function (row, i) {
      var t = row.t;
      var tag = t.need
        ? (row.locked ? '需推进：' + questName(t.need) : '关联支线：' + questName(t.need))
        : '通用建议';

      return '<article class="guide-item' + (row.locked ? ' locked' : '') + '">' +
        '<div class="guide-idx">' + (i + 1) + '</div>' +
        '<div><h3>' + ER.util.esc(t.t) + '</h3>' +
        '<p>' + (row.locked ? '完成对应支线后解锁这条建议。' : ER.util.esc(t.d)) + '</p>' +
        '<div class="guide-tag">' + ER.util.esc(tag) + ' · 剧透等级 ' + t.spoiler + '</div>' +
        '</div></article>';
    }).join('');
  }

  function questName(id) {
    var q = ER.quests.findById(id);
    return q ? q.name : id;
  }

  global.ER = global.ER || {};
  global.ER.guide = { init: init };
})(window);
