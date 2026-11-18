/* ==========================================================================
   codex.js —— 法环大图鉴：分类 / 搜索 / 属性对比 / 本地备注
   ========================================================================== */
(function (global) {
  'use strict';

  var CATS = [
    { key: 'all', label: '全部' },
    { key: 'weapon', label: '武器' },
    { key: 'armor', label: '护甲' },
    { key: 'talisman', label: '护符' },
    { key: 'spell', label: '魔法祷告' },
    { key: 'npc', label: 'NPC' },
    { key: 'boss', label: 'BOSS' }
  ];

  var data = [];
  var cat = 'all';
  var keyword = '';
  var picked = [];   // 对比选中的条目

  function init(list) {
    data = list || [];
    drawCats();
    bind();
    render();
    // 剧透等级变化时重绘，保证条目按等级显隐
    ER.store.on(function (type) { if (type === 'spoiler') render(); });
  }

  function drawCats() {
    var box = document.getElementById('codexCats');
    box.innerHTML = CATS.map(function (c) {
      return '<button class="chip' + (c.key === cat ? ' active' : '') + '" data-cat="' + c.key + '">' + c.label + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;
      cat = btn.dataset.cat;
      box.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === btn); });
      render();
    });
  }

  function bind() {
    document.getElementById('codexSearch').addEventListener('input', function (e) {
      keyword = e.target.value.trim().toLowerCase();
      render();
    });
    document.getElementById('compareClear').addEventListener('click', function () {
      picked = [];
      render();
    });
  }

  function filtered() {
    var lv = ER.store.getSpoiler();
    return data.filter(function (it) {
      if (it.spoiler > lv) return false;
      if (cat !== 'all' && it.cat !== cat) return false;
      if (!keyword) return true;
      return (it.name + it.sub + it.note).toLowerCase().indexOf(keyword) > -1;
    });
  }

  function render() {
    var grid = document.getElementById('codexGrid');
    var empty = document.getElementById('codexEmpty');
    var list = filtered();

    grid.innerHTML = list.map(cardHTML).join('');
    empty.hidden = list.length > 0;

    grid.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.name;
        var act = btn.dataset.act;
        if (act === 'compare') togglePick(name);
        if (act === 'note') openNote(name);
      });
    });

    renderCompare();
  }

  function cardHTML(it) {
    var stats = Object.keys(it.stats || {}).map(function (k) {
      return '<span>' + ER.util.esc(k) + ' ' + ER.util.esc(it.stats[k]) + '</span>';
    }).join('');

    var note = ER.store.getNote(it.name);
    var isPicked = picked.indexOf(it.name) > -1;

    return '<article class="card">' +
      '<div class="card-tag">' + label(it.cat) + ' · ' + ER.util.esc(it.sub || '') + '</div>' +
      '<h3>' + ER.util.esc(it.name) + '</h3>' +
      '<p>' + ER.util.esc(it.note || '') + '</p>' +
      '<div class="card-meta">' + stats + '</div>' +
      (note ? '<div class="card-meta" style="color:#d4af37">备注：' + ER.util.esc(note) + '</div>' : '') +
      '<div class="card-actions">' +
      '<button class="btn-ghost" data-act="compare" data-name="' + ER.util.esc(it.name) + '">' +
      (isPicked ? '取消对比' : '加入对比') + '</button>' +
      '<button class="btn-ghost" data-act="note" data-name="' + ER.util.esc(it.name) + '">备注</button>' +
      '</div></article>';
  }

  function label(k) {
    var m = { weapon: '武器', armor: '护甲', talisman: '护符', spell: '魔法', npc: 'NPC', boss: 'BOSS' };
    return m[k] || k;
  }

  /* ---------------- 属性对比 ---------------- */
  function togglePick(name) {
    var i = picked.indexOf(name);
    if (i > -1) picked.splice(i, 1);
    else {
      if (picked.length >= 2) picked.shift();   // 只保留最近两件
      picked.push(name);
    }
    render();
  }

  function renderCompare() {
    var bar = document.getElementById('compareBar');
    var box = document.getElementById('compareBox');
    var info = document.getElementById('compareInfo');

    if (!picked.length) {
      bar.hidden = true; box.hidden = true;
      return;
    }
    bar.hidden = false;
    info.textContent = picked.length === 1
      ? '已选「' + picked[0] + '」，再选一件进行对比'
      : '正在对比：' + picked.join('  vs  ');

    if (picked.length < 2) { box.hidden = true; return; }

    var a = data.find(function (x) { return x.name === picked[0]; });
    var b = data.find(function (x) { return x.name === picked[1]; });
    if (!a || !b) { box.hidden = true; return; }

    var keys = {};
    Object.keys(a.stats || {}).concat(Object.keys(b.stats || {})).forEach(function (k) { keys[k] = 1; });

    var rows = Object.keys(keys).map(function (k) {
      var va = (a.stats || {})[k] || '—';
      var vb = (b.stats || {})[k] || '—';
      return '<tr><th>' + ER.util.esc(k) + '</th><td>' + ER.util.esc(va) + '</td><td>' + ER.util.esc(vb) + '</td></tr>';
    }).join('');

    box.hidden = false;
    box.innerHTML =
      '<table class="compare-table">' +
      '<tr><th></th><td><b>' + ER.util.esc(a.name) + '</b></td><td><b>' + ER.util.esc(b.name) + '</b></td></tr>' +
      rows + '</table>';
  }

  /* ---------------- 备注 ---------------- */
  function openNote(name) {
    var body = document.getElementById('modalBody');
    var text = ER.store.getNote(name);

    body.innerHTML =
      '<h3>' + ER.util.esc(name) + ' · 本地备注</h3>' +
      '<p class="hint">只保存在这台设备的浏览器里，用于记录自己的打法心得。</p>' +
      '<div class="field"><textarea class="input" id="noteInput" placeholder="例如：二阶段留耐力，别硬吃跳劈">' + ER.util.esc(text) + '</textarea></div>' +
      '<div class="card-actions"><button class="btn" id="noteSave" type="button">保存</button></div>';

    ER.ui.openModal();

    document.getElementById('noteSave').addEventListener('click', function () {
      ER.store.setNote(name, document.getElementById('noteInput').value.trim());
      ER.ui.closeModal();
      render();
    });
  }

  global.ER = global.ER || {};
  global.ER.codex = { init: init, refresh: render };
})(window);
