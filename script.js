const ADD_EACH_SIDE = 100;
const ADD_HEIGHT = 225;
const MAX_HEIGHT = 2450;
const ISO_ANGLE = Math.PI / 6;
const ISO_COS = Math.cos(ISO_ANGLE);
const ISO_SIN = Math.sin(ISO_ANGLE);
const numberFormatter = new Intl.NumberFormat('ru-RU');

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
const drawing = document.getElementById('drawing');
const drawingContent = drawing ? drawing.querySelector('#drawingContent') : null;
const drawingCaption = document.getElementById('drawingCaption');

const drawingDefaultCaption = 'Введите размеры для расчёта, чтобы увидеть схему размещения изделия в коробке.';

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

resetDrawing(drawingDefaultCaption);

calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите размеры для расчёта.');
    resetDrawing(drawingDefaultCaption);
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = values.map((value) => parseInt(value, 10));

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения.', 'error');
    resetDrawing('Чертёж доступен только для положительных целых значений.');
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
    resetDrawing('Превышена допустимая высота коробки — схема недоступна.');
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
    resetDrawing('Подходящая коробка не найдена — нет схемы для отображения.');
    return;
  }

  const orientation = resolveOrientation(best, neededLength, neededWidth, sourceLength, sourceWidth);
  updateDrawing({
    outerLength: orientation.boxLength,
    outerWidth: orientation.boxWidth,
    outerHeight: neededHeight,
    innerLength: orientation.innerLength,
    innerWidth: orientation.innerWidth,
    innerHeight: sourceHeight,
  });

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

function resolveOrientation(box, neededLength, neededWidth, sourceLength, sourceWidth) {
  const directFit = box.L >= neededLength && box.W >= neededWidth;
  const swappedFit = box.L >= neededWidth && box.W >= neededLength;

  if (directFit && (!swappedFit || neededLength >= neededWidth)) {
    return {
      boxLength: box.L,
      boxWidth: box.W,
      innerLength: sourceLength,
      innerWidth: sourceWidth,
    };
  }

  if (swappedFit) {
    return {
      boxLength: box.W,
      boxWidth: box.L,
      innerLength: sourceWidth,
      innerWidth: sourceLength,
    };
  }

  return {
    boxLength: Math.max(box.L, box.W),
    boxWidth: Math.min(box.L, box.W),
    innerLength: sourceLength,
    innerWidth: sourceWidth,
  };
}

function resetDrawing(message = drawingDefaultCaption) {
  if (!drawingContent) return;
  drawingContent.innerHTML = `<text class="drawing-placeholder" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${message}</text>`;
  if (drawingCaption) {
    drawingCaption.textContent = message;
  }
}

function updateDrawing(dimensions) {
  if (!drawingContent || !dimensions) {
    resetDrawing();
    return;
  }

  const {
    outerLength,
    outerWidth,
    outerHeight,
    innerLength,
    innerWidth,
    innerHeight,
  } = dimensions;

  const iso = (x, y, z) => ({
    x: (x - y) * ISO_COS,
    y: (x + y) * ISO_SIN - z,
  });

  const outer = {
    A: iso(0, 0, 0),
    B: iso(outerLength, 0, 0),
    C: iso(outerLength, outerWidth, 0),
    D: iso(0, outerWidth, 0),
    E: iso(0, 0, outerHeight),
    F: iso(outerLength, 0, outerHeight),
    G: iso(outerLength, outerWidth, outerHeight),
    H: iso(0, outerWidth, outerHeight),
  };

  const offsetLength = Math.max(0, outerLength - innerLength) / 2;
  const offsetWidth = Math.max(0, outerWidth - innerWidth) / 2;
  const innerTop = Math.min(innerHeight, outerHeight);

  const inner = {
    A: iso(offsetLength, offsetWidth, 0),
    B: iso(offsetLength + innerLength, offsetWidth, 0),
    C: iso(offsetLength + innerLength, offsetWidth + innerWidth, 0),
    D: iso(offsetLength, offsetWidth + innerWidth, 0),
    E: iso(offsetLength, offsetWidth, innerTop),
    F: iso(offsetLength + innerLength, offsetWidth, innerTop),
    G: iso(offsetLength + innerLength, offsetWidth + innerWidth, innerTop),
    H: iso(offsetLength, offsetWidth + innerWidth, innerTop),
  };

  const vLength = subtract(outer.B, outer.A);
  const vWidth = subtract(outer.C, outer.B);

  const lengthShift = scale(normalize(rotateCCW(vLength)), 160);
  const widthShift = scale(normalize(rotateCW(vWidth)), 160);
  const heightShift = widthShift;

  const lengthExtA = add(outer.A, lengthShift);
  const lengthExtB = add(outer.B, lengthShift);
  const widthExtB = add(outer.B, widthShift);
  const widthExtC = add(outer.C, widthShift);
  const heightExtB = add(outer.B, heightShift);
  const heightExtF = add(outer.F, heightShift);

  const lengthLabelPoint = add(midpoint(lengthExtA, lengthExtB), scale(normalize(lengthShift), -18));
  const widthLabelPoint = add(midpoint(widthExtB, widthExtC), scale(normalize(widthShift), -18));
  const heightLabelPoint = add(midpoint(heightExtB, heightExtF), scale(normalize(heightShift), -20));

  const allPoints = [
    ...Object.values(outer),
    ...Object.values(inner),
    lengthExtA,
    lengthExtB,
    widthExtB,
    widthExtC,
    heightExtB,
    heightExtF,
    lengthLabelPoint,
    widthLabelPoint,
    heightLabelPoint,
  ];

  const bounds = allPoints.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  const margin = 26;
  const viewWidth = 360;
  const viewHeight = 280;
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  const scaleFactor = Math.min((viewWidth - margin * 2) / spanX, (viewHeight - margin * 2) / spanY);

  const project = (point) => ({
    x: (point.x - bounds.minX) * scaleFactor + margin,
    y: (point.y - bounds.minY) * scaleFactor + margin,
  });

  const outerP = mapPoints(outer, project);
  const innerP = mapPoints(inner, project);
  const lengthExtAP = project(lengthExtA);
  const lengthExtBP = project(lengthExtB);
  const widthExtBP = project(widthExtB);
  const widthExtCP = project(widthExtC);
  const heightExtBP = project(heightExtB);
  const heightExtFP = project(heightExtF);
  const lengthLabelP = project(lengthLabelPoint);
  const widthLabelP = project(widthLabelPoint);
  const heightLabelP = project(heightLabelPoint);

  const path = (points, close = true) => {
    const sequence = points.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' L ');
    return close ? `M ${sequence} Z` : `M ${sequence}`;
  };

  const line = (from, to) => `M ${from.x.toFixed(2)},${from.y.toFixed(2)} L ${to.x.toFixed(2)},${to.y.toFixed(2)}`;

  const outerMarkup = `
    <path class="outer-face" d="${path([outerP.A, outerP.B, outerP.F, outerP.E])}"></path>
    <path class="outer-face" d="${path([outerP.B, outerP.C, outerP.G, outerP.F])}"></path>
    <path class="outer-face" d="${path([outerP.E, outerP.F, outerP.G, outerP.H])}"></path>
    <path class="outer-wire" d="${path([outerP.A, outerP.B, outerP.C, outerP.D])}"></path>
    <path class="outer-wire" d="${path([outerP.E, outerP.F, outerP.G, outerP.H])}"></path>
    <path class="outer-wire" d="${line(outerP.A, outerP.E)}"></path>
    <path class="outer-wire" d="${line(outerP.B, outerP.F)}"></path>
    <path class="outer-wire" d="${line(outerP.C, outerP.G)}"></path>
    <path class="outer-wire" d="${line(outerP.D, outerP.H)}"></path>
  `;

  const innerMarkup = `
    <path class="inner-face" d="${path([innerP.A, innerP.B, innerP.F, innerP.E])}"></path>
    <path class="inner-face" d="${path([innerP.B, innerP.C, innerP.G, innerP.F])}"></path>
    <path class="inner-face" d="${path([innerP.E, innerP.F, innerP.G, innerP.H])}"></path>
    <path class="inner-wire" d="${path([innerP.A, innerP.B, innerP.C, innerP.D])}"></path>
    <path class="inner-wire" d="${path([innerP.E, innerP.F, innerP.G, innerP.H])}"></path>
    <path class="inner-wire" d="${line(innerP.A, innerP.E)}"></path>
    <path class="inner-wire" d="${line(innerP.B, innerP.F)}"></path>
    <path class="inner-wire" d="${line(innerP.C, innerP.G)}"></path>
    <path class="inner-wire" d="${line(innerP.D, innerP.H)}"></path>
  `;

  const dimensionsMarkup = `
    <path class="dim-extension" d="${line(outerP.A, lengthExtAP)}"></path>
    <path class="dim-extension" d="${line(outerP.B, lengthExtBP)}"></path>
    <path class="dim-extension" d="${line(outerP.B, widthExtBP)}"></path>
    <path class="dim-extension" d="${line(outerP.C, widthExtCP)}"></path>
    <path class="dim-extension" d="${line(outerP.B, heightExtBP)}"></path>
    <path class="dim-extension" d="${line(outerP.F, heightExtFP)}"></path>
    <path class="dim-line" marker-start="url(#dimTick)" marker-end="url(#dimTick)" d="${line(lengthExtAP, lengthExtBP)}"></path>
    <path class="dim-line" marker-start="url(#dimTick)" marker-end="url(#dimTick)" d="${line(widthExtBP, widthExtCP)}"></path>
    <path class="dim-line" marker-start="url(#dimTick)" marker-end="url(#dimTick)" d="${line(heightExtBP, heightExtFP)}"></path>
    <text class="dim-text" text-anchor="middle" dominant-baseline="middle" x="${lengthLabelP.x.toFixed(2)}" y="${lengthLabelP.y.toFixed(2)}">Д ${formatMillimeters(outerLength)} мм</text>
    <text class="dim-text" text-anchor="middle" dominant-baseline="middle" x="${widthLabelP.x.toFixed(2)}" y="${widthLabelP.y.toFixed(2)}">Ш ${formatMillimeters(outerWidth)} мм</text>
    <text class="dim-text" text-anchor="middle" dominant-baseline="middle" x="${heightLabelP.x.toFixed(2)}" y="${heightLabelP.y.toFixed(2)}">В ${formatMillimeters(outerHeight)} мм</text>
  `;

  drawingContent.innerHTML = `<g class="drawing__outer">${outerMarkup}</g><g class="drawing__inner">${innerMarkup}</g><g class="drawing__dimensions">${dimensionsMarkup}</g>`;

  if (drawingCaption) {
    const clearanceLength = Math.max(0, outerLength - innerLength);
    const clearanceWidth = Math.max(0, outerWidth - innerWidth);
    const clearanceHeight = Math.max(0, outerHeight - innerHeight);
    const caption = `Коробка ${formatMillimeters(outerLength)} × ${formatMillimeters(outerWidth)} × ${formatMillimeters(outerHeight)} мм · Изделие ${formatMillimeters(innerLength)} × ${formatMillimeters(innerWidth)} × ${formatMillimeters(innerHeight)} мм. Запас: Д ${formatMillimeters(clearanceLength / 2)} мм, Ш ${formatMillimeters(clearanceWidth / 2)} мм, В ${formatMillimeters(clearanceHeight)} мм.`;
    drawingCaption.textContent = caption;
  }
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
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function rotateCCW(vector) {
  return { x: -vector.y, y: vector.x };
}

function rotateCW(vector) {
  return { x: vector.y, y: -vector.x };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function mapPoints(record, projector) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, projector(value)]));
}

function formatMillimeters(value) {
  return numberFormatter.format(Math.round(value));
}
