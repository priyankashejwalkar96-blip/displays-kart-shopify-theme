/* ================================================================
   DISPLAYSKART SHOPIFY THEME — dk-theme.js
   All interactive behaviours: cart, navigation, product, etc.
   ================================================================ */

'use strict';

/* ── Utilities ─────────────────────────────────────────────────── */
const DK = {
  /** POST to Shopify AJAX API */
  async fetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...options.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('[DK]', e);
      return null;
    }
  },

  /** Show toast notification */
  toast(msg, icon = 'fa-circle-check') {
    const toast = document.getElementById('dk-toast');
    const msgEl = document.getElementById('dk-toast-msg');
    const iconEl = toast?.querySelector('i');
    if (!toast) return;
    if (msgEl) msgEl.textContent = msg;
    if (iconEl) iconEl.className = `fa-solid ${icon}`;
    toast.classList.add('show');
    clearTimeout(DK._toastTimer);
    DK._toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  },

  /** Format money in INR */
  money(cents) {
    return '₹' + (cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

/* ================================================================
   ANNOUNCEMENT BAR
   ================================================================ */
(function initAnnouncementBar() {
  const bar = document.getElementById('dk-announcement-bar');
  const closeBtn = document.getElementById('dk-topbar-close');
  const header = document.getElementById('dk-header');

  if (!bar || !closeBtn) return;

  // Restore closed state
  if (sessionStorage.getItem('dk-topbar-closed')) {
    bar.style.display = 'none';
    if (header) { header.style.top = '0'; header.classList.add('dk-topbar-hidden'); }
  }

  closeBtn.addEventListener('click', () => {
    bar.style.display = 'none';
    if (header) { header.style.top = '0'; header.classList.add('dk-topbar-hidden'); }
    sessionStorage.setItem('dk-topbar-closed', '1');
  });
})();

/* ================================================================
   STICKY HEADER
   ================================================================ */
(function initStickyHeader() {
  const header = document.getElementById('dk-header');
  if (!header) return;
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('dk-header--scrolled', y > 10);
    lastY = y;
  }, { passive: true });
})();

/* ================================================================
   BACK TO TOP
   ================================================================ */
(function initBackToTop() {
  const btn = document.getElementById('dk-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ================================================================
   MOBILE MENU
   ================================================================ */
(function initMobileMenu() {
  const toggle = document.getElementById('dk-mobile-menu-toggle');
  const nav = document.getElementById('dk-mobile-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
    nav.setAttribute('aria-hidden', !isOpen);
    nav.style.display = isOpen ? 'block' : 'none';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Submenu toggle
  const subToggle = document.getElementById('dk-mobile-collections-toggle');
  const subMenu = document.getElementById('dk-mobile-collections-sub');
  if (subToggle && subMenu) {
    subToggle.addEventListener('click', () => {
      const isOpen = subMenu.classList.toggle('open');
      subToggle.setAttribute('aria-expanded', isOpen);
      subMenu.setAttribute('aria-hidden', !isOpen);
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', false);
      nav.setAttribute('aria-hidden', true);
      document.body.style.overflow = '';
    }
  });
})();

/* ================================================================
   CART DRAWER
   ================================================================ */
(function initCartDrawer() {
  const drawer = document.getElementById('dk-cart-drawer');
  const overlay = document.getElementById('dk-cart-overlay');
  const toggleBtn = document.getElementById('dk-cart-toggle');
  const closeBtn = document.getElementById('dk-cart-close');

  if (!drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
    refreshCartDrawer();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggleBtn?.focus();
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Keyboard trap
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Expose globally
  window.DKCart = { open: openDrawer, close: closeDrawer };
})();

/* ── Cart: Add Item ─────────────────────────────────────────────── */
async function DKAddToCart(variantId, qty = 1, productTitle = '') {
  const res = await DK.fetch('/cart/add.js', {
    method: 'POST',
    body: JSON.stringify({ id: variantId, quantity: qty }),
  });
  if (!res) { DK.toast('Could not add to cart', 'fa-exclamation-circle'); return; }
  DK.toast(productTitle ? `"${productTitle.slice(0, 30)}" added to cart!` : 'Added to cart!');
  updateCartCount();
  if (window.DKCart) window.DKCart.open();
}

/* ── Cart: Update ───────────────────────────────────────────────── */
async function DKUpdateCart(key, qty) {
  const res = await DK.fetch('/cart/change.js', {
    method: 'POST',
    body: JSON.stringify({ id: key, quantity: qty }),
  });
  if (res) { updateCartCount(res.item_count); refreshCartDrawer(); }
}

/* ── Cart: Count ────────────────────────────────────────────────── */
async function updateCartCount(count) {
  if (count !== undefined) {
    document.querySelectorAll('#dk-cart-count, #dk-drawer-count').forEach(el => el.textContent = count);
    return;
  }
  const res = await DK.fetch('/cart.js');
  if (res) {
    const c = res.item_count;
    document.querySelectorAll('#dk-cart-count, #dk-drawer-count').forEach(el => el.textContent = c);
  }
}

/* ── Cart Drawer: Refresh HTML ──────────────────────────────────── */
async function refreshCartDrawer() {
  // Fetch fresh sections via Shopify Sections API
  const url = `/?sections=cart-drawer-items`;
  // Fallback: reload cart JS and rebuild
  const res = await DK.fetch('/cart.js');
  if (!res) return;

  updateCartCount(res.item_count);

  const subtotalEl = document.getElementById('dk-cart-subtotal');
  if (subtotalEl) subtotalEl.textContent = DK.money(res.total_price);

  const drawerCountEl = document.getElementById('dk-drawer-count');
  if (drawerCountEl) drawerCountEl.textContent = res.item_count;

  // Update shipping bar
  const freeShippingThreshold = 100000; // ₹1000 = 100000 paise
  const shippingBarFill = document.querySelector('.dk-cart-drawer__shipping-fill');
  const shippingMsg = document.querySelector('.dk-cart-drawer__shipping-msg');
  if (shippingBarFill && shippingMsg) {
    const pct = Math.min((res.total_price / freeShippingThreshold) * 100, 100);
    shippingBarFill.style.width = pct + '%';
    if (res.total_price >= freeShippingThreshold) {
      shippingMsg.innerHTML = '<i class="fa-solid fa-truck-fast"></i> You qualify for <strong>Free Shipping!</strong>';
      shippingMsg.classList.add('dk-cart-drawer__shipping-msg--done');
    } else {
      const remaining = ((freeShippingThreshold - res.total_price) / 100).toFixed(0);
      shippingMsg.innerHTML = `Add <strong>₹${remaining}</strong> more for <strong>Free Shipping</strong>`;
      shippingMsg.classList.remove('dk-cart-drawer__shipping-msg--done');
    }
  }
}

/* ── Cart: Quantity Buttons ─────────────────────────────────────── */
document.addEventListener('click', async (e) => {
  // Plus / minus in cart drawer
  if (e.target.closest('.dk-qty__btn')) {
    const btn = e.target.closest('.dk-qty__btn');
    const qtyEl = btn.closest('.dk-qty')?.querySelector('.dk-qty__input');
    if (!qtyEl) return;
    const key = btn.closest('[data-key]')?.dataset.key || qtyEl.dataset?.key;
    let qty = parseInt(qtyEl.value, 10) || 1;
    if (btn.classList.contains('dk-qty__btn--plus')) qty++;
    if (btn.classList.contains('dk-qty__btn--minus')) qty = Math.max(1, qty - 1);
    qtyEl.value = qty;
    if (key) DKUpdateCart(key, qty);
  }

  // Remove from cart
  if (e.target.closest('.dk-cart-item__remove')) {
    const btn = e.target.closest('.dk-cart-item__remove');
    const key = btn.dataset.key;
    const item = btn.closest('.dk-cart-item');
    if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; }
    if (key) await DKUpdateCart(key, 0);
    if (item) item.remove();
  }

  // Add to cart (product cards)
  if (e.target.closest('.dk-product-card__atc, .dk-product-card__quick-add')) {
    const btn = e.target.closest('.dk-product-card__atc, .dk-product-card__quick-add');
    const variantId = btn.dataset.variantId;
    const card = btn.closest('.dk-product-card');
    const title = card?.querySelector('.dk-product-card__title a')?.textContent?.trim();
    if (!variantId) return;
    btn.disabled = true;
    btn.textContent = 'Adding…';
    await DKAddToCart(variantId, 1, title);
    btn.disabled = false;
    btn.textContent = btn.classList.contains('dk-product-card__quick-add') ? '✓ Added!' : 'Add To Cart';
    setTimeout(() => {
      btn.textContent = btn.classList.contains('dk-product-card__quick-add') ? 'Quick Add' : 'Add To Cart';
    }, 2000);
  }

  // Wishlist toggle
  if (e.target.closest('.dk-product-card__wishlist')) {
    const btn = e.target.closest('.dk-product-card__wishlist');
    btn.classList.toggle('on');
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = btn.classList.contains('on') ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }
    DK.toast(btn.classList.contains('on') ? 'Added to wishlist ♥' : 'Removed from wishlist', btn.classList.contains('on') ? 'fa-heart' : 'fa-heart-crack');
  }
});

/* ================================================================
   PRODUCT PAGE
   ================================================================ */
(function initProductPage() {
  // Gallery: thumbnail click
  const thumbs = document.querySelectorAll('.dk-gallery__thumb');
  const mainImg = document.getElementById('dk-main-img');
  if (thumbs.length && mainImg) {
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        mainImg.src = thumb.dataset.src;
        mainImg.alt = thumb.dataset.alt || '';
        thumbs.forEach(t => t.classList.remove('dk-gallery__thumb--active'));
        thumb.classList.add('dk-gallery__thumb--active');
      });
    });
  }

  // Gallery: zoom on mousemove
  const galleryMain = document.querySelector('.dk-gallery__main');
  if (galleryMain) {
    galleryMain.addEventListener('mousemove', (e) => {
      const rect = galleryMain.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      galleryMain.style.setProperty('--mx', x + '%');
      galleryMain.style.setProperty('--my', y + '%');
    });
  }

  // Product Form: Add to Cart
  const form = document.getElementById('dk-product-form');
  const atcBtn = document.getElementById('dk-atc-btn');
  const mobileAtcBtn = document.getElementById('dk-mobile-atc');
  const variantInput = document.getElementById('dk-variant-id');
  const qtyInput = document.getElementById('dk-qty');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const variantId = variantInput?.value;
      const qty = parseInt(qtyInput?.value, 10) || 1;
      if (!variantId) return;
      if (atcBtn) { atcBtn.disabled = true; atcBtn.textContent = 'Adding…'; }
      await DKAddToCart(variantId, qty);
      if (atcBtn) { atcBtn.disabled = false; atcBtn.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> Add To Cart'; }
    });
  }

  if (mobileAtcBtn) {
    mobileAtcBtn.addEventListener('click', () => form?.requestSubmit());
  }

  // Variant Options
  const optionBtns = document.querySelectorAll('.dk-option-btn');
  optionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = btn.dataset.option;
      btn.closest('.dk-product-info__option-values')?.querySelectorAll('.dk-option-btn').forEach(b => b.classList.remove('dk-option-btn--active'));
      btn.classList.add('dk-option-btn--active');
      // In a real theme this would update the variant ID via JS
    });
  });

  // Tabs
  const tabBtns = document.querySelectorAll('.dk-product-tabs__tab');
  const tabPanels = document.querySelectorAll('.dk-product-tabs__panel');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('aria-controls');
      tabBtns.forEach(b => { b.classList.remove('dk-product-tabs__tab--active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.classList.remove('dk-product-tabs__panel--active'));
      btn.classList.add('dk-product-tabs__tab--active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(target)?.classList.add('dk-product-tabs__panel--active');
    });
  });

  // Quantity controls
  document.querySelectorAll('.dk-product-form .dk-qty__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.dk-qty')?.querySelector('.dk-qty__input');
      if (!input) return;
      let v = parseInt(input.value, 10) || 1;
      if (btn.classList.contains('dk-qty__btn--plus')) v++;
      if (btn.classList.contains('dk-qty__btn--minus')) v = Math.max(1, v - 1);
      input.value = v;
    });
  });

  // Pincode check
  const pinBtn = document.getElementById('dk-pin-check-btn');
  const pinInput = document.querySelector('.dk-pin-check__input');
  const pinResult = document.getElementById('dk-pin-result');
  if (pinBtn && pinInput && pinResult) {
    pinBtn.addEventListener('click', () => {
      const pin = pinInput.value.trim();
      if (pin.length !== 6 || isNaN(pin)) {
        pinResult.textContent = 'Please enter a valid 6-digit pincode.';
        pinResult.style.color = '#dc2626';
        return;
      }
      pinResult.textContent = 'Checking…';
      pinResult.style.color = '#737373';
      setTimeout(() => {
        pinResult.textContent = `✓ Delivery available to ${pin} in 3–5 business days!`;
        pinResult.style.color = '#15803d';
      }, 800);
    });
  }

  // Mobile sticky bar visibility
  const mobileSticky = document.getElementById('dk-mobile-sticky');
  const productForm = document.getElementById('dk-product-form');
  if (mobileSticky && productForm) {
    const observer = new IntersectionObserver(entries => {
      mobileSticky.style.display = entries[0].isIntersecting ? 'none' : 'flex';
    }, { threshold: 0 });
    observer.observe(productForm);
  }
})();

/* ================================================================
   CONTACT PAGE
   ================================================================ */
(function initContactPage() {
  // Opening hours status
  const statusEl = document.getElementById('dk-hours-status');
  if (statusEl) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const hour = now.getHours();
    const isOpen = day !== 0 && hour >= 10 && hour < 19;
    statusEl.textContent = isOpen ? 'Open now' : 'Closed';
    statusEl.className = 'dk-hours-status ' + (isOpen ? 'open' : 'closed');
  }

  // Message character count
  const msgTextarea = document.getElementById('ct-message');
  const countEl = document.getElementById('dk-msg-count');
  if (msgTextarea && countEl) {
    msgTextarea.addEventListener('input', () => {
      countEl.textContent = `${msgTextarea.value.length} / 800`;
    });
  }

  // FAQ details mutual exclusive
  const faqs = document.querySelectorAll('.dk-faq-item');
  faqs.forEach(faq => {
    faq.addEventListener('toggle', () => {
      if (faq.open) faqs.forEach(f => { if (f !== faq) f.open = false; });
    });
  });
})();

/* ================================================================
   COLLECTION / SHOP PAGE
   ================================================================ */
(function initCollectionPage() {
  // View toggle (grid / list)
  const gridBtn = document.getElementById('dk-view-grid');
  const listBtn = document.getElementById('dk-view-list');
  const grid = document.getElementById('dk-shop-grid');
  if (gridBtn && listBtn && grid) {
    gridBtn.addEventListener('click', () => {
      grid.classList.remove('view-list');
      gridBtn.classList.add('dk-view-toggle__btn--active'); gridBtn.setAttribute('aria-pressed', 'true');
      listBtn.classList.remove('dk-view-toggle__btn--active'); listBtn.setAttribute('aria-pressed', 'false');
    });
    listBtn.addEventListener('click', () => {
      grid.classList.add('view-list');
      listBtn.classList.add('dk-view-toggle__btn--active'); listBtn.setAttribute('aria-pressed', 'true');
      gridBtn.classList.remove('dk-view-toggle__btn--active'); gridBtn.setAttribute('aria-pressed', 'false');
    });
  }

  // Filter toggle (mobile)
  const filterToggle = document.getElementById('dk-filter-toggle');
  const sidebar = document.getElementById('dk-sidebar');
  const sidebarClose = document.getElementById('dk-sidebar-close');
  if (filterToggle && sidebar) {
    filterToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      filterToggle.setAttribute('aria-expanded', isOpen);
    });
    if (sidebarClose) sidebarClose.addEventListener('click', () => { sidebar.classList.remove('open'); filterToggle.setAttribute('aria-expanded', 'false'); });
  }

  // Price range filter apply
  const priceApply = document.getElementById('dk-price-apply');
  if (priceApply) {
    priceApply.addEventListener('click', () => {
      const min = document.getElementById('price-min')?.value;
      const max = document.getElementById('price-max')?.value;
      const params = new URLSearchParams(window.location.search);
      if (min) params.set('filter.v.price.gte', min);
      if (max) params.set('filter.v.price.lte', max);
      window.location.search = params.toString();
    });
  }
})();

/* ================================================================
   SCROLL ANIMATIONS (Intersection Observer)
   ================================================================ */
(function initScrollAnimations() {
  if (!window.IntersectionObserver) return;
  const animEls = document.querySelectorAll('.dk-product-card, .dk-review-card, .dk-usp-card, .dk-contact-quick');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  animEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity .5s ease ${i * 0.06}s, transform .5s ease ${i * 0.06}s`;
    observer.observe(el);
  });
})();

/* ================================================================
   MEGA MENU: accessible keyboard
   ================================================================ */
(function initMegaMenu() {
  const megaParent = document.getElementById('nav-collections');
  if (!megaParent) return;
  const link = megaParent.querySelector('.dk-nav__link');
  const menu = megaParent.querySelector('.dk-mega-menu');
  if (!link || !menu) return;

  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const showing = menu.style.display === 'block';
      menu.style.display = showing ? 'none' : 'block';
      link.setAttribute('aria-expanded', !showing);
    }
    if (e.key === 'Escape') { menu.style.display = 'none'; link.setAttribute('aria-expanded', 'false'); }
  });

  document.addEventListener('click', (e) => {
    if (!megaParent.contains(e.target)) { menu.style.display = 'none'; link.setAttribute('aria-expanded', 'false'); }
  });
})();

/* ================================================================
   ON DOCUMENT READY
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
});
