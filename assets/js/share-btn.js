(function () {
  if (typeof window === 'undefined') return;

  function gtagEvent(name, params) {
    if (typeof gtag === 'function') {
      gtag('event', name, params);
    }
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:14px;' +
      'z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:0;';
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-item-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var shareUrl = btn.getAttribute('data-share-url');
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

    gtagEvent('share_button_click', {
      share_id: shareId,
      share_url: fullUrl
    });

    if (navigator.share) {
      navigator.share({
        title: cleanTitle,
        text: cleanTitle + ' — ' + pageTitle,
        url: fullUrl,
      }).then(function () {
        gtagEvent('share_native_success', {
          share_id: shareId,
          share_url: fullUrl
        });
      }).catch(function () {
        // User cancelled — not an error
      });
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(function () {
        gtagEvent('share_copy_success', {
          share_id: shareId,
          share_url: fullUrl
        });
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
        gtagEvent('share_copy_success', {
          share_id: shareId,
          share_url: fullUrl
        });
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
      if (typeof gtag === 'function') {
        gtag('event', 'shared_item_focus', {
          share_id: shareId,
          page_url: window.location.href
        });
      }
    }
  })();
})();
