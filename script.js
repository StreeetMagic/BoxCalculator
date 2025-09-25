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

const COS_30 = Math.cos(Math.PI / 6);
const SIN_30 = Math.sin(Math.PI / 6);

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
const drawing = document.getElementById('drawing');

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

updateDrawing(null);
calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите размеры для расчёта.');
    updateDrawing(null);
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    updateDrawing(null);
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    updateDrawing(null);
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

  if (!best) {
    const outLengthMin = Math.max(neededLength, neededWidth);
    const outWidthMin = Math.min(neededLength, neededWidth);
    showOut(`Подходящая коробка не найдена.\nМинимум по расчёту: ${outLengthMin} x ${outWidthMin} x ${neededHeight} мм (Д x Ш x В).`, 'error');
    updateDrawing({
      label: 'Требуемый минимум',
      boxLength: outLengthMin,
      boxWidth: outWidthMin,
      boxHeight: neededHeight,
      itemLength: sourceLength,
      itemWidth: sourceWidth,
      itemHeight: sourceHeight,
    });
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);
  updateDrawing({
    label: 'Подходящая коробка',
    boxLength: outLength,
    boxWidth: outWidth,
    boxHeight: neededHeight,
    itemLength: sourceLength,
    itemWidth: sourceWidth,
    itemHeight: sourceHeight,
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

function updateDrawing(data) {
  if (!drawing) return;

  if (!data) {
    drawing.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#1fce7a" />
        </marker>
      </defs>
      <text x="50%" y="48%" text-anchor="middle">Нет данных</text>
      <text class="label-muted" x="50%" y="58%" text-anchor="middle">Введите размеры для построения схемы</text>
    `;
    return;
  }

  const {
    label = 'Подходящая коробка',
    boxLength,
    boxWidth,
    boxHeight,
    itemLength,
    itemWidth,
    itemHeight,
  } = data;

  const viewWidth = 480;
  const viewHeight = 360;
  const padding = 42;

  const clearance = ADD_EACH_SIDE / 2;
  const offsetX = clamp(clearance, 0, Math.max((boxLength - itemLength) / 2, 0));
  const offsetY = clamp(clearance, 0, Math.max((boxWidth - itemWidth) / 2, 0));

  const boxIso = createIsoBox(boxLength, boxWidth, boxHeight, 0, 0, 0);
  const productIso = createIsoBox(
    Math.min(itemLength, boxLength),
    Math.min(itemWidth, boxWidth),
    Math.min(itemHeight, boxHeight),
    offsetX,
    offsetY,
    0,
  );

  const allPoints = [...Object.values(boxIso), ...Object.values(productIso)];

  const bounds = allPoints.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  const scale = Math.min((viewWidth - padding * 2) / spanX, (viewHeight - padding * 2) / spanY);

  const project = (point) => ({
    x: (point.x - bounds.minX) * scale + padding,
    y: (point.y - bounds.minY) * scale + padding,
  });

  const box2d = projectCorners(boxIso, project);
  const product2d = projectCorners(productIso, project);

  const edges = [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['D', 'A'],
    ['E', 'F'],
    ['F', 'G'],
    ['G', 'H'],
    ['H', 'E'],
    ['A', 'E'],
    ['B', 'F'],
    ['C', 'G'],
    ['D', 'H'],
  ];

  const hiddenVertices = new Set(['D', 'H']);
  const visibleEdges = edges.filter(([from, to]) => !hiddenVertices.has(from) && !hiddenVertices.has(to));
  const hiddenEdges = edges.filter(([from, to]) => hiddenVertices.has(from) || hiddenVertices.has(to));

  const edgePath = (from, to) => linePath(box2d[from], box2d[to]);

  const visibleEdgePaths = visibleEdges
    .map(([from, to]) => `<path class="edge" d="${edgePath(from, to)}" />`)
    .join('');

  const hiddenEdgePaths = hiddenEdges
    .map(([from, to]) => `<path class="edge edge--hidden" d="${edgePath(from, to)}" />`)
    .join('');

  const productSegments = [
    ['A', 'B', 'C', 'D', 'A'],
    ['E', 'F', 'G', 'H', 'E'],
    ['A', 'E'],
    ['B', 'F'],
    ['C', 'G'],
    ['D', 'H'],
  ];

  const productPath = productSegments
    .map((segment) => polylinePath(segment.map((key) => product2d[key])))
    .join(' ');

  const gridLines = buildGrid(viewWidth, viewHeight, 32);

  const lengthLine = dimensionLine(box2d.A, box2d.B, box2d.A, box2d.D, -28);
  const widthLine = dimensionLine(box2d.A, box2d.D, box2d.A, box2d.B, 32);
  const heightLine = dimensionLine(box2d.B, box2d.F, box2d.A, box2d.B, 32, box2d.A, box2d.D, -12);

  drawing.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#1fce7a" />
      </marker>
    </defs>
    <g opacity="0.85">${gridLines}</g>
    ${visibleEdgePaths}
    ${hiddenEdgePaths}
    <path class="product" d="${productPath}" />
    ${renderDimension(lengthLine, `Д ${boxLength} мм`)}
    ${renderDimension(widthLine, `Ш ${boxWidth} мм`)}
    ${renderDimension(heightLine, `В ${boxHeight} мм`)}
    <text x="28" y="36">${label}</text>
    <text class="label-muted" x="28" y="58">Изделие: ${itemLength}×${itemWidth}×${itemHeight} мм</text>
  `;
}

function createIsoBox(length, width, height, offsetX, offsetY, offsetZ) {
  const corners = {
    A: isoPoint(offsetX, offsetY, offsetZ),
    B: isoPoint(offsetX + length, offsetY, offsetZ),
    C: isoPoint(offsetX + length, offsetY + width, offsetZ),
    D: isoPoint(offsetX, offsetY + width, offsetZ),
    E: isoPoint(offsetX, offsetY, offsetZ + height),
    F: isoPoint(offsetX + length, offsetY, offsetZ + height),
    G: isoPoint(offsetX + length, offsetY + width, offsetZ + height),
    H: isoPoint(offsetX, offsetY + width, offsetZ + height),
  };
  return corners;
}

function isoPoint(x, y, z) {
  return {
    x: (x - y) * COS_30,
    y: -z + (x + y) * SIN_30,
  };
}

function projectCorners(corners, project) {
  return Object.fromEntries(Object.entries(corners).map(([key, value]) => [key, project(value)]));
}

function linePath(from, to) {
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function polylinePath(points) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function buildGrid(width, height, step) {
  const lines = [];
  for (let x = -width; x <= width * 2; x += step) {
    lines.push(`<path class="grid" d="M ${x} 0 L ${x + height} ${height}" />`);
  }
  for (let x = -width; x <= width * 2; x += step) {
    lines.push(`<path class="grid" d="M ${x} ${height} L ${x + height} 0" />`);
  }
  return lines.join('');
}

function dimensionLine(start, end, offsetSourceA, offsetSourceB, distance, extraSourceC = null, extraSourceD = null, extraDistance = 0) {
  const offsetAxis = normalize(subtract(offsetSourceB, offsetSourceA));
  const offsetVector = scale(offsetAxis, distance);
  let lineStart = add(start, offsetVector);
  let lineEnd = add(end, offsetVector);

  if (extraSourceC && extraSourceD && extraDistance !== 0) {
    const extraAxis = normalize(subtract(extraSourceD, extraSourceC));
    const extraVector = scale(extraAxis, extraDistance);
    lineStart = add(lineStart, extraVector);
    lineEnd = add(lineEnd, extraVector);
  }

  const mid = midpoint(lineStart, lineEnd);
  const labelOffset = scale(offsetAxis, distance > 0 ? 16 : -16);
  const textPos = add(mid, labelOffset);

  const extensions = [
    [start, lineStart],
    [end, lineEnd],
  ];

  return { lineStart, lineEnd, textPos, extensions };
}

function renderDimension(dimension, label) {
  const { lineStart, lineEnd, textPos, extensions } = dimension;
  const path = linePath(lineStart, lineEnd);
  return `
    <path class="dim-line" d="${path}" />
    ${extensions
      .map(([from, to]) => `<path class="dim-extension" d="${linePath(from, to)}" />`)
      .join('')}
    <text text-anchor="middle" x="${textPos.x.toFixed(1)}" y="${textPos.y.toFixed(1)}">${label}</text>
  `;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(vector, value) {
  return { x: vector.x * value, y: vector.y * value };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
