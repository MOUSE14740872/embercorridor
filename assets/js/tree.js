/* ==========================================================================
   tree.js —— 支线 SVG 树渲染器（地图浮层与支线页共用）
   固定坐标网格：列 230 / 行 140 / 节点 180×54，坐标在渲染时算好写进 DOM
   ========================================================================== */
(function (global) {
  'use strict';

  var XS = [150, 380, 610, 840, 1070, 1300];
  var NW = 180, NH = 54, BAND = 140, PAD = 40, LABEL_W = 150, COL = 230;
  var MAX_STAGES = 6;

  var esc = ER.util.esc;
  var state = { quests: [], host: null, onClick: null, zoom: 1, baseWidth: 900 };

  function statusOf(stageIndex, done, isLast) {
    if (stageIndex < done) return 'done';
    if (isLast) return 'end';
    return 'todo';
  }

  function clip(text, n) {
    text = String(text || '');
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
  }

  /**
   * 渲染树
   * @param {HTMLElement} host   容器
   * @param {Object} opts        { quests, progress, onClick, width }
   */
  function render(host, opts) {
    opts = opts || {};
    var quests = opts.quests || state.quests;
    var progress = opts.progress || ER.store.getAllProgress();
    state.host = host;
    state.quests = quests;
    state.onClick = opts.onClick || null;

    var rows = [], edges = [];
    var edgeDelay = 0;

    quests.forEach(function (q, qi) {
      var top = PAD + qi * BAND;
      var done = progress[q.id] || 0;
      var stages = q.stages;
      var lastIdx = stages.length - 1;

      rows.push('<g class="band">');
      rows.push('<text class="band-name" x="24" y="' + (top + 58) + '" font-size="15">' + esc(clip(q.name, 6)) + '</text>');
      rows.push('<text class="band-sub" x="24" y="' + (top + 78) + '" font-size="10">' + esc(clip(q.npc, 9)) + '</text>');

      // 计算每阶段节点坐标
      var coords = stages.map(function (stage, si) {
        var n = stage.length;
        var ys = n === 1 ? [top + 43] : [top + 8, top + 78];
        return ys.map(function (y) { return { x: XS[si] || (LABEL_W + si * COL), y: y }; });
      });

      // 连线
      for (var si = 0; si < stages.length - 1; si++) {
        coords[si].forEach(function (a, ai) {
          coords[si + 1].forEach(function (b, bi) {
            var gold = (si < done) && (si + 1 <= done);
            var x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
            edges.push(
              '<path class="edge" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"' +
              ' fill="none" stroke="' + (gold ? '#d4af37' : '#3a3a41') + '" stroke-width="1.5" stroke-linecap="round"' +
              ' pathLength="1" style="--d:' + Math.min(qi * 60 + edgeDelay * 30, 1200) + 'ms"/>'
            );
            edgeDelay++;
          });
        });
      }

      // 节点
      var nd = Math.min(qi * 60, 900);
      stages.forEach(function (stage, si) {
        var st = statusOf(si, done, si === lastIdx);
        var current = (si === done) ? ' is-current' : '';
        stage.forEach(function (node, ni) {
          var c = coords[si][ni];
          var l1 = clip(node.l1 || '', 11);
          var l2 = clip(node.l2 || node.l1 || '', 11);
          var x2 = clip(node.x2 || '', 17);

          rows.push(
            '<g class="node s-' + st + current + '" transform="translate(' + c.x + ',' + c.y + ')"' +
            ' tabindex="0" data-quest="' + esc(q.id) + '" data-stage="' + si + '"' +
            ' data-l1="' + esc(node.l1) + '" data-l2="' + esc(node.l2) + '" data-x2="' + esc(node.x2) + '">' +
            '<g class="node-inner" style="--d:' + nd + 'ms">' +
            '<rect width="' + NW + '" height="' + NH + '" rx="3" stroke-width="1"/>' +
            '<text class="lv1" x="' + NW / 2 + '" y="32" text-anchor="middle" font-size="14">' + esc(l1) + '</text>' +
            '<text class="lv2" x="' + NW / 2 + '" y="' + (x2 ? 20 : 32) + '" text-anchor="middle" font-size="14">' + esc(l2) + '</text>' +
            (x2 ? '<text class="det" x="' + NW / 2 + '" y="40" text-anchor="middle" font-size="10">' + esc(x2) + '</text>' : '') +
            '</g></g>'
          );
          nd += 35;
        });
      });

      rows.push('</g>');
    });

    var width = LABEL_W + (MAX_STAGES - 1) * COL + NW + 30;
    var height = PAD + quests.length * BAND + 30;

    host.setAttribute('data-spoiler', String(ER.store.getSpoiler()));
    host.innerHTML =
      '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMinYMin meet" ' +
      'style="display:block;height:auto" role="img" aria-label="支线任务树">' +
      '<g class="edges">' + edges.join('') + '</g>' + rows.join('') + '</svg>';

    // 缩放到容器宽度（避免文字过小）；宽度记在各自容器上，多实例互不干扰
    host.dataset.baseWidth = String(Math.max(680, host.clientWidth || 680));
    setZoom(host, 1);

    if (!host.dataset.bound) {
      host.dataset.bound = '1';
      host.addEventListener('click', function (e) {
        var node = e.target.closest ? e.target.closest('.node') : null;
        if (!node || !state.onClick) return;
        state.onClick(node.dataset.quest, Number(node.dataset.stage), node);
      });
    }
  }

  function setZoom(host, z) {
    state.zoom = Math.min(2, Math.max(0.6, z));
    var svg = host.querySelector('svg');
    if (!svg) return;
    var base = Number(host.dataset.baseWidth || 680);
    svg.style.width = Math.round(base * state.zoom) + 'px';
  }

  function zoomBy(host, delta) {
    setZoom(host, (delta === 'reset') ? 1 : state.zoom + delta);
    return state.zoom;
  }

  global.ER = global.ER || {};
  global.ER.tree = {
    render: render,
    setZoom: setZoom,
    zoomBy: zoomBy,
    getZoom: function () { return state.zoom; },
    // 只渲染单条支线时用
    single: function (q) { return [q]; }
  };
})(window);
