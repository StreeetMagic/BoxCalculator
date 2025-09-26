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
const copyButton = document.getElementById('copyBtn');
const inputs = Array.from(form.querySelectorAll('input'));
let copyResetTimeout = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

inputs.forEach((input) => {
  input.addEventListener('input', calculate);
});

copyButton.addEventListener('click', copyOutput);

calculate();

function calculate() {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showOut('Введите данные для расчёта.');
    return;
  }

  const [lengthValue, widthValue, heightValue, massValue] = values;
  const sourceLength = parseInt(lengthValue, 10);
  const sourceWidth = parseInt(widthValue, 10);
  const sourceHeight = parseInt(heightValue, 10);

  if (!isPositiveInteger(sourceLength) || !isPositiveInteger(sourceWidth) || !isPositiveInteger(sourceHeight)) {
    showOut('Введите положительные целые значения для размеров.', 'error');
    return;
  }

  const sourceMass = parseNumber(massValue);

  if (!isPositiveNumber(sourceMass)) {
    showOut('Введите положительное значение массы.', 'error');
    return;
  }

  const neededLength = sourceLength + ADD_EACH_SIDE;
  const neededWidth = sourceWidth + ADD_EACH_SIDE;
  const neededHeight = roundUpTo(sourceHeight + ADD_HEIGHT, 10);

  if (neededHeight > MAX_HEIGHT) {
    showOut(`Высота ${neededHeight} мм превышает максимум ${MAX_HEIGHT} мм.\nИзмените входные данные.`, 'error');
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

  const outLength = Math.max(best.L, best.W);
  const outWidth = Math.min(best.L, best.W);
  const formattedMass = formatMass(sourceMass);
  showOut(`Разместить на паллете ${best.name} H=${neededHeight} мм Масса части ${formattedMass} кг`, 'default', true);
}

function isPositiveInteger(value) {
  return Number.isFinite(value) && value > 0;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function parseNumber(value) {
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value.replace(',', '.');
  return Number.parseFloat(normalized);
}

function showOut(text, variant = 'default', allowCopy = false) {
  output.textContent = text;
  output.style.color = variant === 'error' ? 'var(--danger)' : 'var(--text-primary)';
  setCopyEnabled(allowCopy && variant !== 'error');
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

function formatMass(value) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function setCopyEnabled(enabled) {
  if (!enabled) {
    copyButton.disabled = true;
    resetCopyButtonLabel();
    return;
  }

  copyButton.disabled = false;
}

function resetCopyButtonLabel() {
  copyButton.textContent = 'Скопировать';
  if (copyResetTimeout) {
    clearTimeout(copyResetTimeout);
    copyResetTimeout = null;
  }
}

async function copyOutput() {
  if (copyButton.disabled) return;
  const text = output.textContent.trim();
  if (!text) return;

  try {
    const copied = await writeToClipboard(text);
    copyButton.textContent = copied ? 'Скопировано' : 'Не удалось скопировать';
  } catch (error) {
    console.error('Clipboard error', error);
    copyButton.textContent = 'Ошибка копирования';
  }

  copyResetTimeout = setTimeout(resetCopyButtonLabel, 2000);
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.select();
  let copied = false;

  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }

  return copied;
}
