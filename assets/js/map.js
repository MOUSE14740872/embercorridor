/* ==========================================================================
   map.js —— MapLibre 地图 / 图层 / 搜索 / 上层支线树
   瓦片地址集中在 TILE_URL，替换成你的 R2 公共域名即可
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
     ⚠️ 只改这一行：R2 上的 XYZ 瓦片模板
     例：https://pub-xxxxxxxx.r2.dev/erdtree/{z}/{x}/{y}.png
     ------------------------------------------------------------------ */
  var TILE_URL = 'https://YOUR-R2-DOMAIN.r2.dev/er/{z}/{x}/{y}.png';

  // 地图世界范围（与瓦片生成时的范围一致；示例用 ±10 的占位坐标系）
  var BOUNDS = [[-10, -10], [10, 10]];
  var CENTER = [-2, 1];
  var START_ZOOM = 2.2;

  var map = null;
  var pois = [];
  var markers = [];
  var ready = false;
  var warned = false;
  var els = {};

  /* ---------------- 初始化 ---------------- */
  function mount() {
    if (ready) { map && map.resize(); return; }
    els.host = document.getElementById('map');
    if (!window.maplibregl) {
      warn('MapLibre 未加载：请检查 CDN 网络');
      return;
    }

    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          er: {
            type: 'raster',
            tiles: [TILE_URL],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 6,
            bounds: BOUNDS
          }
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0e0e10' } },
          { id: 'er', type: 'raster', source: 'er', paint: { 'raster-opacity': 1 } }
        ]
      },
      center: CENTER,
      zoom: START_ZOOM,
      minZoom: 1,
      maxZoom: 7,
      maxBounds: [[-14, -14], [14, 14]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    });

    map.on('error', function () {
      // 瓦片 404 / 网络错误时只提示一次
      if (!warned) { warned = true; warn('瓦片未加载：请在 assets/js/map.js 配置 TILE_URL'); }
    });

    map.on('load', function () { ready = true; renderMarkers(); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
  }

  function warn(text) {
    var host = document.querySelector('.map-shell');
    if (!host || host.querySelector('.tile-warn')) return;
    var d = document.createElement('div');
    d.className = 'tile-warn';
    d.textContent = text;
    host.appendChild(d);
  }

  /* ---------------- 点位标记 ---------------- */
  function passes(poi) {
    return ER.store.getLayers()[poi.cat] && poi.spoiler <= ER.store.getSpoiler();
  }

  function renderMarkers() {
    if (!map) return;
    markers.forEach(function (m) { m.remove(); });
    markers = [];

    pois.filter(passes).forEach(function (poi) {
      var el = document.createElement('div');
      el.className = 'pin pin-' + poi.cat + (ER.store.isVisited(poi.name) ? ' pin-visited' : '');
      el.title = poi.name;

      var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.x, poi.y])
        .addTo(map);

      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openPopup(poi);
      });

      markers.push(marker);
    });

    var hidden = pois.filter(function (p) { return !passes(p); }).length;
    var hint = document.getElementById('poiHint');
    if (hint) hint.textContent = '显示 ' + markers.length + ' / ' + pois.length + ' 个点位' +
      (hidden ? '（' + hidden + ' 个因图层或剧透等级隐藏）' : '');
  }

  var popup = null;
  function openPopup(poi) {
    if (!map) return;
    popup && popup.remove();

    var visited = ER.store.isVisited(poi.name);
    var lv = ER.store.getSpoiler();

    var html = document.createElement('div');
    html.innerHTML =
      '<div class="popup-title">' + ER.util.esc(poi.name) + '</div>' +
      '<div class="popup-meta">' + ER.util.esc(poi.area || '') + ' · ' + catName(poi.cat) + '</div>' +
      (lv >= 1 && poi.note ? '<div class="popup-meta" style="margin-top:6px">' + ER.util.esc(poi.note) + '</div>' : '') +
      '<div class="popup-actions">' +
      '<button class="btn-ghost" data-act="visit">' + (visited ? '取消到访标记' : '标记为已到访') + '</button>' +
      '</div>';

    html.querySelector('[data-act="visit"]').addEventListener('click', function () {
      ER.store.toggleVisited(poi.name);
      openPopup(poi);
      renderMarkers();
    });

    popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '260px' })
      .setLngLat([poi.x, poi.y])
      .setDOMContent(html)
      .addTo(map);
  }

  function catName(cat) {
    return { grace: '赐福', npc: 'NPC', item: '道具', ruin: '遗迹' }[cat] || cat;
  }

  /* ---------------- 搜索 ---------------- */
  function bindSearch() {
    var input = document.getElementById('poiSearch');
    var list = document.getElementById('poiResults');
    if (!input || !list) return;

    function draw() {
      var kw = input.value.trim().toLowerCase();
      var lv = ER.store.getSpoiler();
      var result = pois.filter(function (p) {
        if (p.spoiler > lv) return false;
        return !kw || (p.name + p.area).toLowerCase().indexOf(kw) > -1;
      }).slice(0, 12);

      list.innerHTML = result.map(function (p) {
        return '<li data-name="' + ER.util.esc(p.name) + '">' +
          '<span>' + ER.util.esc(p.name) + '</span><small>' + ER.util.esc(p.area) + '</small></li>';
      }).join('') || '<li style="color:#6f6c65">无匹配点位</li>';
    }

    input.addEventListener('input', draw);
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-name]');
      if (!li) return;
      var poi = pois.find(function (p) { return p.name === li.dataset.name; });
      if (!poi || !map) return;
      map.flyTo({ center: [poi.x, poi.y], zoom: 4.2, speed: 1.2 });
      openPopup(poi);
    });
    draw();
  }

  /* ---------------- 图层开关 ---------------- */
  function bindLayers() {
    var box = document.getElementById('layerToggles');
    if (!box) return;
    var layers = ER.store.getLayers();
    box.querySelectorAll('input[data-layer]').forEach(function (cb) {
      cb.checked = !!layers[cb.dataset.layer];
      cb.addEventListener('change', function () {
        ER.store.toggleLayer(cb.dataset.layer);
      });
    });
  }

  /* ---------------- 地图上的支线树浮层 ---------------- */
  var treeQuestId = null;
  var overlayBound = false;

  function bindTreeOverlay(quests) {
    els.treeOverlay = document.getElementById('treeOverlay');
    els.treeHost = document.getElementById('treeHost');
    els.treeSelect = document.getElementById('treeQuestSelect');
    if (!els.treeOverlay || !quests.length) return;

    els.treeSelect.innerHTML = quests.map(function (q) {
      return '<option value="' + q.id + '">' + ER.util.esc(q.name) + ' · ' + ER.util.esc(q.npc) + '</option>';
    }).join('');
    treeQuestId = quests[0].id;

    els.treeSelect.addEventListener('change', function () {
      treeQuestId = els.treeSelect.value;
      drawOverlayTree();
    });

    document.getElementById('treeToggle').addEventListener('click', function () {
      var open = !els.treeOverlay.hidden;
      els.treeOverlay.hidden = open;
      this.setAttribute('aria-expanded', String(!open));
      if (!open) drawOverlayTree();
    });
    document.getElementById('treeOverlayClose').addEventListener('click', function () {
      els.treeOverlay.hidden = true;
      document.getElementById('treeToggle').setAttribute('aria-expanded', 'false');
    });

    els.treeOverlay.querySelectorAll('[data-tree]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.tree;
        ER.tree.zoomBy(els.treeHost, act === 'in' ? 0.2 : act === 'out' ? -0.2 : 'reset');
        document.getElementById('treeZoomLabel').textContent = Math.round(ER.tree.getZoom() * 100) + '%';
      });
    });

    // 缩放/窗口变化时防抖重绘（避免频繁重排导致卡顿）
    var redraw = ER.util.debounce(function () { if (!els.treeOverlay.hidden) drawOverlayTree(); }, 180);
    window.addEventListener('resize', redraw);

    if (!overlayBound) {
      overlayBound = true;
      ER.store.on(function (type) {
        if (type === 'spoiler' && !els.treeOverlay.hidden) drawOverlayTree();
      });
    }
  }

  function drawOverlayTree() {
    var q = ER.quests.findById(treeQuestId);
    if (!q || !els.treeHost) return;
    ER.tree.render(els.treeHost, {
      quests: [q],
      onClick: function (id, stage, node) {
        ER.quests.showNodeModal(id, stage, node);
      }
    });
  }

  /* ---------------- 对外 ---------------- */
  global.ER = global.ER || {};
  global.ER.map = {
    init: function (data, quests) {
      pois = data;
      mount();
      bindLayers();
      bindSearch();
      bindTreeOverlay(quests || []);
      ER.store.on(function (type) {
        if (type === 'layers' || type === 'spoiler' || type === 'visited') renderMarkers();
      });
    },
    refresh: renderMarkers,
    focus: function (name) {
      if (!name) return false;
      // 先精确匹配，再退化为包含匹配（支线里的 NPC 名与点位名不一定完全一致）
      var poi = pois.find(function (p) { return p.name === name; }) ||
                pois.find(function (p) { return p.name.indexOf(name) > -1 || name.indexOf(p.name) > -1; });
      if (!poi) return false;
      if (map) {
        map.flyTo({ center: [poi.x, poi.y], zoom: 4.2, speed: 1.2 });
        openPopup(poi);
      }
      return true;
    },
    resize: function () { map && map.resize(); }
  };
})(window);
