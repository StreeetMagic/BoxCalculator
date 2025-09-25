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

const DEG30 = Math.PI / 6;
const COS30 = Math.cos(DEG30);
const SIN30 = Math.sin(DEG30);
const VIEWBOX = { width: 360, height: 260 };
const ILLUSTRATION_MARGIN = 28;
const numberFormatter = new Intl.NumberFormat('ru-RU');

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
const illustrationLayer = document.getElementById('illustrationLayer');
const illustrationTitle = document.getElementById('illustrationTitle');
const illustrationDesc = document.getElementById('illustrationDesc');
const legendProduct = document.getElementById('legendProduct');
const legendAllowance = document.getElementById('legendAllowance');
const legendBox = document.getElementById('legendBox');

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

renderIllustration();
updateLegend();

calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите размеры для расчёта.');
    renderIllustration();
    updateLegend();
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    renderIllustration();
    updateLegend();
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  const productSource = {
    length: sourceLength,
    width: sourceWidth,
    height: sourceHeight,
  };

  const allowanceDims = {
    length: neededLength,
    width: neededWidth,
    height: neededHeight,
  };

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    const oriented = orientForDrawing(allowanceDims, productSource);
    renderIllustration({
      product: oriented.product,
      outer: oriented.outer,
      status: 'height-limit',
      description: `Изделие ${formatDimensionText(productSource)} требует высоту ${formatNumber(neededHeight)} мм с технологическим запасом, что превышает предел ${formatNumber(MAX_HEIGHT)} мм.`,
    });
    updateLegend({
      product: productSource,
      allowance: allowanceDims,
      status: 'height-limit',
    });
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
    const oriented = orientForDrawing(allowanceDims, productSource);
    renderIllustration({
      product: oriented.product,
      outer: oriented.outer,
      status: 'no-box',
      description: `Изделие ${formatDimensionText(productSource)} требует минимум ${formatDimensionText(allowanceDims, { reorder: true })}. Подходящий вариант в каталоге отсутствует.`,
    });
    updateLegend({
      product: productSource,
      allowance: allowanceDims,
      status: 'no-box',
    });
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);

  const fitsAsIs = best.L >= neededLength && best.W >= neededWidth;
  const outerOriented = {
    length: fitsAsIs ? best.L : best.W,
    width: fitsAsIs ? best.W : best.L,
    height: neededHeight,
  };

  const productOriented = fitsAsIs
    ? { ...productSource }
    : { length: productSource.width, width: productSource.length, height: productSource.height };

  const drawingOrientation = orientForDrawing(outerOriented, productOriented);

  renderIllustration({
    product: drawingOrientation.product,
    outer: drawingOrientation.outer,
    status: 'box',
    description: `Изделие ${formatDimensionText(productSource)} размещено в коробке ${formatDimensionText({ length: outLength, width: outWidth, height: neededHeight }, { reorder: true })}.`,
  });

  updateLegend({
    product: productSource,
    allowance: allowanceDims,
    box: { length: outLength, width: outWidth, height: neededHeight },
    status: 'box',
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

function orientForDrawing(outerDims, productDims) {
  const outer = { ...outerDims };
  const product = { ...productDims };

  if (outer.length >= outer.width) {
    return { outer, product };
  }

  return {
    outer: { length: outer.width, width: outer.length, height: outer.height },
    product: { length: product.width, width: product.length, height: product.height },
  };
}

function renderIllustration(state) {
  while (illustrationLayer.firstChild) {
    illustrationLayer.removeChild(illustrationLayer.firstChild);
  }

  illustrationTitle.textContent = 'Схема размещения изделия внутри коробки';

  if (!state) {
    illustrationDesc.textContent = 'Визуализация появится после ввода размеров изделия.';
    const placeholder = createSvgElement('text', {
      x: VIEWBOX.width / 2,
      y: VIEWBOX.height / 2,
      class: 'placeholder',
    });
    placeholder.textContent = 'Введите размеры изделия';
    illustrationLayer.appendChild(placeholder);
    return;
  }

  illustrationDesc.textContent = state.description || 'Схема размещения изделия внутри коробки.';

  const defs = createSvgElement('defs');
  const marker = createSvgElement('marker', {
    id: 'dimArrow',
    viewBox: '0 0 6 6',
    markerWidth: 6,
    markerHeight: 6,
    refX: 3,
    refY: 3,
    orient: 'auto-start-reverse',
    markerUnits: 'strokeWidth',
  });
  marker.appendChild(createSvgElement('path', { d: 'M0,0 L6,3 L0,6 Z', fill: 'currentColor' }));
  defs.appendChild(marker);
  illustrationLayer.appendChild(defs);

  const transform = calculateTransform(state.outer);
  const toScreen = (x, y, z) => {
    const projected = projectIso(x, y, z);
    return {
      x: projected.x * transform.scale + transform.translateX,
      y: projected.y * transform.scale + transform.translateY,
    };
  };

  const outerGroup = createSvgElement('g', { class: 'outer-box' });
  drawBox(outerGroup, state.outer, { x: 0, y: 0, z: 0 }, toScreen);
  illustrationLayer.appendChild(outerGroup);

  const productOffset = {
    x: Math.max((state.outer.length - state.product.length) / 2, 0),
    y: Math.max((state.outer.width - state.product.width) / 2, 0),
    z: 0,
  };

  const innerGroup = createSvgElement('g', { class: 'inner-box' });
  drawBox(innerGroup, state.product, productOffset, toScreen);
  illustrationLayer.appendChild(innerGroup);

  const dimensionsGroup = createSvgElement('g', { class: 'dimensions' });
  const frontLeftBottom = toScreen(0, 0, 0);
  const frontRightBottom = toScreen(state.outer.length, 0, 0);
  const backRightBottom = toScreen(state.outer.length, state.outer.width, 0);
  const frontRightTop = toScreen(state.outer.length, 0, state.outer.height);

  drawDimension(
    dimensionsGroup,
    frontLeftBottom,
    frontRightBottom,
    {
      dy: 34,
      labelDx: -18,
      labelDy: -10,
      labelPosition: 0.3,
      textAnchor: 'start',
    },
    `Длина ${formatNumber(state.outer.length)} мм`,
  );
  drawDimension(
    dimensionsGroup,
    frontRightBottom,
    backRightBottom,
    {
      dx: 40,
      dy: 6,
      labelDx: 10,
      labelDy: -14,
      labelPosition: 0.45,
      textAnchor: 'start',
    },
    `Ширина ${formatNumber(state.outer.width)} мм`,
  );
  drawDimension(
    dimensionsGroup,
    frontRightBottom,
    frontRightTop,
    {
      dx: 34,
      labelDy: 0,
      rotate: -90,
      dominantBaseline: 'middle',
    },
    `Высота ${formatNumber(state.outer.height)} мм`,
  );

  illustrationLayer.appendChild(dimensionsGroup);
}

function updateLegend(info) {
  legendProduct.textContent = '—';
  legendAllowance.textContent = '—';
  legendBox.textContent = '—';
  legendBox.classList.add('muted');

  if (!info) {
    return;
  }

  legendProduct.textContent = formatDimensionText(info.product);
  legendAllowance.textContent = formatDimensionText(info.allowance, { reorder: true });

  if (info.status === 'box' && info.box) {
    legendBox.textContent = formatDimensionText(info.box, { reorder: true });
    legendBox.classList.remove('muted');
  } else if (info.status === 'no-box') {
    legendBox.textContent = 'Нет подходящей коробки';
    legendBox.classList.add('muted');
  } else if (info.status === 'height-limit') {
    legendBox.textContent = 'Превышен лимит по высоте';
    legendBox.classList.add('muted');
  }
}

function drawBox(group, dims, offset, toScreen) {
  const points = getBoxPoints(dims, offset, toScreen);

  const leftFace = createPolygon([points.topBackLeft, points.bottomBackLeft, points.bottomFrontLeft, points.topFrontLeft], 'face face-side face-left');
  const rightFace = createPolygon([points.topFrontRight, points.bottomFrontRight, points.bottomBackRight, points.topBackRight], 'face face-side face-right');
  const topFace = createPolygon([points.topFrontLeft, points.topFrontRight, points.topBackRight, points.topBackLeft], 'face face-top');

  group.appendChild(leftFace);
  group.appendChild(rightFace);
  group.appendChild(topFace);
}

function getBoxPoints(dims, offset, toScreen) {
  const x0 = offset.x;
  const y0 = offset.y;
  const z0 = offset.z;
  const x1 = offset.x + dims.length;
  const y1 = offset.y + dims.width;
  const z1 = offset.z + dims.height;

  return {
    bottomFrontLeft: toScreen(x0, y0, z0),
    bottomFrontRight: toScreen(x1, y0, z0),
    bottomBackRight: toScreen(x1, y1, z0),
    bottomBackLeft: toScreen(x0, y1, z0),
    topFrontLeft: toScreen(x0, y0, z1),
    topFrontRight: toScreen(x1, y0, z1),
    topBackRight: toScreen(x1, y1, z1),
    topBackLeft: toScreen(x0, y1, z1),
  };
}

function drawDimension(group, start, end, options, label) {
  const {
    dx = 0,
    dy = 0,
    labelDx = 0,
    labelDy = -8,
    labelPosition = 0.5,
    textAnchor = 'middle',
    dominantBaseline = 'middle',
    rotate = 0,
  } = options || {};

  const x1 = start.x + dx;
  const y1 = start.y + dy;
  const x2 = end.x + dx;
  const y2 = end.y + dy;

  const line = createSvgElement('line', {
    x1: x1.toFixed(2),
    y1: y1.toFixed(2),
    x2: x2.toFixed(2),
    y2: y2.toFixed(2),
    class: 'dimension-line',
    'marker-start': 'url(#dimArrow)',
    'marker-end': 'url(#dimArrow)',
  });

  const lx = start.x + (end.x - start.x) * labelPosition + dx + labelDx;
  const ly = start.y + (end.y - start.y) * labelPosition + dy + labelDy;
  const text = createSvgElement('text', {
    x: lx.toFixed(2),
    y: ly.toFixed(2),
    class: 'dimension-label',
    'text-anchor': textAnchor,
    'dominant-baseline': dominantBaseline,
  });
  if (rotate) {
    text.setAttribute('transform', `rotate(${rotate} ${lx.toFixed(2)} ${ly.toFixed(2)})`);
  }
  text.textContent = label;

  group.appendChild(line);
  group.appendChild(text);
}

function calculateTransform(dims) {
  const corners = [
    projectIso(0, 0, 0),
    projectIso(dims.length, 0, 0),
    projectIso(dims.length, dims.width, 0),
    projectIso(0, dims.width, 0),
    projectIso(0, 0, dims.height),
    projectIso(dims.length, 0, dims.height),
    projectIso(dims.length, dims.width, dims.height),
    projectIso(0, dims.width, dims.height),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of corners) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const availableWidth = VIEWBOX.width - ILLUSTRATION_MARGIN * 2;
  const availableHeight = VIEWBOX.height - ILLUSTRATION_MARGIN * 2;
  const scale = Math.min(availableWidth / width, availableHeight / height);

  const translateX = (VIEWBOX.width - width * scale) / 2 - minX * scale;
  const translateY = (VIEWBOX.height - height * scale) / 2 - minY * scale;

  return { scale, translateX, translateY };
}

function projectIso(x, y, z) {
  return {
    x: (x - y) * COS30,
    y: (x + y) * SIN30 - z,
  };
}

function formatDimensionText(dims, { reorder = false } = {}) {
  if (!dims) return '—';
  let { length, width, height } = dims;
  if (reorder && length < width) {
    [length, width] = [width, length];
  }
  return `${formatNumber(length)} × ${formatNumber(width)} × ${formatNumber(height)} мм`;
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(value));
}

function createPolygon(points, className) {
  const polygon = createSvgElement('polygon', {
    points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  });
  if (className) {
    polygon.setAttribute('class', className);
  }
  return polygon;
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}
