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
const INITIAL_MESSAGE = 'Введите размеры — расчёт выполнится автоматически.';

showOut(INITIAL_MESSAGE);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  calculate();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

function calculate() {
  const rawValues = inputs.map((input) => input.value.trim());
  if (rawValues.some((value) => value === '')) {
    showOut(INITIAL_MESSAGE);
    return;
  }

  const [sourceLength, sourceWidth, sourceHeight] = rawValues.map((value) => parseInt(value, 10));

  if (![sourceLength, sourceWidth, sourceHeight].every(isPositiveInteger)) {
    showOut('Введите положительные целые значения.');
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`);
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
    showOut(`Подходящая коробка не найдена.\nМинимум по расчёту: ${outLengthMin} x ${outWidthMin} x ${neededHeight} мм (Д x Ш x В).`);
    return;
  }

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  showOut(`Подходящая коробка: ${outLength} x ${outWidth} x ${neededHeight} мм (Д x Ш x В).`);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function showOut(text) {
  output.textContent = text;
  output.style.color = text.includes('не найдена') || text.includes('превышает')
    ? 'var(--danger)'
    : 'var(--text-primary)';
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
