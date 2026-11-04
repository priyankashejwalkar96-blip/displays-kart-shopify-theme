/* Displays Kart – Shopify theme JS (vanilla, no dependencies) */
(function () {
  'use strict';
  var T = window.theme || {};
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var $$ = function (q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); };

  /* ---------- helpers ---------- */
  function money(cents) {
    var fmt = T.moneyFormat || '₹{{amount}}';
    var v = (cents / 100);
    function fmtNum(n, dec, thou, dp) {
      dec = dec == null ? 2 : dec; thou = thou || ','; dp = dp || '.';
      var s = n.toFixed(dec).split('.');
      s[0] = s[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thou);
      return s[0] + (s[1] ? dp + s[1] : '');
    }
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, name) {
      switch (name) {
        case 'amount': return fmtNum(v, 2);
        case 'amount_no_decimals': return fmtNum(v, 0);
        case 'amount_with_comma_separator': return fmtNum(v, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fmtNum(v, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return fmtNum(v, 2, "'", '.');
        default: return fmtNum(v, 2);
      }
    });
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#dk-toast'); if (!t) return;
    $('span', t).textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function bump(el) { if (!el) return; el.classList.remove('dk-bump'); void el.offsetWidth; el.classList.add('dk-bump'); }
  function jsonFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, opts.headers || {});
    return fetch(url, opts).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); });
  }
  function setCartCount(n) {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; bump(el); });
  }

  /* ---------- floating UI: progress, back to top, sticky header ---------- */
  var prog = $('#dk-prog'), topb = $('#dk-top'), hdr = $('[data-header]');
  if (topb) topb.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
      if (prog) prog.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
      if (topb) topb.classList.toggle('show', y > 600);
      if (hdr) hdr.classList.toggle('dk-scrolled', y > 40);
      ticking = false;
    });
  }, { passive: true });

  /* ---------- announcement bar + mobile menu ---------- */
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-announce-close]');
    if (close) {
      var bar = $('#top-announcement-bar'); if (bar) bar.style.display = 'none';
      if (hdr) hdr.style.top = '0';
      try { sessionStorage.setItem('dk-announce-closed', '1'); } catch (_) {}
    }
    var mt = e.target.closest('[data-mobile-toggle]');
    if (mt) { var m = $('[data-mobile-menu]'); if (m) m.classList.toggle('hidden'); }
    var ft = e.target.closest('[data-filter-toggle]');
    if (ft) { var sb = $('#shop-sidebar'); if (sb) sb.classList.toggle('hidden'); }
  });
  try {
    if (sessionStorage.getItem('dk-announce-closed')) {
      var b = $('#top-announcement-bar'); if (b) b.style.display = 'none';
      if (hdr) hdr.style.top = '0';
    }
  } catch (_) {}

  /* ---------- AJAX add to cart ---------- */
  function addToCart(formData) {
    return fetch(T.cartAddUrl + '.js', { method: 'POST', headers: { 'Accept': 'application/json' }, body: formData })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.status) throw d; return d; }); })
      .then(function (item) {
        return jsonFetch(T.cartJsUrl).then(function (cart) { setCartCount(cart.item_count); return item; });
      });
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-ajax-add]');
    if (!f) return;
    e.preventDefault();
    var btn = $('button[type=submit]', f);
    if (btn) btn.disabled = true;
    addToCart(new FormData(f)).then(function () { toast(T.strings && T.strings.added || 'Added to cart'); })
      .catch(function (err) { toast((err && (err.description || err.message)) || 'Could not add to cart'); })
      .then(function () { if (btn) btn.disabled = false; });
  });

  /* ---------- wishlist (localStorage) ---------- */
  var WL_KEY = 'dk-wishlist';
  function wlGet() { try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch (_) { return []; } }
  function wlSet(a) { try { localStorage.setItem(WL_KEY, JSON.stringify(a)); } catch (_) {} }
  function wlRender() {
    var list = wlGet();
    $$('[data-wishlist-count]').forEach(function (el) { el.textContent = list.length; });
    $$('[data-wishlist-toggle]').forEach(function (b) {
      var on = list.indexOf(b.dataset.handle) > -1;
      b.classList.toggle('on', on);
      var i = $('i', b); if (i) i.className = (on ? 'fa-solid' : 'fa-regular') + ' fa-heart';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wishlist-toggle]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var list = wlGet(), h = b.dataset.handle, i = list.indexOf(h);
    if (i > -1) list.splice(i, 1); else list.push(h);
    wlSet(list); wlRender(); bump($('[data-wishlist-count]'));
    toast(i > -1 ? (T.strings.wishlistRemoved || 'Removed from wishlist') : (T.strings.wishlistAdded || 'Saved to wishlist'));
    if ($('[data-wishlist-grid]')) wlPage();
  }, true);
  function wlPage() {
    var grid = $('[data-wishlist-grid]'); if (!grid) return;
    var list = wlGet(), empty = $('#wishlist-empty');
    grid.innerHTML = '';
    if (!list.length) { if (empty) empty.classList.remove('hidden'); return; }
    if (empty) empty.classList.add('hidden');
    Promise.all(list.map(function (h) {
      return fetch('/products/' + h + '.js').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (ps) {
      grid.innerHTML = ps.filter(Boolean).map(function (p) {
        var img = p.featured_image ? '<img src="' + p.featured_image + '" alt="" class="w-full h-full object-cover" loading="lazy">' : '';
        return '<div class="product-card bg-white rounded-xl border border-gray-200 p-4 flex flex-col justify-between">' +
          '<div class="product-img-box aspect-square rounded-lg bg-gray-50 mb-4"><a href="' + p.url + '" class="block w-full h-full">' + img + '</a>' +
          '<button type="button" class="dk-heart on" data-wishlist-toggle data-handle="' + p.handle + '" aria-label="Remove"><i class="fa-solid fa-heart"></i></button></div>' +
          '<h3 class="text-xs font-bold text-neutral-900 text-center"><a href="' + p.url + '">' + p.title + '</a></h3>' +
          '<div class="text-center mt-4 pt-3 border-t border-gray-100"><div class="text-sm font-black text-red-600">' + money(p.price) + '</div>' +
          '<a href="' + p.url + '" class="block w-full mt-3 bg-neutral-900 hover:bg-red-600 text-white font-bold text-xs py-2 rounded-lg transition uppercase tracking-wider">View product</a></div></div>';
      }).join('');
      wlRender();
    });
  }
  wlRender(); wlPage();

  /* ---------- share ---------- */
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-share]'); if (!s) return;
    var url = s.dataset.share, title = s.dataset.shareTitle || document.title;
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { toast('Link copied'); }); }
  });

  /* ---------- collection view toggle ---------- */
  var grid = $('#shop-grid'), vt = $('#view-toggle');
  if (grid && vt) {
    var applyView = function (v) {
      grid.classList.remove('view-list', 'view-compact');
      if (v !== 'grid') grid.classList.add('view-' + v);
      $$('button', vt).forEach(function (b) { b.classList.toggle('text-red-600', b.dataset.view === v); });
      try { localStorage.setItem('dk-view', v); } catch (_) {}
    };
    vt.addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) applyView(b.dataset.view); });
    var saved = 'grid'; try { saved = localStorage.getItem('dk-view') || 'grid'; } catch (_) {}
    applyView(saved);
  }

  /* ---------- product page ---------- */
  var ps = $('[data-product-section]');
  if (ps) {
    var form = $('[data-product-form]', ps), qty = $('#pd-qty', ps);
    var variants = []; try { variants = JSON.parse($('[data-variants]', ps).textContent); } catch (_) {}
    var current = variants.filter(function (v) { return String(v.id) === $('[data-variant-id]', ps).value; })[0] || variants[0];

    function updateTotal() {
      var q = Math.max(1, Math.min(999, parseInt(qty.value, 10) || 1));
      qty.value = q;
      var tot = $('[data-total]', ps); if (tot && current) tot.textContent = money(q * current.price);
      var bulk = $('#pd-bulk', ps); if (bulk) bulk.classList.toggle('hidden', q < 10);
      return q;
    }
    $$('.pd-qty button[data-q]', ps).forEach(function (b) {
      b.addEventListener('click', function () { qty.value = (parseInt(qty.value, 10) || 1) + parseInt(b.dataset.q, 10); updateTotal(); });
    });
    qty.addEventListener('input', updateTotal);

    function selectedOptions() {
      return $$('[data-option-index]', ps).map(function (g) { var c = $('input:checked', g); return c ? c.value : null; });
    }
    function updateVariant() {
      var opts = selectedOptions();
      $$('[data-option-index]', ps).forEach(function (g, i) { var s = $('[data-option-selected]', g); if (s) s.textContent = opts[i]; });
      var match = variants.filter(function (v) { return opts.every(function (o, i) { return v.options[i] === o; }); })[0];
      var addBtn = $('[data-add-btn]', ps), buyBtn = $('[data-buy-btn]', ps), sticky = $('[data-sticky-add]', ps), label = $('[data-add-label]', ps);
      var stock = $('[data-stock]', ps);
      if (!match) {
        if (addBtn) addBtn.disabled = true; if (buyBtn) buyBtn.disabled = true; if (sticky) sticky.disabled = true;
        if (label) label.textContent = T.strings.soldOut; return;
      }
      current = match;
      $('[data-variant-id]', ps).value = match.id;
      $('[data-price]', ps).textContent = money(match.price);
      var sp = $('[data-price-sticky]', ps); if (sp) sp.textContent = money(match.price);
      var cmp = $('[data-compare]', ps), save = $('[data-save]', ps), badge = $('[data-sale-badge]', ps);
      var sale = match.compare_at_price && match.compare_at_price > match.price;
      if (cmp) { cmp.classList.toggle('hidden', !sale); cmp.textContent = sale ? money(match.compare_at_price) : ''; }
      if (save) { save.classList.toggle('hidden', !sale); save.textContent = sale ? 'You save ' + money(match.compare_at_price - match.price) : ''; }
      if (badge) badge.style.display = sale ? '' : 'none';
      var sku = $('[data-sku]', ps); if (sku && match.sku) sku.textContent = 'SKU: ' + match.sku;
      [addBtn, buyBtn, sticky].forEach(function (b) { if (b) b.disabled = !match.available; });
      if (label) label.textContent = match.available ? (label.dataset.add || 'Add to cart') : T.strings.soldOut;
      if (stock) stock.classList.toggle('text-red-600', !match.available), stock.classList.toggle('text-emerald-600', match.available);
      if (match.featured_image) { var im = $('#pd-img', ps); if (im) im.src = match.featured_image.src; }
      var u = new URL(location.href); u.searchParams.set('variant', match.id); history.replaceState({}, '', u);
      updateTotal();
    }
    $$('[data-option-index] input', ps).forEach(function (i) { i.addEventListener('change', updateVariant); });

    /* add to cart (ajax) — "Buy now" falls through to normal submit so Shopify redirects to checkout */
    if (form) {
      form.addEventListener('submit', function (e) {
        var sub = e.submitter;
        if (sub && sub.name === 'checkout') return;
        e.preventDefault();
        var btn = $('[data-add-btn]', form); if (btn) btn.disabled = true;
        addToCart(new FormData(form)).then(function () { toast(T.strings.added); })
          .catch(function (err) { toast((err && (err.description || err.message)) || 'Could not add to cart'); })
          .then(function () { if (btn && current && current.available) btn.disabled = false; });
      });
    }
    var st = $('[data-sticky-add]', ps);
    if (st) st.addEventListener('click', function () { if (form) { if (form.requestSubmit) form.requestSubmit($('[data-add-btn]', form)); else form.submit(); } });

    /* tabs */
    $$('.pd-tab', ps).forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.pd-tab', ps).forEach(function (x) { x.classList.toggle('on', x === t); });
        $$('.pd-pane', ps).forEach(function (x) { x.classList.toggle('on', x.id === 'pd-' + t.dataset.tab); });
      });
    });

    /* zoom + thumbs */
    var zoom = $('#pd-zoom', ps), zimg = $('#pd-img', ps);
    if (zoom && zimg) {
      zoom.addEventListener('mousemove', function (e) {
        var r = zoom.getBoundingClientRect();
        zimg.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      });
    }
    $$('[data-thumb]', ps).forEach(function (t) {
      t.addEventListener('click', function () {
        if (zimg) zimg.src = t.dataset.thumb;
        $$('[data-thumb]', ps).forEach(function (x) { x.classList.toggle('border-amber-500', x === t); x.classList.toggle('border-gray-200', x !== t); });
      });
    });

    /* pincode (informational) */
    var pin = $('[data-pincode]', ps);
    if (pin) pin.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#pd-pin-in', ps).value.trim(), m = $('#pd-pin-msg', ps);
      if (!/^\d{6}$/.test(v)) { m.className = 'text-xs mt-2 font-semibold text-red-600'; m.textContent = 'Please enter a valid 6-digit pincode.'; return; }
      m.className = 'text-xs mt-2 font-semibold text-emerald-600';
      m.innerHTML = '<i class="fa-solid fa-truck-fast mr-1"></i>Delivery available to ' + v + ' — usually 3–7 working days.';
    });

    /* related products (section rendering) */
    var rel = $('[data-related]', ps);
    if (rel && rel.dataset.url) {
      fetch(rel.dataset.url).then(function (r) { return r.text(); }).then(function (html) {
        var d = document.createElement('div'); d.innerHTML = html;
        var inner = $('[data-section-id], .shopify-section', d) || d;
        rel.innerHTML = inner.innerHTML; wlRender();
      }).catch(function () {});
    }
    updateTotal();
  }

  /* ---------- cart page ---------- */
  var cartForm = $('[data-cart-form]');
  if (cartForm) {
    cartForm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cart-q]'); if (!b) return;
      var input = $('input', b.parentNode);
      input.value = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(b.dataset.cartQ, 10));
      var line = parseInt(input.dataset.line, 10);
      jsonFetch(T.cartChangeUrl + '.js', { method: 'POST', body: JSON.stringify({ line: line, quantity: parseInt(input.value, 10) }) })
        .then(function () { location.reload(); }).catch(function () { cartForm.submit(); });
    });
  }

  /* ---------- contact char counter ---------- */
  $$('[data-count-for]').forEach(function (c) {
    var t = document.getElementById(c.dataset.countFor); if (!t) return;
    var up = function () { c.textContent = t.value.length + ' / ' + (t.maxLength > 0 ? t.maxLength : 800); };
    t.addEventListener('input', up); up();
  });

  /* ---------- hero count-up ---------- */
  function countUp(el) {
    if (el.dataset.cu || RM) return; el.dataset.cu = 1;
    var m = el.textContent.trim().match(/^([\d,]+(?:\.\d+)?)(.*)$/); if (!m) return;
    var end = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length, suf = m[2], t0 = performance.now();
    (function f(t) {
      var p = Math.min((t - t0) / 1300, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * e).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  $$('[data-countup]').forEach(countUp);

  /* ---------- reveal on scroll ---------- */
  if (!RM && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('dk-js');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('dk-in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    $$('main section:not(.bg-neutral-950):not(.ct-hero), .product-card, article').forEach(function (el, i) {
      el.style.setProperty('--d', Math.min(i % 8, 7) * 0.07 + 's');
      el.classList.add('dk-r'); io.observe(el);
    });
  }
})();
