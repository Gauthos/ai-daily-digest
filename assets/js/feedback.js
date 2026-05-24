(function () {
  if (typeof window === 'undefined') return;

  var CATEGORY_LABEL_TO_ID = {
    'AI / ML': 'ai-ml',
    '安全': 'security',
    '工程': 'engineering',
    '工具 / 开源': 'tools',
    '观点 / 杂谈': 'opinion',
    '其他': 'other',
  };

  var FEEDBACK_INNER =
    '<span class="feedback-hint">这个视角对你有用吗？</span>' +
    '<button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用">' +
    '<img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>' +
    '<button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用">' +
    '<img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>';

  function gtagEvent(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params);
  }

  function findCategoryAbove(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      var prev = cur.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'H2') {
          var t = (prev.textContent || '').trim();
          for (var label in CATEGORY_LABEL_TO_ID) {
            if (t.indexOf(label) >= 0) return CATEGORY_LABEL_TO_ID[label];
          }
          return 'other';
        }
        prev = prev.previousElementSibling;
      }
      cur = cur.parentElement;
    }
    return 'other';
  }

  function parseMetaLine(p) {
    if (!p || p.tagName !== 'P') return null;
    var text = (p.textContent || '').replace(/\s+/g, ' ').trim();
    var dashIdx = text.indexOf('—');
    if (dashIdx < 0) return null;
    var rhs = text.slice(dashIdx + 1).trim();
    var segments = rhs.split('·').map(function (s) { return s.trim(); });
    if (segments.length < 2) return null;
    var source = segments[0].replace(/\*\*/g, '').trim();
    var lastSeg = segments[segments.length - 1];
    var score = 0;
    var categoryLabel = '';
    var scoreMatch = lastSeg.match(/⭐\s*(\d+)\/30/);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1], 10);
    } else {
      // top-3 inline category like "🤖 AI / ML"; strip emoji
      categoryLabel = lastSeg.replace(/[^\sA-Za-z一-龥\/]/g, '').trim();
    }
    return { source: source, score: score, categoryLabel: categoryLabel };
  }

  function findArticleScope(anchor) {
    var startEl = /^H[1-6]$/.test(anchor.tagName)
      ? anchor
      : (anchor.closest('p') || anchor);
    var endEl = startEl;
    var cur = startEl.nextElementSibling;
    while (cur) {
      if (cur.tagName === 'HR') break;
      if (cur.id && /^item-/.test(cur.id)) break;
      if (cur.querySelector && cur.querySelector('a.x-anchor[id^="item-"]')) break;
      endEl = cur;
      cur = cur.nextElementSibling;
    }
    return { startEl: startEl, endEl: endEl };
  }

  function alreadyInjected(range) {
    var id = '';
    if (range.startEl.id && /^item-/.test(range.startEl.id)) {
      id = range.startEl.id;
    } else {
      var anchor = range.startEl.querySelector && range.startEl.querySelector('[id^="item-"]');
      id = anchor ? anchor.id : '';
    }
    if (id && document.querySelector('.article-feedback[data-article-id="' + id + '"]')) return true;

    var sib = range.startEl.nextElementSibling;
    var stopAt = range.endEl.nextElementSibling;
    while (sib && sib !== stopAt) {
      if (sib.classList && sib.classList.contains('article-feedback')) return true;
      if (sib.querySelector && sib.querySelector('.article-feedback')) return true;
      sib = sib.nextElementSibling;
    }
    return false;
  }

  function buildBlock(meta) {
    var div = document.createElement('div');
    div.className = 'article-feedback';
    div.setAttribute('data-article-id', 'item-' + meta.shareId);
    div.setAttribute('data-source', meta.source || '');
    div.setAttribute('data-category', meta.category || 'other');
    div.setAttribute('data-score', String(meta.score || 0));
    div.innerHTML = FEEDBACK_INNER;
    return div;
  }

  function injectFeedbackBlocks() {
    var scope = document.querySelector('article .content') || document.querySelector('article');
    if (!scope) return;
    var anchors = scope.querySelectorAll('[id^="item-"]');
    anchors.forEach(function (anchor) {
      var range = findArticleScope(anchor);
      if (alreadyInjected(range)) return;

      // Find first paragraph after startEl matching the meta-line pattern
      var metaParagraph = null;
      var probe = range.startEl.nextElementSibling;
      var stopAt = range.endEl.nextElementSibling;
      while (probe && probe !== stopAt) {
        if (probe.tagName === 'P' && (probe.textContent || '').indexOf('—') >= 0) {
          metaParagraph = probe;
          break;
        }
        probe = probe.nextElementSibling;
      }
      var parsed = metaParagraph ? parseMetaLine(metaParagraph) : null;
      var category = (parsed && parsed.categoryLabel && CATEGORY_LABEL_TO_ID[parsed.categoryLabel])
        || findCategoryAbove(anchor);

      var block = buildBlock({
        shareId: anchor.id.replace(/^item-/, ''),
        source: parsed ? parsed.source : '',
        category: category,
        score: parsed ? parsed.score : 0,
      });
      range.endEl.insertAdjacentElement('afterend', block);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFeedbackBlocks);
  } else {
    injectFeedbackBlocks();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.feedback-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var container = btn.closest('.article-feedback');
    if (!container) return;

    gtagEvent('article_feedback', {
      article_id: container.getAttribute('data-article-id') || '',
      vote: btn.getAttribute('data-vote') || '',
      source: container.getAttribute('data-source') || '',
      category: container.getAttribute('data-category') || '',
      score: container.getAttribute('data-score') || '',
    });

    btn.classList.add('feedback-active');
    setTimeout(function () { btn.classList.remove('feedback-active'); }, 500);
  });
})();
