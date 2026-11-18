/* ==========================================================================
   quests.js —— 支线总览：SVG 树 + 逐条推进 + 跳转地图
   ========================================================================== */
(function (global) {
  'use strict';

  var quests = [];
  var filter = 'all';
  var host, listBox;

  function init(data) {
    quests = data || [];
    host = document.getElementById('questTreeHost');
    listBox = document.getElementById('questList');

    document.getElementById('questCount').textContent = quests.length;

    drawFilters();
    drawZoom();
    render();

    ER.store.on(function (type) {
      if (type === 'progress' || type === 'spoiler') render();
    });
  }

  function drawFilters() {
    var box = document.getElementById('questFilters');
    var items = [
      { k: 'all', label: '全部' },
      { k: 'main', label: '主线相关' },
      { k: 'side', label: '支线' }
    ];
    box.innerHTML = items.map(function (i) {
      return '<button class="chip' + (i.k === filter ? ' active' : '') + '" data-k="' + i.k + '">' + i.label + '</button>';
    }).join('');

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-k]');
      if (!btn) return;
      filter = btn.dataset.k;
      box.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === btn); });
      render();
    });
  }

  function drawZoom() {
    document.querySelectorAll('#view-quests [data-tree]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.tree;
        ER.tree.zoomBy(host, act === 'in' ? 0.2 : act === 'out' ? -0.2 : 'reset');
        document.getElementById('questZoomLabel').textContent = Math.round(ER.tree.getZoom() * 100) + '%';
      });
    });
  }

  function visible() {
    return quests.filter(function (q) { return filter === 'all' || q.group === filter; });
  }

  function render() {
    var list = visible();

    ER.tree.render(host, {
      quests: list,
      onClick: function (id, stage, node) { showNodeModal(id, stage, node); }
    });
    document.getElementById('questZoomLabel').textContent = Math.round(ER.tree.getZoom() * 100) + '%';

    listBox.innerHTML = list.map(function (q) {
      var done = ER.store.getQuestProgress(q.id);
      var total = q.stages.length;
      var pct = Math.round(done / total * 100);

      return '<div class="quest-row">' +
        '<div><h3>' + ER.util.esc(q.name) + ' · ' + ER.util.esc(q.npc) + '</h3>' +
        '<p>' + total + ' 个阶段 · 已完成 ' + Math.min(done, total) + ' 步' +
        (done >= total ? ' · <span style="color:#d4af37">已收束</span>' : '') + '</p></div>' +
        '<div class="progress">' +
        '<div class="progress-bar"><i style="width:' + pct + '%"></i></div>' +
        '<button class="btn-ghost" data-adv="' + q.id + '" type="button">推进</button>' +
        '<button class="btn-ghost" data-back="' + q.id + '" type="button">回退</button>' +
        '</div></div>';
    }).join('');

    listBox.querySelectorAll('[data-adv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = findById(btn.dataset.adv);
        ER.store.advanceQuest(q.id, q.stages.length);
      });
    });
    listBox.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = findById(btn.dataset.back);
        ER.store.setQuestProgress(q.id, Math.max(0, ER.store.getQuestProgress(q.id) - 1));
      });
    });
  }

  function findById(id) {
    return quests.find(function (q) { return q.id === id; });
  }

  /* ---------------- 节点详情 ---------------- */
  function showNodeModal(id, stage, nodeEl) {
    var q = findById(id);
    if (!q) return;
    var lv = ER.store.getSpoiler();
    var node = q.stages[stage] && q.stages[stage][0];
    if (!node) return;

    var title = lv >= 2 ? (node.l2 || node.l1) : node.l1;
    var detail = lv >= 2 ? node.x2 : (lv === 1 ? '提高剧透等级可查看结局 / 奖励 / 生死信息' : '切换剧透等级查看详情');

    document.getElementById('modalBody').innerHTML =
      '<h3>' + ER.util.esc(q.name) + ' · 第 ' + (stage + 1) + ' 步</h3>' +
      '<p class="hint">' + ER.util.esc(q.npc) + '</p>' +
      '<p style="margin-top:10px;color:#e9e6df">' + ER.util.esc(title) + '</p>' +
      '<p class="hint">' + ER.util.esc(detail) + '</p>' +
      '<div class="card-actions">' +
      '<button class="btn" data-act="done" type="button">标记完成到此步</button>' +
      '<button class="btn-ghost" data-act="undo" type="button">回退一步</button>' +
      '<button class="btn-ghost" data-act="map" type="button">在地图查看</button>' +
      '</div>';

    ER.ui.openModal();

    document.querySelector('[data-act="done"]').addEventListener('click', function () {
      ER.store.setQuestProgress(q.id, stage + 1);
      ER.ui.closeModal();
    });
    document.querySelector('[data-act="undo"]').addEventListener('click', function () {
      ER.store.setQuestProgress(q.id, stage);
      ER.ui.closeModal();
    });
    document.querySelector('[data-act="map"]').addEventListener('click', function () {
      ER.ui.closeModal();
      ER.ui.go('map');
      setTimeout(function () { ER.map.focus(q.npc); }, 320);
    });
  }

  global.ER = global.ER || {};
  global.ER.quests = {
    init: init,
    reRender: render,
    findById: findById,
    showNodeModal: showNodeModal,
    all: function () { return quests; }
  };
})(window);
