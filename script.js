/**
 * MatrixLab Studio — Spatial Matrix Filter Logic
 * Preserves the exact calculation algorithms (Mean, Median, Prewitt, Zero Padding)
 * Enhances UI interactivity, cell selection highlight, and detailed step rendering.
 */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Sample Matrix (5x5)
const SAMPLE = [
  [10, 20, 30, 40, 50],
  [15, 25, 35, 45, 55],
  [20, 30, 90, 50, 60],
  [25, 35, 45, 55, 65],
  [30, 40, 50, 60, 70]
];

// Helper to format float values concisely
const fmt = v => {
  const s = String(Number(v.toFixed(4)));
  return s === '-0' ? '0' : s;
};

// Clamp values to bounds
const clamp = (v, a, b) => Math.min(b, Math.max(a, v || a));

// Application State
let method = 'mean';
let dims = { R: 5, C: 5 };
let kk = 3;
let ctx = null;
let activeCoord = null;

// ==========================================================================
// Theme Management (Light / Dark)
// ==========================================================================
const initTheme = () => {
  const saved = localStorage.getItem('matrixlab_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('matrixlab_theme', next);
};

$('#theme-toggle')?.addEventListener('click', toggleTheme);
initTheme();

// ==========================================================================
// Matrix DOM Building
// ==========================================================================
function updateDimBadge() {
  const badge = $('#matrix-dim-badge');
  if (badge) badge.textContent = `${dims.R} × ${dims.C} ô`;
}

function build(el, R, C, fn) {
  el.style.setProperty('--c', C);
  el.className = 'grid';
  el.innerHTML = '';
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      const x = document.createElement('input');
      x.type = 'number';
      x.step = 'any';
      x.value = fn(i, j);
      x.setAttribute('aria-label', `Hàng ${i + 1}, cột ${j + 1}`);
      x.placeholder = '0';
      el.appendChild(x);
    }
  }
  updateDimBadge();
}

const raw = el => [...el.querySelectorAll('input')].map(x => x.value);

// Prewitt standard kernel calculation (preserving original formula)
const defKer = (a, k) => (i, j) => {
  const t = a === 'x' ? j : i;
  return k % 2 ? Math.sign(t - (k >> 1)) : (t < k / 2 ? -1 : 1);
};

function buildKers() {
  build($('#gx'), kk, kk, defKer('x', kk));
  build($('#gy'), kk, kk, defKer('y', kk));
}

function note() {
  $('#kn').textContent = kk % 2
    ? 'Cửa sổ lẻ (k = ' + kk + '): Điểm đang xét nằm chính giữa cửa sổ. Padding đều ' + (kk >> 1) + ' ô mỗi phía.'
    : 'Cửa sổ chẵn (k = ' + kk + '): Tâm lệch, padding trên/trái là ' + (kk / 2) + ', dưới/phải là ' + (kk / 2 - 1) + '. Median lấy trung bình cộng hai giá trị giữa.';
}

function rebuildMat() {
  const old = raw($('#mat')), oc = dims.C, oR = dims.R;
  const R = clamp(+$('#rows').value, 1, 10);
  const C = clamp(+$('#cols').value, 1, 10);
  $('#rows').value = R;
  $('#cols').value = C;
  build($('#mat'), R, C, (i, j) => (i < oR && j < oc ? old[i * oc + j] : ''));
  dims = { R, C };
}

// Stepper click handler (+ / - buttons)
document.addEventListener('click', e => {
  const b = e.target.closest('.step button');
  if (b) {
    const inp = b.parentNode.querySelector('input');
    const stepVal = b === b.parentNode.firstElementChild ? -1 : 1;
    inp.value = (+inp.value || 0) + stepVal;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
});

$('#rows').onchange = $('#cols').onchange = rebuildMat;

$('#k').onchange = () => {
  kk = clamp(Math.round(+$('#k').value), 1, 9);
  $('#k').value = kk;
  buildKers();
  note();
};

// Actions: Sample, Random, Clear
$('#sample').onclick = () => {
  dims = { R: 5, C: 5 };
  $('#rows').value = 5;
  $('#cols').value = 5;
  build($('#mat'), 5, 5, (i, j) => SAMPLE[i][j]);
  $('#out').hidden = true;
};

const randomBtn = $('#random');
if (randomBtn) {
  randomBtn.onclick = () => {
    build($('#mat'), dims.R, dims.C, () => Math.floor(Math.random() * 90 + 10));
    $('#out').hidden = true;
  };
}

$('#clear').onclick = () => {
  build($('#mat'), dims.R, dims.C, () => '');
  $('#out').hidden = true;
};

$('#rk').onclick = buildKers;

// Method Selection (Segmented Control)
$$('.seg button').forEach(b => {
  b.onclick = () => {
    method = b.dataset.m;
    $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#kers').hidden = method !== 'prewitt';
    $('#out').hidden = true;
  };
});

document.addEventListener('input', () => {
  $('#out').hidden = true;
});

// ==========================================================================
// Core Filtering Calculations (Exact algorithmic implementation preserved)
// ==========================================================================
function calc(i, j) {
  const { m, R, C, k, Kx, Ky } = ctx;
  const p = k >> 1;
  const get = (y, x) => (y < 0 || x < 0 || y >= R || x >= C ? 0 : m[y][x]);
  const w = Array.from({ length: k }, (_, a) =>
    Array.from({ length: k }, (_, b) => get(i - p + a, j - p + b))
  );
  const f = w.flat();

  // 1. Mean Filter
  if (method === 'mean') {
    const s = f.reduce((a, b) => a + b, 0);
    return { w, f, s, v: s / f.length };
  }

  // 2. Median Filter
  if (method === 'median') {
    const s = [...f].sort((a, b) => a - b);
    const n = s.length;
    return {
      w,
      f,
      s,
      v: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
    };
  }

  // 3. Prewitt Filter (Gx, Gy and G = |Gx| + |Gy|)
  const dot = K => f.reduce((a, x, t) => a + x * K[t], 0);
  const gx = dot(Kx);
  const gy = dot(Ky);
  return { w, f, gx, gy, v: Math.abs(gx) + Math.abs(gy) };
}

function err(t) {
  $('#err').textContent = t;
}

// Format list of numbers for equations
const list = (a, sep) =>
  a.length > 25
    ? a.slice(0, 12).map(fmt).join(sep) + sep + '…'
    : a.map(fmt).join(sep);

// ==========================================================================
// Execution & Result Presentation
// ==========================================================================
$('#run').onclick = () => {
  err('');
  const { R, C } = dims;
  const k = kk;
  const vals = raw($('#mat'));

  if (vals.some(v => v === '' || isNaN(+v))) {
    return err('Còn ô ma trận trống hoặc không phải số. Hãy điền đầy đủ các ô trước khi tính.');
  }
  if (k > Math.max(R, C)) {
    return err('Cửa sổ k không được lớn hơn ' + Math.max(R, C) + ' (kích thước lớn nhất của ma trận).');
  }

  const m = [];
  for (let i = 0; i < R; i++) {
    m.push(vals.slice(i * C, (i + 1) * C).map(Number));
  }

  let Kx, Ky;
  if (method === 'prewitt') {
    const a = raw($('#gx')), b = raw($('#gy'));
    if (a.concat(b).some(v => v === '' || isNaN(+v))) {
      return err('Còn ô kernel trống hoặc không phải số.');
    }
    Kx = a.map(Number);
    Ky = b.map(Number);
  }

  ctx = { m, R, C, k, Kx, Ky };
  ctx.cache = m.map((r, i) => r.map((_, j) => calc(i, j)));

  // Output sets config
  const sets =
    method === 'prewitt'
      ? [
          ['Đạo hàm Gx (Phát hiện biên dọc)', 'gx', 'Biên dọc'],
          ['Đạo hàm Gy (Phát hiện biên ngang)', 'gy', 'Biên ngang'],
          ['Độ lớn Gradient tổng hợp G = |Gx| + |Gy|', 'v', 'Tổng hợp G']
        ]
      : [
          [
            method === 'mean' ? 'Ma trận sau khi lọc Mean (Làm mịn)' : 'Ma trận sau khi lọc Median (Trung vị)',
            'v',
            method === 'mean' ? 'Mean' : 'Median'
          ]
        ];

  const box = $('#res');
  box.innerHTML = '';

  sets.forEach(([t, key, badgeText]) => {
    const block = document.createElement('div');
    block.className = 'result-block';

    const header = document.createElement('div');
    header.className = 'result-block-title';
    header.innerHTML = `<span>${t}</span><span class="result-block-badge">${badgeText}</span>`;

    const sc = document.createElement('div');
    sc.className = 'scroll custom-scrollbar';

    const g = document.createElement('div');
    g.className = 'grid' + (method === 'prewitt' && key === 'v' ? ' final' : '');
    g.style.setProperty('--c', C);

    ctx.cache.forEach((row, i) =>
      row.forEach((d, j) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'c';
        c.dataset.row = i;
        c.dataset.col = j;
        c.textContent = fmt(d[key]);
        c.setAttribute('aria-label', `Ô [${i + 1}, ${j + 1}]: ${fmt(d[key])}`);
        c.onclick = () => selectCell(i, j);
        g.appendChild(c);
      })
    );

    sc.appendChild(g);
    block.append(header, sc);
    box.appendChild(block);
  });

  $('#detail').hidden = true;
  $('#out').hidden = false;

  // Auto select center cell for quick immediate preview
  const centerR = Math.floor(R / 2);
  const centerC = Math.floor(C / 2);
  selectCell(centerR, centerC);

  $('#out').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ==========================================================================
// Select Cell & Step-by-Step Inspector
// ==========================================================================
function selectCell(i, j) {
  activeCoord = { i, j };

  // Highlight all cells corresponding to this (i, j) across all result grids
  $$('#res button.c').forEach(btn => {
    const r = +btn.dataset.row;
    const c = +btn.dataset.col;
    if (r === i && c === j) {
      btn.classList.add('active-cell');
    } else {
      btn.classList.remove('active-cell');
    }
  });

  renderDetail(i, j);
}

function renderDetail(i, j) {
  const { k, R, C, m } = ctx;
  const p = k >> 1;
  const d = ctx.cache[i][j];

  let h = `
    <div class="calc-header">
      <div class="calc-coord-badge">
        <span>📍 Tọa độ ô: (${i + 1}, ${j + 1})</span>
      </div>
      <div class="card-status-pill">
        Giá trị gốc ban đầu: <b>${fmt(m[i][j])}</b>
      </div>
    </div>
    
    <div class="calc-window-container">
      <div class="calc-window-title">Cửa sổ lân cận kích thước ${k}×${k} (ô viền đứt là padding 0 ngoài biên):</div>
      <div class="scroll custom-scrollbar">
        <div class="grid" style="--c:${k}">
  `;

  d.w.forEach((row, a) =>
    row.forEach((x, b) => {
      const y = i - p + a;
      const z = j - p + b;
      const out = y < 0 || z < 0 || y >= R || z >= C;
      const isCenter = a === p && b === p;
      h += `<div class="c${out ? ' pad' : ''}${isCenter ? ' mid' : ''}" title="${out ? 'Điểm ngoài biên (Padding 0)' : isCenter ? 'Tâm cửa sổ' : `M(${y + 1},${z + 1})`}">${fmt(x)}</div>`;
    })
  );

  h += `
        </div>
      </div>
    </div>
  `;

  // Step explanation based on method
  if (method === 'mean') {
    h += `
      <div class="calc-step-row">
        <b>1. Tổng các phần tử trong cửa sổ:</b><br>
        S = ${list(d.f, ' + ')} = <b>${fmt(d.s)}</b>
      </div>
      <div class="calc-step-row">
        <b>2. Giá trị trung bình (Mean):</b><br>
        Mean = S / ${d.f.length} = ${fmt(d.s)} / ${d.f.length} = <b>${fmt(d.v)}</b>
      </div>
      <div style="text-align:right;">
        <span class="calc-final-pill">Kết quả Mean = ${fmt(d.v)}</span>
      </div>
    `;
  } else if (method === 'median') {
    const n = d.s.length;
    const isOdd = n % 2 === 1;
    h += `
      <div class="calc-step-row">
        <b>1. Sắp xếp các phần tử tăng dần:</b><br>
        [ ${list(d.s, ', ')} ]
      </div>
      <div class="calc-step-row">
        <b>2. Xác định phần tử trung vị:</b><br>
        ${
          isOdd
            ? `Tổng số phần tử n = ${n} (lẻ) ➔ Chọn phần tử chính giữa ở vị trí ${(n + 1) / 2} là: <b>${fmt(d.v)}</b>`
            : `Tổng số phần tử n = ${n} (chẵn) ➔ Trung bình cộng 2 phần tử ở vị trí ${n / 2} và ${n / 2 + 1} là: <b>${fmt(d.v)}</b>`
        }
      </div>
      <div style="text-align:right;">
        <span class="calc-final-pill">Kết quả Median = ${fmt(d.v)}</span>
      </div>
    `;
  } else {
    // Prewitt
    h += `
      <div class="calc-step-row">
        <b>1. Đạo hàm theo hướng dọc Gx:</b><br>
        Gx = Nhân vô hướng cửa sổ với Kernel Gx = <b>${fmt(d.gx)}</b>
      </div>
      <div class="calc-step-row">
        <b>2. Đạo hàm theo hướng ngang Gy:</b><br>
        Gy = Nhân vô hướng cửa sổ với Kernel Gy = <b>${fmt(d.gy)}</b>
      </div>
      <div class="calc-step-row">
        <b>3. Độ lớn Gradient tổng hợp:</b><br>
        G = |Gx| + |Gy| = |${fmt(d.gx)}| + |${fmt(d.gy)}| = <b>${fmt(d.v)}</b>
      </div>
      <div style="text-align:right;">
        <span class="calc-final-pill">Biên độ G = ${fmt(d.v)}</span>
      </div>
    `;
  }

  const el = $('#detail');
  el.innerHTML = h;
  el.hidden = false;
}

// Initial initialization
build($('#mat'), 5, 5, (i, j) => SAMPLE[i][j]);
buildKers();
note();
