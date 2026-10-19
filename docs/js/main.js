// LP コーディングサンプル：UI の振る舞い（ライブラリ不使用・ES Modules）

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
 * ヘッダー：スクロールで背景を付ける
 * ------------------------------------------------------------ */
const initHeader = () => {
  const header = document.querySelector('.js-header');
  if (!header) return;

  // scroll イベントではなく、ヒーロー直下の目印が見えているかで判定する（負荷が軽い）
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', !entry.isIntersecting);
  }).observe(sentinel);
};

/* ------------------------------------------------------------
 * ハンバーガーメニュー
 * ------------------------------------------------------------ */
const initHamburger = () => {
  const button = document.querySelector('.js-hamburger');
  const nav = document.getElementById(button?.getAttribute('aria-controls'));
  if (!button || !nav) return;

  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  };

  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  // リンクを押したら閉じる
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });

  // PC 幅に戻ったら状態をリセット
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
};

/* ------------------------------------------------------------
 * スライダー（矢印・ドット・スワイプ・キーボード）
 * ------------------------------------------------------------ */
const initSlider = (root) => {
  const track = root.querySelector('.js-slider-track');
  const slides = [...track.children];
  const prev = root.querySelector('.js-slider-prev');
  const next = root.querySelector('.js-slider-next');
  const dotsWrap = root.querySelector('.js-slider-dots');
  let index = 0;

  // 画面幅ごとの「1画面に見える枚数」から、最後に止まれる位置を出す
  const perView = () => {
    const slideW = slides[0].getBoundingClientRect().width;
    const viewW = track.parentElement.getBoundingClientRect().width;
    return Math.max(1, Math.round(viewW / slideW));
  };
  const maxIndex = () => Math.max(0, slides.length - perView());

  const renderDots = () => {
    dotsWrap.replaceChildren();
    for (let i = 0; i <= maxIndex(); i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider__dot';
      dot.setAttribute('aria-label', `${i + 1}枚目へ`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.append(dot);
    }
  };

  const update = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const offset = (slides[0].getBoundingClientRect().width + gap) * index;
    track.style.transform = `translateX(${-offset}px)`;

    prev.disabled = index === 0;
    next.disabled = index >= maxIndex();

    [...dotsWrap.children].forEach((dot, i) => {
      dot.setAttribute('aria-current', String(i === index));
    });
    slides.forEach((slide, i) => {
      // 画面外のスライドはフォーカス対象・読み上げ対象から外す
      const visible = i >= index && i < index + perView();
      slide.toggleAttribute('inert', !visible);
      slide.setAttribute('aria-hidden', String(!visible));
    });
  };

  const goTo = (i) => {
    index = Math.min(Math.max(i, 0), maxIndex());
    update();
  };

  prev.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(index - 1);
    if (e.key === 'ArrowRight') goTo(index + 1);
  });

  // スワイプ（Pointer Events でマウス・タッチを共通処理）
  let startX = null;
  track.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
  });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 40) goTo(index + (diff < 0 ? 1 : -1));
    startX = null;
  });

  // 画面幅が変わったら枚数を計算し直す（連続発火は1フレームにまとめる）
  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      renderDots();
      goTo(index);
    });
  }).observe(root);

  renderDots();
  update();
};

/* ------------------------------------------------------------
 * 料金：月額／年額の切り替え
 * ------------------------------------------------------------ */
const initPricing = () => {
  const buttons = document.querySelectorAll('.js-billing');
  const prices = document.querySelectorAll('[data-monthly]');
  const units = document.querySelectorAll('.js-price-unit');
  const yen = new Intl.NumberFormat('ja-JP');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const yearly = button.dataset.billing === 'yearly';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      prices.forEach((el) => {
        const value = Number(yearly ? el.dataset.yearly : el.dataset.monthly);
        el.textContent = `¥${yen.format(value)}`;
      });
      units.forEach((el) => {
        el.textContent = yearly ? '/年（税込）' : '/月（税込）';
      });
    });
  });
};

/* ------------------------------------------------------------
 * モーダル（フォーカストラップ・Esc・背景スクロール固定）
 * ------------------------------------------------------------ */
const initModal = () => {
  const modal = document.querySelector('.js-modal');
  if (!modal) return;
  const dialog = modal.querySelector('[role="dialog"]');
  let lastFocused = null;

  const focusables = () =>
    [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea')]
      .filter((el) => el.offsetParent !== null);

  const open = (trigger) => {
    lastFocused = trigger;
    modal.classList.add('is-open');
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('is-locked');
    // 表示のトランジション後に最初の入力欄へ（無ければ最初の操作要素）
    setTimeout(() => (dialog.querySelector('input') ?? focusables()[0])?.focus(), prefersReducedMotion ? 0 : 50);
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    lastFocused?.focus();
  };

  document.querySelectorAll('.js-modal-open').forEach((btn) => {
    btn.addEventListener('click', () => open(btn));
  });
  modal.querySelectorAll('.js-modal-close').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
};

/* ------------------------------------------------------------
 * フォーム：入力チェック（送信はしない・サンプル）
 * ------------------------------------------------------------ */
const initForm = () => {
  const form = document.querySelector('.js-form');
  if (!form) return;

  const messages = {
    name: { valueMissing: 'お名前を入力してください' },
    email: {
      valueMissing: 'メールアドレスを入力してください',
      typeMismatch: 'メールアドレスの形式で入力してください',
    },
  };

  const validate = (input) => {
    const error = document.getElementById(`${input.id}-error`);
    const rule = messages[input.name] ?? {};
    const key = Object.keys(rule).find((k) => input.validity[k]);
    input.setAttribute('aria-invalid', String(Boolean(key)));
    error.textContent = key ? rule[key] : '';
    return !key;
  };

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('blur', () => validate(input));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validate(input);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll('input')];
    const results = inputs.map(validate);
    const firstInvalid = inputs[results.indexOf(false)];
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    const done = document.createElement('p');
    done.className = 'form__done';
    done.setAttribute('role', 'status');
    done.textContent = 'お申し込みを受け付けました（サンプルのため実際には送信されません）。';
    form.replaceWith(done);
  });
};

/* ------------------------------------------------------------
 * スクロールで要素を表示
 * ------------------------------------------------------------ */
const initReveal = () => {
  const targets = document.querySelectorAll('.reveal');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  targets.forEach((el) => io.observe(el));
};

initHeader();
initHamburger();
document.querySelectorAll('.js-slider').forEach(initSlider);
initPricing();
initModal();
initForm();
initReveal();
