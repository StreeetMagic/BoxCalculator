const ADD_EACH_SIDE = 100;
const ADD_HEIGHT = 225;
const MAX_HEIGHT = 2450;

const BOXES = [
  { L: 1250, W: 850 },
  { L: 1800, W: 850 },
  { L: 1800, W: 1225 },
  { L: 1800, W: 1600 },
  { L: 2350, W: 850 },
  { L: 2350, W: 1225 },
  { L: 2350, W: 1650 },
  { L: 2350, W: 1950 },
];

const numberFormatter = new Intl.NumberFormat('ru-RU');

const EDGE_SEGMENTS = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const INNER_MUTED_SEGMENTS = new Set(['0-3', '2-3', '2-6', '3-7', '6-7']);

const ISO = {
  SCALE: 0.12,
  COS: Math.cos(Math.PI / 6),
  SIN: Math.sin(Math.PI / 6),
  MARGIN: 28,
};

const DEFAULT_VIEWBOX = '0 0 360 260';

(function renderBoxTable() {
  const tbody = document.querySelector('#boxTable tbody');
  tbody.innerHTML = '';
  BOXES.forEach((box, index) => {
    const tr = document.createElement('tr');
    const length = Math.max(box.L, box.W);
    const width = Math.min(box.L, box.W);
    tr.innerHTML = `<td>${index + 1}</td><td>${length}</td><td>${width}</td>`;
    tbody.appendChild(tr);
  });
})();

const form = document.getElementById('f');
const output = document.getElementById('out');
const inputs = Array.from(form.querySelectorAll('input'));
const vizFrame = document.getElementById('vizFrame');
const isoScene = document.getElementById('isoScene');
const vizStatus = document.getElementById('vizStatus');

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите размеры для расчёта.');
    updateVisualization({ state: 'empty', message: 'Визуализация появится после ввода размеров.' });
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    updateVisualization({ state: 'empty', message: 'Введите корректные значения для построения схемы.' });
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    updateVisualization({ state: 'empty', message: `Для визуализации уменьшите высоту до ${MAX_HEIGHT} мм или ниже.` });
    return;
  }

  let best = null;
  for (const box of BOXES) {
    if (fits(box, neededLength, neededWidth)) {
      if (!best || area(box) < area(best) || (area(box) === area(best) && (box.L + box.W) < (best.L + best.W))) {
        best = box;
      }
    }
  }

  const itemDims = sortDimensions(sourceLength, sourceWidth);
  const item = { length: itemDims.length, width: itemDims.width, height: sourceHeight };

  if (!best) {
    const minimum = sortDimensions(neededLength, neededWidth);
    showOut(`Подходящая коробка не найдена.\nМинимум по расчёту: ${minimum.length} x ${minimum.width} x ${neededHeight} мм (Д x Ш x В).`, 'error');
    updateVisualization({
      state: 'ready',
      outer: { length: minimum.length, width: minimum.width, height: neededHeight, label: 'Минимально необходимое пространство' },
      item,
      message: 'Нет подходящей коробки — показаны минимальные габариты с учётом технологических допусков.',
    });
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);

  updateVisualization({
    state: 'ready',
    outer: { length: outLength, width: outWidth, height: neededHeight, label: 'Подходящая коробка' },
    item,
    message: 'Коробка отображена пунктиром, изделие — сплошными линиями.',
  });
}

function isPositiveInteger(value) {
  return Number.isFinite(value) && value > 0;
}

function showOut(text, variant = 'default') {
  output.textContent = text;
  output.style.color = variant === 'error' ? 'var(--danger)' : 'var(--text-primary)';
}

function area(box) {
  return box.L * box.W;
}

function fits(box, length, width) {
  return (box.L >= length && box.W >= width) || (box.L >= width && box.W >= length);
}

function roundUpTo(value, step) {
  if (step <= 0) step = 10;
  if (value <= 0) return step;
  const remainder = value % step;
  return remainder === 0 ? value : value + (step - remainder);
}

function sortDimensions(length, width) {
  return {
    length: Math.max(length, width),
    width: Math.min(length, width),
  };
}

function updateVisualization(config) {
  if (!vizFrame || !isoScene || !vizStatus) {
    return;
  }

  if (!config || config.state === 'empty') {
    vizFrame.dataset.hasContent = 'false';
    isoScene.innerHTML = '';
    isoScene.setAttribute('viewBox', DEFAULT_VIEWBOX);
    vizStatus.textContent = config && config.message ? config.message : 'Визуализация появится после ввода размеров.';
    return;
  }

  const { outer, item, message } = config;

  if (!outer || !item) {
    vizFrame.dataset.hasContent = 'false';
    isoScene.innerHTML = '';
    isoScene.setAttribute('viewBox', DEFAULT_VIEWBOX);
    vizStatus.textContent = 'Недостаточно данных для построения схемы.';
    return;
  }

  const outerPoints = buildBoxPoints(outer);
  const innerPoints = buildBoxPoints(item);
  const bounds = computeBounds([...outerPoints, ...innerPoints]);
  const viewWidth = bounds.width + ISO.MARGIN * 2;
  const viewHeight = bounds.height + ISO.MARGIN * 2;

  isoScene.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);

  const outerShifted = outerPoints.map((point) => shiftPoint(point, bounds));
  const innerShifted = innerPoints.map((point) => shiftPoint(point, bounds));

  const solids = [
    polygonElement('solid solid--top', innerShifted, [4, 5, 6, 7]),
    polygonElement('solid solid--side', innerShifted, [1, 2, 6, 5]),
    polygonElement('solid solid--front', innerShifted, [0, 1, 5, 4]),
  ].join('');

  const outerEdges = EDGE_SEGMENTS.map(([a, b]) => lineElement('edge edge--outer', outerShifted[a], outerShifted[b])).join('');

  const innerEdges = EDGE_SEGMENTS.map(([a, b]) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    const className = INNER_MUTED_SEGMENTS.has(key) ? 'edge edge--inner edge--muted' : 'edge edge--inner';
    return lineElement(className, innerShifted[a], innerShifted[b]);
  }).join('');

  const outerLengthMid = midpoint(outerShifted[4], outerShifted[5]);
  const outerWidthMid = midpoint(outerShifted[5], outerShifted[6]);
  const outerHeightMid = midpoint(outerShifted[1], outerShifted[5]);

  const innerLengthMid = midpoint(innerShifted[4], innerShifted[5]);
  const innerWidthMid = midpoint(innerShifted[5], innerShifted[6]);
  const innerHeightMid = midpoint(innerShifted[1], innerShifted[5]);

  const unit = '\u202fмм';

  const labels = [
    textElement('dim-label dim-label--outer', outerLengthMid.x, outerLengthMid.y - 12, 'middle', `${formatNumber(outer.length)}${unit}`),
    textElement('dim-label dim-label--outer', outerWidthMid.x - 18, outerWidthMid.y + 16, 'end', `${formatNumber(outer.width)}${unit}`),
    textElement('dim-label dim-label--outer', outerHeightMid.x + 18, outerHeightMid.y + 4, 'start', `${formatNumber(outer.height)}${unit}`),
    textElement('dim-label dim-label--inner', innerLengthMid.x, innerLengthMid.y + 18, 'middle', `${formatNumber(item.length)}${unit}`),
    textElement('dim-label dim-label--inner', innerWidthMid.x - 8, innerWidthMid.y + 10, 'end', `${formatNumber(item.width)}${unit}`),
    textElement('dim-label dim-label--inner', innerHeightMid.x - 12, innerHeightMid.y, 'end', `${formatNumber(item.height)}${unit}`),
  ].join('');

  isoScene.innerHTML = `
    <g class="box box--inner">
      ${solids}
      ${innerEdges}
    </g>
    <g class="box box--outer">
      ${outerEdges}
    </g>
    <g class="dimensions">
      ${labels}
    </g>
  `;

  vizFrame.dataset.hasContent = 'true';
  const baseMessage = message || 'Коробка показана пунктиром, изделие — сплошными линиями.';
  vizStatus.textContent = outer.label ? `${outer.label}. ${baseMessage}` : baseMessage;
}

function buildBoxPoints(dimensions) {
  const { length, width, height } = dimensions;
  return [
    isoProject(0, 0, 0),
    isoProject(length, 0, 0),
    isoProject(length, width, 0),
    isoProject(0, width, 0),
    isoProject(0, 0, height),
    isoProject(length, 0, height),
    isoProject(length, width, height),
    isoProject(0, width, height),
  ];
}

function isoProject(x, y, z) {
  const scaledX = x * ISO.SCALE;
  const scaledY = y * ISO.SCALE;
  const scaledZ = z * ISO.SCALE;
  return {
    x: (scaledX - scaledY) * ISO.COS,
    y: (scaledX + scaledY) * ISO.SIN - scaledZ,
  };
}

function computeBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function shiftPoint(point, bounds) {
  return {
    x: +(point.x - bounds.minX + ISO.MARGIN).toFixed(2),
    y: +(point.y - bounds.minY + ISO.MARGIN).toFixed(2),
  };
}

function polygonElement(className, points, indices) {
  const coords = indices
    .map((index) => `${points[index].x.toFixed(2)},${points[index].y.toFixed(2)}`)
    .join(' ');
  return `<polygon class="${className}" points="${coords}"></polygon>`;
}

function lineElement(className, from, to) {
  return `<line class="${className}" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}"></line>`;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function textElement(className, x, y, anchor, text) {
  return `<text class="${className}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${anchor}">${text}</text>`;
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(value));
}
