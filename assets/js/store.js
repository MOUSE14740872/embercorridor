/* ==========================================================================
   store.js —— 全局状态（剧透等级 / 支线进度 / 点位到访 / 图鉴备注 / 图层）
   所有模块只通过 ER.store 读写，保证"剧透逻辑统一"
   ========================================================================== */
(function (global) {
  'use strict';

  var KEYS = {
    spoiler: 'spa:spoiler',
    progress: 'spa:progress',
    visited: 'spa:visited',
    notes: 'spa:notes',
    layers: 'spa:layers',
    save: 'spa:save'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ---------------- 状态 ----------------
  var state = {
    // 0 = 安全预览，1 = 中度剧透，2 = 完全剧透
    spoiler: (function () {
      var v = read(KEYS.spoiler, 0);
      return (v === 0 || v === 1 || v === 2) ? v : 0;
    })(),
    // { questId: 已完成的阶段数 }
    progress: read(KEYS.progress, {}),
    // { poiName: true }
    visited: read(KEYS.visited, {}),
    // { codexName: '备注内容' }
    notes: read(KEYS.notes, {}),
    // 图层开关
    layers: Object.assign({ grace: true, npc: true, item: true, ruin: true }, read(KEYS.layers, {})),
    // 存档元信息
    save: read(KEYS.save, null)
  };

  var listeners = [];

  function emit(type, payload) {
    listeners.forEach(function (fn) {
      try { fn(type, payload, state); } catch (e) { console.error('[store]', e); }
    });
  }

  // ---------------- 对外 API ----------------
  var store = {
    on: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },

    /* ---- 剧透 ---- */
    getSpoiler: function () { return state.spoiler; },
    setSpoiler: function (level) {
      level = Number(level);
      if (level !== 0 && level !== 1 && level !== 2) return;
      if (state.spoiler === level) return;
      state.spoiler = level;
      write(KEYS.spoiler, level);
      emit('spoiler', level);
    },

    /* ---- 支线进度：值为"已完成的阶段数" ---- */
    getQuestProgress: function (id) { return state.progress[id] || 0; },
    setQuestProgress: function (id, done) {
      state.progress[id] = Math.max(0, done);
      write(KEYS.progress, state.progress);
      emit('progress', { id: id, done: state.progress[id] });
    },
    advanceQuest: function (id, total) {
      var next = (state.progress[id] || 0) + 1;
      if (next > total) next = 0;               // 走完后点击回到起点
      store.setQuestProgress(id, next);
    },
    getAllProgress: function () { return state.progress; },
    // 用一份新的进度表整体覆盖（存档解析用）
    replaceProgress: function (map) {
      state.progress = map || {};
      write(KEYS.progress, state.progress);
      emit('progress', state.progress);
    },
    // 清空全部进度（存档页“清除本地进度”用）
    resetProgress: function () {
      state.progress = {};
      write(KEYS.progress, {});
      emit('progress', state.progress);
    },

    /* ---- 点位到访 ---- */
    isVisited: function (name) { return !!state.visited[name]; },
    toggleVisited: function (name) {
      if (state.visited[name]) delete state.visited[name];
      else state.visited[name] = true;
      write(KEYS.visited, state.visited);
      emit('visited', name);
    },
    visitedCount: function () { return Object.keys(state.visited).length; },

    /* ---- 图鉴备注 ---- */
    getNote: function (name) { return state.notes[name] || ''; },
    setNote: function (name, text) {
      if (text) state.notes[name] = text; else delete state.notes[name];
      write(KEYS.notes, state.notes);
      emit('note', name);
    },

    /* ---- 图层 ---- */
    getLayers: function () { return state.layers; },
    toggleLayer: function (key) {
      state.layers[key] = !state.layers[key];
      write(KEYS.layers, state.layers);
      emit('layers', state.layers);
    },

    /* ---- 存档元信息（只存本机） ---- */
    getSave: function () { return state.save; },
    setSave: function (meta) {
      state.save = meta;
      write(KEYS.save, meta);
      emit('save', meta);
    },
    clearSave: function () {
      state.save = null;
      write(KEYS.save, null);
      emit('save', null);
    }
  };

  // ---------------- 工具函数（各模块共用） ----------------
  var util = {
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    debounce: function (fn, wait) {
      var t;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, wait);
      };
    },
    loadJSON: function (url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.json();
      });
    },
    // 剧透等级 → 是否展示某条内容的 spoiler 值
    allow: function (itemSpoiler) {
      return (itemSpoiler || 0) <= store.getSpoiler();
    }
  };

  global.ER = global.ER || {};
  global.ER.store = store;
  global.ER.util = util;
})(window);
