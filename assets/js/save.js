/* ==========================================================================
   save.js —— 存档解析（整合自 4 页版，改为 SPA 视图）
     · 本地读取文件 → 生成确定性进度 → 写入 localStorage → 点亮支线树节点
     · 真实接入：把 parseSave() 换成真正的 sl2 解析，返回 { 支线id: 已完成阶段数 }
   ========================================================================== */
(function (global) {
  'use strict';

  var els = {};
  var file = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    els.dropZone = $('dropZone');
    els.fileInput = $('fileInput');
    els.fileName = $('fileName');
    els.parseBtn = $('parseBtn');
    els.demoBtn = $('demoBtn');
    els.clearBtn = $('clearBtn');
    els.progressBox = $('progressBox');
    els.progressBar = $('progressBar');
    els.progressPct = $('progressPct');
    els.progressText = $('progressText');
    els.resultBox = $('resultBox');
    els.resultGrid = $('resultGrid');

    if (!els.dropZone) return;

    // 点击选择
    els.dropZone.addEventListener('click', function () { els.fileInput.click(); });
    els.fileInput.addEventListener('change', function () { pick(els.fileInput.files[0]); });

    // 拖拽
    ['dragenter', 'dragover'].forEach(function (ev) {
      els.dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropZone.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      els.dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropZone.classList.remove('is-drag');
      });
    });
    els.dropZone.addEventListener('drop', function (e) { pick(e.dataTransfer.files[0]); });

    els.parseBtn.addEventListener('click', startParse);
    els.demoBtn.addEventListener('click', function () {
      runSimulated(20251118, 'demo-ER0000.sl2', 46 * 1024);
    });
    els.clearBtn.addEventListener('click', clearAll);

    // 打开页面时回显上次解析结果
    var last = ER.store.getSave && ER.store.getSave();
    if (last) renderResult(last.name, last.size, last.quests, last.nodes);
  }

  /* ---------------- 选择文件 ---------------- */
  function pick(f) {
    if (!f) return;
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'sl2' && ext !== 'co2') {
      ER.ui.toast('请选择 .sl2 存档文件');
      return;
    }
    file = f;
    els.fileName.textContent = f.name + ' · ' + (f.size / 1024).toFixed(1) + ' KB';
    els.fileName.style.color = 'var(--gold-soft)';
    els.parseBtn.disabled = false;
  }

  /* ---------------- 解析 ---------------- */
  function startParse() {
    if (!file) { ER.ui.toast('请先选择存档文件'); return; }
    if (!ER.quests.all().length) { ER.ui.toast('支线数据还在加载，请稍后再试'); return; }

    els.parseBtn.disabled = true;
    els.resultBox.hidden = true;
    els.progressBox.hidden = false;
    setProgress(0, '读取文件…');

    file.arrayBuffer()
      .then(function (buf) {
        var bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536));
        runSimulated(fnv1a(bytes), file.name, file.size);
      })
      .catch(function (err) {
        console.error('[save] 解析失败', err);
        els.progressText.textContent = '解析失败，请重试';
        els.parseBtn.disabled = false;
      });
  }

  function runSimulated(hash, name, size) {
    els.progressBox.hidden = false;
    var steps = [[20, '校验文件头…'], [45, '读取角色信息…'], [70, '匹配支线进度…'], [92, '写入本地进度…'], [100, '完成']];
    var i = 0;

    var timer = setInterval(function () {
      var s = steps[i];
      setProgress(s[0], s[1]);
      if (s[0] === 100) {
        clearInterval(timer);
        finish(parseSave(hash), name, size);
      }
      i++;
    }, 240);
  }

  function setProgress(pct, text) {
    els.progressBar.style.width = pct + '%';
    els.progressPct.textContent = pct + '%';
    if (text) els.progressText.textContent = text;
  }

  /* ---------------- 伪解析：哈希 → 进度表 ---------------- */
  function parseSave(hash) {
    var list = ER.quests.all();
    var out = {};

    for (var i = 0; i < list.length; i++) {
      var total = (list[i].stages || []).length;
      var seed = (hash ^ (i * 2654435761)) >>> 0;
      if (seed % 100 < 35) continue;            // 约 65% 支线有进度
      out[list[i].id] = (seed >>> 8) % (total + 1);
    }
    return out;
  }

  function finish(map, name, size) {
    var ids = Object.keys(map);
    var nodes = ids.reduce(function (s, k) { return s + map[k]; }, 0);

    ER.store.replaceProgress(map);
    ER.store.setSave({
      name: name, size: size, at: new Date().toISOString(),
      quests: ids.length, nodes: nodes
    });

    renderResult(name, size, ids.length, nodes);
    els.parseBtn.disabled = false;
    ER.ui.toast('解析完成，已点亮 ' + nodes + ' 个节点');
  }

  function renderResult(name, size, quests, nodes) {
    els.resultGrid.innerHTML =
      row('存档文件', name) +
      row('文件大小', (size / 1024).toFixed(1) + ' KB') +
      row('点亮支线', quests + ' 条') +
      row('点亮节点', nodes + ' 个');
    els.resultBox.hidden = false;
  }

  function row(k, v) {
    return '<div class="kv"><span>' + ER.util.esc(k) + '</span><b>' + ER.util.esc(v) + '</b></div>';
  }

  function clearAll() {
    ER.store.resetProgress();
    ER.store.clearSave();
    els.resultBox.hidden = true;
    els.progressBox.hidden = true;
    file = null;
    els.fileInput.value = '';
    els.fileName.textContent = '尚未选择文件';
    els.fileName.style.color = '';
    els.parseBtn.disabled = true;
    ER.ui.toast('已清除本地进度');
  }

  /* ---------------- FNV-1a ---------------- */
  function fnv1a(bytes) {
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  global.ER = global.ER || {};
  global.ER.savePage = { init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
