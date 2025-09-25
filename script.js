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
const drawingSvg = document.getElementById('boxDrawing');
const drawingNote = document.getElementById('drawingNote');
const drawingCaption = document.getElementById('drawingCaption');

const DRAWING_SIZE = { width: 520, height: 420 };

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
    updateDrawing(null);
    return;
  }

  const orientation = determineOrientation(best, neededLength, neededWidth, sourceLength, sourceWidth);

  const boxLength = orientation.boxLength;
  const boxWidth = orientation.boxWidth;
  const productLength = orientation.productLength;
  const productWidth = orientation.productWidth;
  const clearanceLength = Math.max(boxLength - productLength, 0);
  const clearanceWidth = Math.max(boxWidth - productWidth, 0);
  const clearanceHeight = Math.max(neededHeight - sourceHeight, 0);

  showOut(`Подходящая коробка: ${boxLength} x ${boxWidth} x ${neededHeight} мм (Д x Ш x В).`);

  updateDrawing({
    box: { L: boxLength, W: boxWidth, H: neededHeight },
    product: { L: productLength, W: productWidth, H: sourceHeight },
    clearance: { L: clearanceLength, W: clearanceWidth, H: clearanceHeight },
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

function determineOrientation(box, neededLength, neededWidth, sourceLength, sourceWidth) {
  const candidates = [];

  if (box.L >= neededLength && box.W >= neededWidth) {
    candidates.push({
      boxLength: box.L,
      boxWidth: box.W,
      productLength: sourceLength,
      productWidth: sourceWidth,
      clearanceScore: (box.L - neededLength) + (box.W - neededWidth),
    });
  }

  if (box.W >= neededLength && box.L >= neededWidth) {
    candidates.push({
      boxLength: box.W,
      boxWidth: box.L,
      productLength: sourceLength,
      productWidth: sourceWidth,
      clearanceScore: (box.W - neededLength) + (box.L - neededWidth),
    });
  }

  if (candidates.length === 0) {
    const fallbackLength = Math.max(box.L, box.W);
    const fallbackWidth = Math.min(box.L, box.W);
    return {
      boxLength: fallbackLength,
      boxWidth: fallbackWidth,
      productLength: sourceLength,
      productWidth: sourceWidth,
    };
  }

  candidates.sort((a, b) => {
    if (a.clearanceScore !== b.clearanceScore) {
      return a.clearanceScore - b.clearanceScore;
    }
    const aPreference = a.boxLength >= a.boxWidth ? 0 : 1;
    const bPreference = b.boxLength >= b.boxWidth ? 0 : 1;
    if (aPreference !== bPreference) {
      return aPreference - bPreference;
    }
    return a.boxLength - b.boxLength;
  });

  return candidates[0];
}

function roundUpTo(value, step) {
  if (step <= 0) step = 10;
  if (value <= 0) return step;
  const remainder = value % step;
  return remainder === 0 ? value : value + (step - remainder);
}

function setDrawingNote(text) {
  if (drawingNote) drawingNote.textContent = text;
  if (drawingCaption) drawingCaption.textContent = text;
}

function updateDrawing(data) {
  if (!drawingSvg) return;

  if (!data) {
    drawingSvg.innerHTML = '';
    setDrawingNote('Визуализация появится после расчёта.');
    return;
  }

  const { box, product, clearance } = data;
  const cosA = Math.cos(Math.PI / 6);
  const sinA = 0.5;

  const project = (x, y, z) => ({
    x: (x - y) * cosA,
    y: (x + y) * sinA - z,
  });

  const createPrismPoints = (dimensions, offset = { x: 0, y: 0, z: 0 }) => {
    const { L, W, H } = dimensions;
    const { x = 0, y = 0, z = 0 } = offset;
    return [
      project(x, y, z),
      project(x + L, y, z),
      project(x + L, y + W, z),
      project(x, y + W, z),
      project(x, y, z + H),
      project(x + L, y, z + H),
      project(x + L, y + W, z + H),
      project(x, y + W, z + H),
    ];
  };

  const makeDimension = (start, end, { offset = 70, direction = 1, textOffset = 18 } = {}) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = (-dy / length) * direction;
    const normalY = (dx / length) * direction;
    const lineStart = { x: start.x + normalX * offset, y: start.y + normalY * offset };
    const lineEnd = { x: end.x + normalX * offset, y: end.y + normalY * offset };
    const extensionOvershoot = 10;
    const extensionTarget = offset + extensionOvershoot;

    const extensions = [
      {
        start,
        end: { x: start.x + normalX * extensionTarget, y: start.y + normalY * extensionTarget },
      },
      {
        start: end,
        end: { x: end.x + normalX * extensionTarget, y: end.y + normalY * extensionTarget },
      },
    ];

    const textPos = {
      x: (lineStart.x + lineEnd.x) / 2 + normalX * textOffset,
      y: (lineStart.y + lineEnd.y) / 2 + normalY * textOffset,
    };

    return { lineStart, lineEnd, extensions, textPos };
  };

  const boxPoints = createPrismPoints(box);
  const productOffset = {
    x: Math.max((box.L - product.L) / 2, 0),
    y: Math.max((box.W - product.W) / 2, 0),
    z: 0,
  };
  const productPoints = createPrismPoints(product, productOffset);

  const dimensionData = [
    { geometry: makeDimension(boxPoints[0], boxPoints[1], { direction: -1, offset: 75 }), label: `Д ${box.L} мм` },
    { geometry: makeDimension(boxPoints[1], boxPoints[2], { direction: -1, offset: 70 }), label: `Ш ${box.W} мм` },
    { geometry: makeDimension(boxPoints[1], boxPoints[5], { direction: 1, offset: 55 }), label: `В ${box.H} мм` },
  ];

  const annotationBase = {
    x: (productPoints[4].x + productPoints[5].x) / 2,
    y: (productPoints[4].y + productPoints[5].y) / 2 - 24,
  };

  const collectedPoints = [
    ...boxPoints,
    ...productPoints,
    annotationBase,
    ...dimensionData.flatMap((item) => [
      item.geometry.lineStart,
      item.geometry.lineEnd,
      item.geometry.textPos,
      ...item.geometry.extensions.map((ext) => ext.end),
    ]),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  collectedPoints.forEach((point) => {
    if (!point) return;
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    drawingSvg.innerHTML = '';
    setDrawingNote('Визуализация недоступна.');
    return;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 30;
  const scale = Math.min(
    (DRAWING_SIZE.width - padding * 2) / rangeX,
    (DRAWING_SIZE.height - padding * 2) / rangeY,
  );
  const translateX = (DRAWING_SIZE.width - rangeX * scale) / 2 - minX * scale;
  const translateY = (DRAWING_SIZE.height - rangeY * scale) / 2 - minY * scale;

  const transformPoint = (point) => ({
    x: point.x * scale + translateX,
    y: point.y * scale + translateY,
  });

  const defs = `
    <defs>
      <marker id="arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L12,6 L0,12 Z" fill="currentColor"></path>
      </marker>
    </defs>
  `;

  const lineToString = (start, end, className, extra = '') =>
    `<line class="${className}" x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" ${extra}/>`;

  const boxVisibleEdges = [
    [0, 1],
    [1, 2],
    [0, 4],
    [1, 5],
    [2, 6],
    [4, 5],
    [5, 6],
  ];

  const boxHiddenEdges = [
    [2, 3],
    [3, 0],
    [3, 7],
    [7, 4],
    [6, 7],
  ];

  const productVisibleEdges = [
    [0, 1],
    [1, 5],
    [5, 4],
    [4, 0],
    [1, 2],
    [2, 6],
    [6, 5],
    [4, 5],
  ];

  const productHiddenEdges = [
    [0, 3],
    [3, 7],
    [7, 4],
    [2, 3],
    [6, 7],
  ];

  const toLines = (pairs, points, className, extra) =>
    pairs
      .map(([a, b]) => {
        const start = transformPoint(points[a]);
        const end = transformPoint(points[b]);
        return lineToString(start, end, className, extra);
      })
      .join('');

  const dimensionLines = dimensionData
    .map(({ geometry, label }) => {
      const start = transformPoint(geometry.lineStart);
      const end = transformPoint(geometry.lineEnd);
      const extensions = geometry.extensions
        .map((ext) => lineToString(transformPoint(ext.start), transformPoint(ext.end), 'extension-line'))
        .join('');
      const textPosition = transformPoint(geometry.textPos);
      const text = `<text class="dimension-text" text-anchor="middle" dominant-baseline="middle" x="${textPosition.x.toFixed(2)}" y="${textPosition.y.toFixed(2)}">${label}</text>`;
      const line = lineToString(start, end, 'dimension-line', 'marker-start="url(#arrowhead)" marker-end="url(#arrowhead)"');
      return `${extensions}${line}${text}`;
    })
    .join('');

  const annotationPoint = transformPoint(annotationBase);
  const annotationText = `<text class="annotation" text-anchor="middle" dominant-baseline="baseline" x="${annotationPoint.x.toFixed(2)}" y="${annotationPoint.y.toFixed(2)}">ИЗДЕЛИЕ</text>`;

  drawingSvg.innerHTML = [
    defs,
    '<g class="box">',
    toLines(boxHiddenEdges, boxPoints, 'box-edge box-edge-hidden'),
    toLines(boxVisibleEdges, boxPoints, 'box-edge'),
    '</g>',
    '<g class="product">',
    toLines(productHiddenEdges, productPoints, 'product-edge product-edge-hidden'),
    toLines(productVisibleEdges, productPoints, 'product-edge'),
    annotationText,
    '</g>',
    '<g class="dimensions">',
    dimensionLines,
    '</g>',
  ].join('');

  const format = (value) => Math.max(Math.round(value), 0);
  const note = `Коробка ${box.L}×${box.W}×${box.H} мм; изделие ${product.L}×${product.W}×${product.H} мм. Зазор: ΔД ${format(clearance.L)} мм, ΔШ ${format(clearance.W)} мм, ΔВ ${format(clearance.H)} мм.`;
  setDrawingNote(note);
}
