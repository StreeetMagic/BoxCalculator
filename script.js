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

const ISO_ORIGIN_X = 160;
const ISO_ORIGIN_Y = 170;
const ISO_MAX_SIZE = 120;
const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = Math.sin(Math.PI / 6);
const mmFormatter = new Intl.NumberFormat('ru-RU');

const isoElements = {
  container: document.querySelector('.iso-container'),
  svg: document.getElementById('isoScene'),
  hint: document.getElementById('isoHint'),
  productTop: document.getElementById('productTop'),
  productSide: document.getElementById('productSide'),
  productFront: document.getElementById('productFront'),
  productEdges: document.getElementById('productEdges'),
  boxEdges: document.getElementById('boxEdges'),
  lengthLine: document.getElementById('lengthDim'),
  widthLine: document.getElementById('widthDim'),
  heightLine: document.getElementById('heightDim'),
  lengthLabel: document.getElementById('lengthLabel'),
  widthLabel: document.getElementById('widthLabel'),
  heightLabel: document.getElementById('heightLabel'),
};

const PRODUCT_EDGE_PAIRS = [
  [0, 1],
  [1, 2],
  [2, 6],
  [6, 7],
  [7, 4],
  [4, 0],
  [1, 5],
  [5, 6],
  [4, 5],
  [0, 4],
];

const BOX_EDGE_PAIRS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
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
    updateIllustration(null);
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    updateIllustration(null);
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    updateIllustration(null);
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

  const productDims = { L: sourceLength, W: sourceWidth, H: sourceHeight };
  const requiredDims = { L: neededLength, W: neededWidth, H: neededHeight };
  const boxDims = best ? { L: Math.max(best.L, best.W), W: Math.min(best.L, best.W), H: neededHeight } : null;

  updateIllustration({
    product: productDims,
    required: requiredDims,
    box: boxDims,
  });

  if (!best) {
    const outLengthMin = Math.max(neededLength, neededWidth);
    const outWidthMin = Math.min(neededLength, neededWidth);
    showOut(`Подходящая коробка не найдена.\nМинимум по расчёту: ${outLengthMin} x ${outWidthMin} x ${neededHeight} мм (Д x Ш x В).`, 'error');
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);
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

function updateIllustration(state) {
  if (!isoElements.container || !isoElements.svg) {
    return;
  }

  if (!state) {
    isoElements.container.classList.add('is-empty');
    clearIllustration();
    return;
  }

  isoElements.container.classList.remove('is-empty');

  const product = normalizeDimensions(state.product);
  const outer = normalizeDimensions(state.box || state.required);

  const maxSide = Math.max(product.L, product.W, product.H, outer.L, outer.W, outer.H);
  const scale = maxSide > 0 ? ISO_MAX_SIZE / maxSide : 1;

  const productGeometry = projectPrism(product, scale);
  const outerGeometry = projectPrism(outer, scale);

  setPolygonPoints(isoElements.productTop, [4, 5, 6, 7], productGeometry.points);
  setPolygonPoints(isoElements.productSide, [5, 6, 2, 1], productGeometry.points);
  setPolygonPoints(isoElements.productFront, [4, 5, 1, 0], productGeometry.points);

  setPathData(isoElements.productEdges, productGeometry.points, PRODUCT_EDGE_PAIRS);
  setPathData(isoElements.boxEdges, outerGeometry.points, BOX_EDGE_PAIRS);

  const outerLabel = state.box ? 'коробки' : 'мин. коробки';

  setDimensionLine(
    isoElements.lengthLine,
    isoElements.lengthLabel,
    outerGeometry.points[0],
    outerGeometry.points[1],
    outerGeometry.center,
    [
      `Д изделия: ${formatMillimeters(product.L)}`,
      `Д ${outerLabel}: ${formatMillimeters(outer.L)}`,
    ],
  );

  setDimensionLine(
    isoElements.widthLine,
    isoElements.widthLabel,
    outerGeometry.points[1],
    outerGeometry.points[2],
    outerGeometry.center,
    [
      `Ш изделия: ${formatMillimeters(product.W)}`,
      `Ш ${outerLabel}: ${formatMillimeters(outer.W)}`,
    ],
  );

  setDimensionLine(
    isoElements.heightLine,
    isoElements.heightLabel,
    outerGeometry.points[1],
    outerGeometry.points[5],
    outerGeometry.center,
    [
      `В изделия: ${formatMillimeters(product.H)}`,
      `В ${outerLabel}: ${formatMillimeters(outer.H)}`,
    ],
  );
}

function clearIllustration() {
  if (!isoElements.productEdges) {
    return;
  }

  setPolygonPoints(isoElements.productTop, [], []);
  setPolygonPoints(isoElements.productSide, [], []);
  setPolygonPoints(isoElements.productFront, [], []);
  if (isoElements.productEdges) {
    isoElements.productEdges.setAttribute('d', '');
  }
  if (isoElements.boxEdges) {
    isoElements.boxEdges.setAttribute('d', '');
  }
  resetLine(isoElements.lengthLine);
  resetLine(isoElements.widthLine);
  resetLine(isoElements.heightLine);
  clearLabel(isoElements.lengthLabel);
  clearLabel(isoElements.widthLabel);
  clearLabel(isoElements.heightLabel);
}

function resetLine(line) {
  if (!line) return;
  line.setAttribute('x1', '0');
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0');
  line.setAttribute('y2', '0');
}

function clearLabel(label) {
  if (!label) return;
  label.textContent = '';
}

function normalizeDimensions(dimensions) {
  const length = Math.max(dimensions.L, dimensions.W);
  const width = Math.min(dimensions.L, dimensions.W);
  return { L: length, W: width, H: dimensions.H };
}

function projectPrism(dimensions, scale) {
  const length = dimensions.L * scale;
  const width = dimensions.W * scale;
  const height = dimensions.H * scale;

  const points = [
    projectPoint(0, 0, 0),
    projectPoint(length, 0, 0),
    projectPoint(length, width, 0),
    projectPoint(0, width, 0),
    projectPoint(0, 0, height),
    projectPoint(length, 0, height),
    projectPoint(length, width, height),
    projectPoint(0, width, height),
  ];

  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= points.length;
  center.y /= points.length;

  return { points, center };
}

function projectPoint(x, y, z) {
  return {
    x: ISO_ORIGIN_X + (x - y) * ISO_COS,
    y: ISO_ORIGIN_Y + (x + y) * ISO_SIN - z,
  };
}

function setPolygonPoints(element, indices, points) {
  if (!element) return;
  if (!indices.length) {
    element.setAttribute('points', '');
    return;
  }
  const coordinates = indices.map((index) => formatPoint(points[index])).join(' ');
  element.setAttribute('points', coordinates);
}

function formatPoint(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function setPathData(element, points, pairs) {
  if (!element) return;
  const segments = pairs
    .map(([start, end]) => `M ${formatCoord(points[start])} L ${formatCoord(points[end])}`)
    .join(' ');
  element.setAttribute('d', segments);
}

function formatCoord(point) {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function setDimensionLine(lineElement, textElement, start, end, center, lines) {
  if (!lineElement || !textElement) {
    return;
  }

  const offset = offsetEdge(start, end, center, 18);

  lineElement.setAttribute('x1', offset.start.x.toFixed(2));
  lineElement.setAttribute('y1', offset.start.y.toFixed(2));
  lineElement.setAttribute('x2', offset.end.x.toFixed(2));
  lineElement.setAttribute('y2', offset.end.y.toFixed(2));

  const labelPosition = {
    x: offset.midpoint.x + offset.normal.x * 16,
    y: offset.midpoint.y + offset.normal.y * 16,
  };

  setLabelLines(textElement, labelPosition, lines);
}

function offsetEdge(start, end, center, distance) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const toCenter = {
    x: center.x - midpoint.x,
    y: center.y - midpoint.y,
  };
  const direction = nx * toCenter.x + ny * toCenter.y > 0 ? -1 : 1;
  const offsetX = nx * distance * direction;
  const offsetY = ny * distance * direction;

  return {
    start: { x: start.x + offsetX, y: start.y + offsetY },
    end: { x: end.x + offsetX, y: end.y + offsetY },
    midpoint: { x: midpoint.x + offsetX, y: midpoint.y + offsetY },
    normal: { x: nx * direction, y: ny * direction },
  };
}

function setLabelLines(textElement, position, lines) {
  const x = position.x.toFixed(2);
  const y = position.y.toFixed(2);
  textElement.setAttribute('x', x);
  textElement.setAttribute('y', y);

  const tspans = lines.map((line, index) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.textContent = line;
    tspan.setAttribute('x', x);
    tspan.setAttribute('dy', index === 0 ? '0' : '1.25em');
    return tspan;
  });

  textElement.replaceChildren(...tspans);
}

function formatMillimeters(value) {
  return `${mmFormatter.format(Math.round(value))} мм`;
}
