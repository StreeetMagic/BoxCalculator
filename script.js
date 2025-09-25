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

const illustration = document.getElementById('boxIllustration');
const illustrationParts = illustration
  ? {
      outer: illustration.querySelector('[data-role="outer"]'),
      inner: illustration.querySelector('[data-role="inner"]'),
      dimensions: illustration.querySelector('[data-role="dimensions"]'),
      hint: illustration.querySelector('#illustrationHint'),
    }
  : null;

const SVG_NS = 'http://www.w3.org/2000/svg';
const ISO_VIEWBOX = { width: 320, height: 240 };
const ISO_PADDING = 22;

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
    resetIllustration();
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    resetIllustration('Недостаточно данных для иллюстрации.');
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    resetIllustration('Высота превышает допустимое значение.');
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
    resetIllustration('Нет подходящей коробки для визуализации.');
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);

  renderIllustration({
    sourceLength,
    sourceWidth,
    sourceHeight,
    neededLength,
    neededWidth,
    neededHeight,
    box: best,
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

function resetIllustration(message = 'Введите размеры, чтобы увидеть схему.') {
  if (!illustrationParts) return;
  illustrationParts.outer.innerHTML = '';
  illustrationParts.inner.innerHTML = '';
  illustrationParts.dimensions.innerHTML = '';
  if (illustrationParts.hint) {
    illustrationParts.hint.textContent = message;
    illustrationParts.hint.setAttribute('opacity', '1');
  }
}

function renderIllustration(params) {
  if (!illustrationParts) return;

  const {
    sourceLength,
    sourceWidth,
    sourceHeight,
    neededLength,
    neededWidth,
    neededHeight,
    box,
  } = params;

  const directFits = box.L >= neededLength && box.W >= neededWidth;
  const outerLength = directFits ? box.L : box.W;
  const outerWidth = directFits ? box.W : box.L;

  const itemLength = directFits ? sourceLength : sourceWidth;
  const itemWidth = directFits ? sourceWidth : sourceLength;
  const itemHeight = sourceHeight;

  const offsetX = Math.max((outerLength - itemLength) / 2, 0);
  const offsetY = Math.max((outerWidth - itemWidth) / 2, 0);

  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);

  const availableWidth = ISO_VIEWBOX.width - ISO_PADDING * 2;
  const availableHeight = ISO_VIEWBOX.height - ISO_PADDING * 2;

  const projectedHorizontal = (outerLength + outerWidth) * cos30;
  const projectedVertical = neededHeight + (outerLength + outerWidth) * sin30;

  const scale = Math.min(
    availableWidth / (projectedHorizontal || 1),
    availableHeight / (projectedVertical || 1)
  );

  const project = (x, y, z) => ({
    x: (x - y) * cos30 * scale,
    y: (x + y) * sin30 * scale - z * scale,
  });

  const outerPoints = buildBoxPoints(outerLength, outerWidth, neededHeight, project);
  const innerPoints = buildBoxPoints(
    Math.max(itemLength, 0),
    Math.max(itemWidth, 0),
    Math.max(itemHeight, 0),
    project,
    offsetX,
    offsetY,
    0
  );

  const bounds = outerPoints.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  const translateX = (ISO_VIEWBOX.width - (bounds.maxX - bounds.minX)) / 2 - bounds.minX;
  const translateY = (ISO_VIEWBOX.height - (bounds.maxY - bounds.minY)) / 2 - bounds.minY;

  const outerTranslated = outerPoints.map((point) => ({
    x: point.x + translateX,
    y: point.y + translateY,
  }));
  const innerTranslated = innerPoints.map((point) => ({
    x: point.x + translateX,
    y: point.y + translateY,
  }));

  illustrationParts.outer.innerHTML = '';
  illustrationParts.inner.innerHTML = '';
  illustrationParts.dimensions.innerHTML = '';

  const outerPath = document.createElementNS(SVG_NS, 'path');
  outerPath.setAttribute('d', buildWireframePath(outerTranslated));
  illustrationParts.outer.appendChild(outerPath);

  const innerPath = document.createElementNS(SVG_NS, 'path');
  innerPath.setAttribute('d', buildWireframePath(innerTranslated));
  illustrationParts.inner.appendChild(innerPath);

  createDimensionAnnotations(outerTranslated, {
    outerLength,
    outerWidth,
    outerHeight: neededHeight,
    itemLength,
    itemWidth,
    itemHeight,
  });

  if (illustrationParts.hint) {
    illustrationParts.hint.textContent = '';
    illustrationParts.hint.setAttribute('opacity', '0');
  }
}

function buildBoxPoints(length, width, height, project, shiftX = 0, shiftY = 0, shiftZ = 0) {
  const vertices = [
    [0, 0, 0],
    [length, 0, 0],
    [length, width, 0],
    [0, width, 0],
    [0, 0, height],
    [length, 0, height],
    [length, width, height],
    [0, width, height],
  ];

  return vertices.map(([x, y, z]) => project(x + shiftX, y + shiftY, z + shiftZ));
}

function buildWireframePath(points) {
  const edges = [
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

  return edges
    .map(([start, end]) =>
      `M${points[start].x.toFixed(1)},${points[start].y.toFixed(1)} L${points[end].x.toFixed(1)},${points[end].y.toFixed(1)}`
    )
    .join(' ');
}

function createDimensionAnnotations(points, sizes) {
  const data = [
    {
      id: 'length',
      label: 'Длина',
      start: 0,
      end: 1,
      preference: ['down'],
      outerValue: sizes.outerLength,
      innerValue: sizes.itemLength,
    },
    {
      id: 'width',
      label: 'Ширина',
      start: 0,
      end: 3,
      preference: ['left'],
      outerValue: sizes.outerWidth,
      innerValue: sizes.itemWidth,
    },
    {
      id: 'height',
      label: 'Высота',
      start: 0,
      end: 4,
      preference: ['left'],
      outerValue: sizes.outerHeight,
      innerValue: sizes.itemHeight,
    },
  ];

  for (const dimension of data) {
    const startPoint = points[dimension.start];
    const endPoint = points[dimension.end];
    const { offset, direction } = getOffsetVector(startPoint, endPoint, dimension.preference, 18);

    const startOffset = addVectors(startPoint, offset);
    const endOffset = addVectors(endPoint, offset);

    const line = document.createElementNS(SVG_NS, 'line');
    line.classList.add('dimension-line');
    line.setAttribute('x1', startOffset.x.toFixed(1));
    line.setAttribute('y1', startOffset.y.toFixed(1));
    line.setAttribute('x2', endOffset.x.toFixed(1));
    line.setAttribute('y2', endOffset.y.toFixed(1));
    illustrationParts.dimensions.appendChild(line);

    const text = document.createElementNS(SVG_NS, 'text');
    text.classList.add('dim-text');
    text.setAttribute('text-anchor', 'middle');

    const midpoint = {
      x: (startOffset.x + endOffset.x) / 2,
      y: (startOffset.y + endOffset.y) / 2,
    };

    const textPosition = addVectors(midpoint, scaleVector(direction, 14));

    const caption = document.createElementNS(SVG_NS, 'tspan');
    caption.textContent = dimension.label;
    caption.setAttribute('x', textPosition.x.toFixed(1));
    caption.setAttribute('y', textPosition.y.toFixed(1));

    const outerLine = document.createElementNS(SVG_NS, 'tspan');
    outerLine.textContent = `Коробка: ${dimension.outerValue} мм`;
    outerLine.setAttribute('x', textPosition.x.toFixed(1));
    outerLine.setAttribute('dy', '12');

    const innerLine = document.createElementNS(SVG_NS, 'tspan');
    innerLine.textContent = `Изделие: ${dimension.innerValue} мм`;
    innerLine.setAttribute('x', textPosition.x.toFixed(1));
    innerLine.setAttribute('dy', '12');

    text.appendChild(caption);
    text.appendChild(outerLine);
    text.appendChild(innerLine);

    illustrationParts.dimensions.appendChild(text);
  }
}

function getOffsetVector(start, end, preference, distance) {
  let vector = {
    x: end.x - start.x,
    y: end.y - start.y,
  };

  let perp = {
    x: vector.y,
    y: -vector.x,
  };

  const length = Math.hypot(perp.x, perp.y) || 1;
  perp = {
    x: perp.x / length,
    y: perp.y / length,
  };

  const oriented = orientPerpendicular(perp, preference);

  return {
    offset: scaleVector(oriented, distance),
    direction: oriented,
  };
}

function orientPerpendicular(perp, preference) {
  const prefs = Array.isArray(preference) ? preference : [preference];
  let oriented = { ...perp };

  for (const pref of prefs) {
    if (pref === 'down' && oriented.y < 0) {
      oriented = invertVector(oriented);
    }
    if (pref === 'up' && oriented.y > 0) {
      oriented = invertVector(oriented);
    }
    if (pref === 'left' && oriented.x > 0) {
      oriented = invertVector(oriented);
    }
    if (pref === 'right' && oriented.x < 0) {
      oriented = invertVector(oriented);
    }
  }

  return oriented;
}

function invertVector(vector) {
  return { x: -vector.x, y: -vector.y };
}

function addVectors(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleVector(vector, value) {
  return { x: vector.x * value, y: vector.y * value };
}
