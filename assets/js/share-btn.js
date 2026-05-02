(function () {
  if (typeof window === 'undefined') return;

  var SHARE_ICON_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
    '</svg>';

  function gtagEvent(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params);
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:14px;' +
      'z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:0;';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2000);
  }

  function getDateFromUrl() {
    var m = window.location.pathname.match(/\/posts\/(\d{4}-\d{2}-\d{2})\//);
    return m ? m[1] : '';
  }

  function getPageTitle() {
    var h1 = document.querySelector('article h1.post-title, article h1');
    return (h1 && (h1.textContent || '').trim()) || document.title || '';
  }

  function injectShareButtons() {
    var dateStr = getDateFromUrl();
    if (!dateStr) return;
    var pageTitle = getPageTitle();
    var anchors = document.querySelectorAll('article a.x-anchor[id^="item-"]');
    anchors.forEach(function (anchor) {
      var sibling = anchor.nextElementSibling;
      if (sibling && sibling.classList && sibling.classList.contains('share-item-btn')) return;

      var shareId = anchor.id.replace(/^item-/, '');
      var titleEl = anchor.parentElement && anchor.parentElement.querySelector('strong');
      var itemTitle = titleEl ? (titleEl.textContent || '').trim() : '';

      var btn = document.createElement('button');
      btn.className = 'share-item-btn share-inline';
      btn.type = 'button';
      btn.setAttribute('aria-label', '分享此条');
      btn.setAttribute('title', '分享此条');
      btn.setAttribute('data-share-url', '/share/' + dateStr + '/' + shareId + '/');
      btn.setAttribute('data-share-id', shareId);
      btn.setAttribute('data-title', pageTitle);
      btn.setAttribute('data-item-title', itemTitle);
      btn.innerHTML = SHARE_ICON_SVG;
      anchor.insertAdjacentElement('afterend', btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectShareButtons);
  } else {
    injectShareButtons();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-item-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var shareUrl = btn.getAttribute('data-share-url') || '';
    var pageTitle = btn.getAttribute('data-title') || '';
    var itemTitle = btn.getAttribute('data-item-title') || '';
    var shareId = btn.getAttribute('data-share-id') || '';
    if (!shareId) {
      var anchor = btn.closest('[id^="item-"]');
      if (anchor) shareId = anchor.id.replace('item-', '');
    }
    if (!shareId && shareUrl) {
      var m = shareUrl.match(/\/share\/[^/]+\/([^/]+)\/?$/);
      if (m) shareId = m[1];
    }

    var cleanTitle = itemTitle.replace(/<[^>]*>/g, '').replace(/^\d+\.\s*/, '').trim();
    var fullUrl = window.location.origin + shareUrl.replace(/\/+$/, '') + '/';

    gtagEvent('share_button_click', { share_id: shareId, share_url: fullUrl });

    if (navigator.share) {
      navigator.share({
        title: cleanTitle,
        text: cleanTitle + ' — ' + pageTitle,
        url: fullUrl,
      }).then(function () {
        gtagEvent('share_native_success', { share_id: shareId, share_url: fullUrl });
      }).catch(function () { /* user cancelled */ });
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(function () {
        gtagEvent('share_copy_success', { share_id: shareId, share_url: fullUrl });
        showToast('链接已复制，可粘贴分享');
      }).catch(function () {
        showToast('复制失败，请手动复制链接: ' + fullUrl);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = fullUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        gtagEvent('share_copy_success', { share_id: shareId, share_url: fullUrl });
        showToast('链接已复制，可粘贴分享');
      } catch (_) {
        showToast('链接: ' + fullUrl);
      }
      document.body.removeChild(ta);
    }
  });

  // Track landing on a shared item via URL hash
  (function () {
    var hash = window.location.hash;
    if (hash && hash.indexOf('#item-') === 0) {
      var shareId = hash.replace('#item-', '');
      gtagEvent('shared_item_focus', { share_id: shareId, page_url: window.location.href });
    }
  })();
})();
