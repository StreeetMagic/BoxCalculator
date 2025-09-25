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
const isoContent = document.getElementById('isoContent');
const isoPlaceholder = document.getElementById('isoPlaceholder');

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

calculate();
updateDrawing(null);

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
      boxLength: outLengthMin,
      boxWidth: outWidthMin,
      boxHeight: neededHeight,
      itemLength: Math.max(sourceLength, sourceWidth),
      itemWidth: Math.min(sourceLength, sourceWidth),
      itemHeight: sourceHeight,
      status: 'required',
    });
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);

  const oriented = orientBox(best, neededLength, neededWidth);

  updateDrawing({
    boxLength: oriented.length,
    boxWidth: oriented.width,
    boxHeight: neededHeight,
    itemLength: oriented.orientation === 'original' ? sourceLength : sourceWidth,
    itemWidth: oriented.orientation === 'original' ? sourceWidth : sourceLength,
    itemHeight: sourceHeight,
    status: 'actual',
  });

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

function orientBox(box, neededLength, neededWidth) {
  if (box.L >= neededLength && box.W >= neededWidth) {
    return { length: box.L, width: box.W, orientation: 'original' };
  }
  if (box.L >= neededWidth && box.W >= neededLength) {
    return { length: box.W, width: box.L, orientation: 'rotated' };
  }
  return { length: box.L, width: box.W, orientation: 'original' };
}

function updateDrawing(data) {
  if (!isoContent || !isoPlaceholder) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  isoContent.innerHTML = '';

  if (!data) {
    isoPlaceholder.textContent = 'Введите размеры для визуализации.';
    isoPlaceholder.style.display = 'block';
    return;
  }

  const {
    boxLength,
    boxWidth,
    boxHeight,
    itemLength,
    itemWidth,
    itemHeight,
    status = 'actual',
  } = data;

  isoPlaceholder.textContent = '';
  isoPlaceholder.style.display = 'none';

  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const viewWidth = 400;
  const viewHeight = 320;
  const margin = 32;

  function projectPoint(point) {
    return {
      x: (point.x - point.y) * cos30,
      y: (point.x + point.y) * sin30 - point.z,
    };
  }

  function generatePoints(length, width, height, offset = { x: 0, y: 0, z: 0 }) {
    const pts = [
      { x: offset.x, y: offset.y, z: offset.z },
      { x: offset.x + length, y: offset.y, z: offset.z },
      { x: offset.x + length, y: offset.y + width, z: offset.z },
      { x: offset.x, y: offset.y + width, z: offset.z },
      { x: offset.x, y: offset.y, z: offset.z + height },
      { x: offset.x + length, y: offset.y, z: offset.z + height },
      { x: offset.x + length, y: offset.y + width, z: offset.z + height },
      { x: offset.x, y: offset.y + width, z: offset.z + height },
    ];
    return pts.map(projectPoint);
  }

  const clearance = {
    x: Math.max(0, (boxLength - itemLength) / 2),
    y: Math.max(0, (boxWidth - itemWidth) / 2),
    z: Math.max(0, (boxHeight - itemHeight) / 2),
  };

  const outer = generatePoints(boxLength, boxWidth, boxHeight);
  const inner = generatePoints(itemLength, itemWidth, itemHeight, clearance);

  const combined = [...outer, ...inner];
  const xs = combined.map((point) => point.x);
  const ys = combined.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scale = Math.min((viewWidth - margin * 2) / rangeX, (viewHeight - margin * 2) / rangeY);
  const offsetX = (viewWidth - rangeX * scale) / 2 - minX * scale;
  const offsetY = (viewHeight - rangeY * scale) / 2 - minY * scale;

  function transform(points) {
    return points.map((point) => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    }));
  }

  const outer2d = transform(outer);
  const inner2d = transform(inner);

  const faces = [
    [3, 2, 6, 7],
    [3, 0, 4, 7],
    [7, 6, 5, 4],
  ];

  faces.forEach((indices) => {
    const polygon = document.createElementNS(svgNS, 'polygon');
    polygon.setAttribute(
      'points',
      indices
        .map((index) => `${outer2d[index].x.toFixed(1)},${outer2d[index].y.toFixed(1)}`)
        .join(' ')
    );
    polygon.setAttribute('class', `outer-face${status === 'required' ? ' outer-box--ghost' : ''}`);
    isoContent.appendChild(polygon);
  });

  if (inner2d.length) {
    faces.forEach((indices) => {
      const polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute(
        'points',
        indices
          .map((index) => `${inner2d[index].x.toFixed(1)},${inner2d[index].y.toFixed(1)}`)
          .join(' ')
      );
      polygon.setAttribute('class', 'inner-face');
      isoContent.appendChild(polygon);
    });
  }

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

  const outerPath = document.createElementNS(svgNS, 'path');
  outerPath.setAttribute(
    'd',
    edges
      .map((edge) => `M${outer2d[edge[0]].x.toFixed(1)},${outer2d[edge[0]].y.toFixed(1)} L${outer2d[edge[1]].x.toFixed(1)},${outer2d[edge[1]].y.toFixed(1)}`)
      .join(' ')
  );
  outerPath.setAttribute('class', `outer-box${status === 'required' ? ' outer-box--ghost' : ''}`);
  isoContent.appendChild(outerPath);

  if (inner2d.length) {
    const innerPath = document.createElementNS(svgNS, 'path');
    innerPath.setAttribute(
      'd',
      edges
        .map((edge) => `M${inner2d[edge[0]].x.toFixed(1)},${inner2d[edge[0]].y.toFixed(1)} L${inner2d[edge[1]].x.toFixed(1)},${inner2d[edge[1]].y.toFixed(1)}`)
        .join(' ')
    );
    innerPath.setAttribute('class', 'inner-box');
    isoContent.appendChild(innerPath);
  }

  function createLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1.toFixed(1));
    line.setAttribute('y1', y1.toFixed(1));
    line.setAttribute('x2', x2.toFixed(1));
    line.setAttribute('y2', y2.toFixed(1));
    if (className) {
      line.setAttribute('class', className);
    }
    return line;
  }

  function drawDimension(startIndex, endIndex, offsetVector, textOffset, text, anchor = 'middle') {
    const start = outer2d[startIndex];
    const end = outer2d[endIndex];
    const startExt = { x: start.x + offsetVector.x, y: start.y + offsetVector.y };
    const endExt = { x: end.x + offsetVector.x, y: end.y + offsetVector.y };

    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'dimension');

    group.appendChild(createLine(start.x, start.y, startExt.x, startExt.y, 'extension-line'));
    group.appendChild(createLine(end.x, end.y, endExt.x, endExt.y, 'extension-line'));

    const dimLine = createLine(startExt.x, startExt.y, endExt.x, endExt.y, 'dimension-line');
    dimLine.setAttribute('marker-start', 'url(#dimArrowStart)');
    dimLine.setAttribute('marker-end', 'url(#dimArrowEnd)');
    group.appendChild(dimLine);

    const label = document.createElementNS(svgNS, 'text');
    label.textContent = text;
    label.setAttribute('class', 'dimension-text');
    label.setAttribute('text-anchor', anchor);
    label.setAttribute('x', ((startExt.x + endExt.x) / 2 + textOffset.x).toFixed(1));
    label.setAttribute('y', ((startExt.y + endExt.y) / 2 + textOffset.y).toFixed(1));
    group.appendChild(label);

    isoContent.appendChild(group);
  }

  drawDimension(3, 2, { x: 0, y: 36 }, { x: 0, y: -8 }, `Д ${boxLength} мм`);
  drawDimension(0, 3, { x: -48, y: -18 }, { x: -10, y: -12 }, `Ш ${boxWidth} мм`, 'end');
  drawDimension(3, 7, { x: 36, y: 0 }, { x: 14, y: 0 }, `В ${boxHeight} мм`, 'start');

  function annotate(points, text) {
    if (!points.length) return;
    const average = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );
    const label = document.createElementNS(svgNS, 'text');
    label.textContent = text;
    label.setAttribute('class', 'annotation');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('x', (average.x / points.length).toFixed(1));
    label.setAttribute('y', (average.y / points.length - 10).toFixed(1));
    isoContent.appendChild(label);
  }

  annotate([outer2d[7], outer2d[6], outer2d[5], outer2d[4]], status === 'required' ? 'Минимум по расчёту' : 'Подобранная коробка');

  if (inner2d.length) {
    annotate([inner2d[7], inner2d[6], inner2d[5], inner2d[4]], 'Изделие');
  }
}
