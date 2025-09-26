const ADD_EACH_SIDE = 100;
const ADD_HEIGHT = 225;
const MAX_HEIGHT = 2450;

const BOXES = [
  { name: 'ТДП.004.1.01.022', L: 1250, W: 850 },
  { name: 'ТДП.004.1.01.032', L: 1800, W: 850 },
  { name: 'ТДП.004.1.01.033', L: 1800, W: 1225 },
  { name: 'ТДП.004.1.01.034', L: 1800, W: 1600 },
  { name: 'ТДП.004.1.01.042', L: 2350, W: 850 },
  { name: 'ТДП.004.1.01.043', L: 2350, W: 1225 },
  { name: 'ТДП.004.1.01.044', L: 2350, W: 1650 },
  { name: 'ТДП.004.1.01.045', L: 2350, W: 1950 },
];

(function renderBoxTable() {
  const tbody = document.querySelector('#boxTable tbody');
  tbody.innerHTML = '';
  BOXES.forEach((box, index) => {
    const tr = document.createElement('tr');
    const length = Math.max(box.L, box.W);
    const width = Math.min(box.L, box.W);
    tr.innerHTML = `<td>${index + 1}</td><td>${box.name}</td><td>${length}</td><td>${width}</td>`;
    tbody.appendChild(tr);
  });
})();

const form = document.getElementById('f');
const output = document.getElementById('out');
const copyButton = document.getElementById('copy');
const inputs = Array.from(form.querySelectorAll('input'));

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

copyButton.addEventListener('click', () => {
  const text = output.textContent.trim();
  if (!text || copyButton.disabled) {
    return;
  }
  navigator.clipboard?.writeText(text).catch(() => {
    /* ignore clipboard errors */
  });
});

calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите данные для расчёта.');
    return;
  }

  const [lengthValue, widthValue, heightValue, massValue] = values;
  const [sourceLength, sourceWidth, sourceHeight] = [lengthValue, widthValue, heightValue].map((value) => parseInt(value, 10));
  const mass = parseMass(massValue);

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight) || !isPositiveNumber(mass)) {
    showOut('Введите положительные значения. Используйте целые числа для габаритов и число больше нуля для массы.', 'error');
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные размеры.`, 'error');
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
    showOut(`Подходящая упаковка не найдена.\nМинимум по расчёту: ${outLengthMin} x ${outWidthMin} x ${neededHeight} мм (Д x Ш x В).`, 'error');
    return;
  }

  const massFormatted = formatMass(mass);
  showOut(`Разместить на паллете ${best.name} H=${neededHeight} мм Масса части ${massFormatted} кг`, 'result');
}

function parseMass(value) {
  if (typeof value !== 'string') return NaN;
  const normalized = value.replace(',', '.');
  return parseFloat(normalized);
}

function formatMass(value) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function isPositiveInteger(value) {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function showOut(text, variant = 'default') {
  output.textContent = text;
  const isError = variant === 'error';
  output.style.color = isError ? 'var(--danger)' : 'var(--text-primary)';
  copyButton.disabled = variant !== 'result';
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
