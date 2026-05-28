/**
 * inline-icons.js — 把页面正文中的 emoji 替换为 icons8 hatch 物料
 *
 * 设计原则：
 * - markdown / RSS 中保持 emoji（跨平台兼容）
 * - 浏览器加载时由本脚本扫 DOM 替换为 <img class="x-icon">
 * - 同 emoji 多语义按 上下文 + label 区分（如 💡 在「观点 / 杂谈」H2 用 idea）
 * - 黑白图在暗黑模式下由 inline-icons.css 通过 URL selector 自动反转
 *
 * 维护：增/改/删图标只需改 ICONS 字典 + 对应规则表
 */
(function () {
  if (typeof window === 'undefined') return;

  var BASE = 'https://img.icons8.com/hatch/64/';

  // ============================================================
  // 全部 emoji → icons8 物料映射（手动调整这里即可）
  // ============================================================
  // 标 ⚠️ 的 URL 是猜测，你可以去 icons8.com/icons/set/hatch 查找替换
  var ICONS = {
    // 6 个分类（H2 章节标题 + top-3 元数据段尾）
    'ai-ml':       { url: BASE + 'hub.png',     alt: 'hub' },
    'security':    { url: BASE + 'fingerprint.png',             alt: 'fingerprint' },
    'engineering': { url: BASE + 'bios.png',         alt: 'bios' },
    'tools':       { url: BASE + 'support.png',         alt: 'support' },
    'opinion':     { url: BASE + 'idea.png',            alt: 'idea' },        // 💡 in 观点 / 杂谈
    'other':       { url: BASE + 'filter.png',          alt: 'filter' },      // 📝 in 其他

    // H2 章节非分类（按 label 区分）
    'highlights':  { url: BASE + 'checked-2.png',            alt: 'checked-2' },  // 📝 今日看点 ⚠️
    'must-read':   { url: BASE + 'pin-2.png',          alt: 'pin-2' },   // 🏆 今日必读 ⚠️

    // top-3 段内（按 DOM 位置识别）
    'gold':        { url: BASE + '1-key.png', alt: '1-key' },        // 🥇 ⚠️
    'silver':      { url: BASE + '2-key.png', alt: '2-key' },      // 🥈 ⚠️
    'bronze':      { url: BASE + '3-key.png', alt: '3-key' },      // 🥉 ⚠️
    'editorial':   { url: BASE + 'attach.png',        alt: 'attach' },         // 💡 编辑视角（旧稿兼容）⚠️

    // 文章正文内联（按 DOM 位置识别）
    'tag':         { url: BASE + 'price-tag.png',       alt: 'tag' },         // 🏷️ ⚠️
    'rating':      { url: BASE + 'rating.png',            alt: 'rating' },        // ⭐ N/30 ⚠️
  };

  // ============================================================
  // 公用工具
  // ============================================================
  function imgHtml(meta) {
    return '<img class="x-icon" src="' + meta.url + '" alt="' + meta.alt
      + '" width="20" height="20" loading="lazy">';
  }

  function replaceFirst(el, emoji, meta) {
    var html = el.innerHTML;
    var idx = html.indexOf(emoji);
    if (idx < 0) return false;
    el.innerHTML = html.slice(0, idx) + imgHtml(meta) + html.slice(idx + emoji.length);
    return true;
  }

  function replaceLast(el, emoji, meta) {
    var html = el.innerHTML;
    var idx = html.lastIndexOf(emoji);
    if (idx < 0) return false;
    el.innerHTML = html.slice(0, idx) + imgHtml(meta) + html.slice(idx + emoji.length);
    return true;
  }

  // ============================================================
  // 处理规则（按 DOM 类型分发）
  // ============================================================

  // ---- H2 章节标题：分类 + 非分类（emoji × label 双因子）----
  var H2_RULES = [
    { emoji: '🏆', label: '今日必读',     iconKey: 'must-read' },
    { emoji: '📝', label: '今日看点',     iconKey: 'highlights' },
    { emoji: '🤖', label: 'AI / ML',     iconKey: 'ai-ml' },
    { emoji: '🔒', label: '安全',        iconKey: 'security' },
    { emoji: '⚙️', label: '工程',        iconKey: 'engineering' },
    { emoji: '⚙',  label: '工程',        iconKey: 'engineering' },
    { emoji: '🛠️', label: '工具 / 开源', iconKey: 'tools' },
    { emoji: '🛠',  label: '工具 / 开源', iconKey: 'tools' },
    { emoji: '💡', label: '观点 / 杂谈', iconKey: 'opinion' },
    { emoji: '📝', label: '其他',        iconKey: 'other' },
  ];

  function processH2(h2) {
    var text = (h2.textContent || '').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < H2_RULES.length; i++) {
      var r = H2_RULES[i];
      var ei = text.indexOf(r.emoji);
      var li = text.indexOf(r.label);
      // emoji 必须出现在 label 之前
      if (ei >= 0 && li > ei) {
        if (replaceFirst(h2, r.emoji, ICONS[r.iconKey])) return;
      }
    }
  }

  // ---- top-3 段开头 medal: <p>🥇 <strong>title</strong> ...</p> ----
  var MEDAL_RULES = [
    { emoji: '🥇', iconKey: 'gold' },
    { emoji: '🥈', iconKey: 'silver' },
    { emoji: '🥉', iconKey: 'bronze' },
  ];

  function processMedal(p) {
    var text = (p.textContent || '').trim();
    for (var i = 0; i < MEDAL_RULES.length; i++) {
      var m = MEDAL_RULES[i];
      if (text.indexOf(m.emoji) === 0 && p.querySelector('strong')) {
        return replaceFirst(p, m.emoji, ICONS[m.iconKey]);
      }
    }
    return false;
  }

  // ---- editorial 段开头 💡 <strong>编辑视角</strong> ----
  // 与「观点 / 杂谈」分类的 💡 区分：旧稿段落的 💡 紧跟 <strong>编辑视角</strong> 或 <strong>为什么值得读</strong>
  function processEditorial(p) {
    var text = (p.textContent || '').trim();
    if (text.indexOf('💡') !== 0) return false;
    var strong = p.querySelector('strong');
    if (!strong) return false;
    var label = strong.textContent || '';
    if (label.indexOf('编辑视角') < 0 && label.indexOf('为什么值得读') < 0) return false;
    return replaceFirst(p, '💡', ICONS['editorial']);
  }

  // ---- tags 段开头 🏷️ keywords ----
  function processTags(p) {
    var text = (p.textContent || '').trim();
    if (text.indexOf('🏷️') === 0) return replaceFirst(p, '🏷️', ICONS['tag']);
    if (text.indexOf('🏷') === 0)  return replaceFirst(p, '🏷',  ICONS['tag']);
    return false;
  }

  // ---- metadata 段尾分类 emoji: [link] — source · time · 🔒 安全 ----
  var META_CAT_RULES = [
    { emoji: '🤖', label: 'AI / ML',     iconKey: 'ai-ml' },
    { emoji: '🔒', label: '安全',        iconKey: 'security' },
    { emoji: '⚙️', label: '工程',        iconKey: 'engineering' },
    { emoji: '⚙',  label: '工程',        iconKey: 'engineering' },
    { emoji: '🛠️', label: '工具 / 开源', iconKey: 'tools' },
    { emoji: '🛠',  label: '工具 / 开源', iconKey: 'tools' },
    { emoji: '💡', label: '观点 / 杂谈', iconKey: 'opinion' },
    { emoji: '📝', label: '其他',        iconKey: 'other' },
  ];

  function processMetadataCategory(p) {
    var text = (p.textContent || '').replace(/\s+/g, ' ').trim();
    var dotIdx = text.lastIndexOf('·');
    if (dotIdx < 0) return false;
    var lastSeg = text.slice(dotIdx + 1).trim();
    for (var i = 0; i < META_CAT_RULES.length; i++) {
      var r = META_CAT_RULES[i];
      if (lastSeg.indexOf(r.emoji) !== 0) continue;
      var rest = lastSeg.slice(r.emoji.length).trim();
      if (rest === r.label || rest.indexOf(r.label) === 0) {
        return replaceLast(p, r.emoji, ICONS[r.iconKey]);
      }
    }
    return false;
  }

  // ---- ⭐ N/30 评分（分类列表段元数据中） ----
  function processStarRating(p) {
    var html = p.innerHTML;
    if (html.indexOf('⭐') < 0) return false;
    var newHtml = html.replace(/·(\s*)⭐(\s*\d+\/30)/g, '·$1' + imgHtml(ICONS['rating']) + '$2');
    if (newHtml === html) return false;
    p.innerHTML = newHtml;
    return true;
  }

  // ============================================================
  // 入口
  // ============================================================
  function processAll() {
    var scope = document.querySelector('article .content') || document.querySelector('article');
    if (!scope) return;

    scope.querySelectorAll('h2').forEach(processH2);

    scope.querySelectorAll('p').forEach(function (p) {
      // 互斥优先级：medal / editorial / tags 三种段开头模式择一
      if (processMedal(p)) return;
      if (processEditorial(p)) return;
      if (processTags(p)) return;
      // metadata 段：可能同时有分类 emoji 和 ⭐
      processMetadataCategory(p);
      processStarRating(p);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processAll);
  } else {
    processAll();
  }
})();
