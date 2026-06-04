import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");
const sourcePath = join(publicDir, "logo.png");
const outputs = [
  { size: 192, fileName: "generated-app-icon-192.png" },
  { size: 512, fileName: "generated-app-icon-512.png" }
];
const background = parseHexColor(process.env.ARCNEST_ICON_BG ?? "#080810");
const alphaThreshold = 8;
const paddingRatio = 0.12;

function main() {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const bounds = getAlphaBounds(source) ?? { minX: 0, minY: 0, maxX: source.width - 1, maxY: source.height - 1 };

  mkdirSync(publicDir, { recursive: true });

  for (const output of outputs) {
    const icon = renderIcon(source, bounds, output.size);
    writeFileSync(join(publicDir, output.fileName), PNG.sync.write(icon));
  }
}

function renderIcon(source, bounds, size) {
  const output = new PNG({ width: size, height: size });
  fillBackground(output, background);

  const sourceWidth = bounds.maxX - bounds.minX + 1;
  const sourceHeight = bounds.maxY - bounds.minY + 1;
  const targetMaxSize = Math.round(size * (1 - paddingRatio * 2));
  const scale = Math.min(targetMaxSize / sourceWidth, targetMaxSize / sourceHeight);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const targetX = Math.round((size - targetWidth) / 2);
  const targetY = Math.round((size - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = bounds.minX + (x + 0.5) / scale - 0.5;
      const sourceY = bounds.minY + (y + 0.5) / scale - 0.5;
      const sample = sampleBilinear(source, sourceX, sourceY);
      const outputIndex = ((targetY + y) * size + targetX + x) * 4;
      const alpha = sample.a / 255;

      output.data[outputIndex] = Math.round(sample.r * alpha + background.r * (1 - alpha));
      output.data[outputIndex + 1] = Math.round(sample.g * alpha + background.g * (1 - alpha));
      output.data[outputIndex + 2] = Math.round(sample.b * alpha + background.b * (1 - alpha));
      output.data[outputIndex + 3] = 255;
    }
  }

  return output;
}

function fillBackground(image, color) {
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = color.r;
    image.data[index + 1] = color.g;
    image.data[index + 2] = color.b;
    image.data[index + 3] = 255;
  }
}

function getAlphaBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];

      if (alpha > alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return maxX >= 0 ? { minX, minY, maxX, maxY } : undefined;
}

function sampleBilinear(image, x, y) {
  const x0 = clamp(Math.floor(x), 0, image.width - 1);
  const y0 = clamp(Math.floor(y), 0, image.height - 1);
  const x1 = clamp(x0 + 1, 0, image.width - 1);
  const y1 = clamp(y0 + 1, 0, image.height - 1);
  const dx = x - x0;
  const dy = y - y0;
  const top = mixColor(readPixel(image, x0, y0), readPixel(image, x1, y0), dx);
  const bottom = mixColor(readPixel(image, x0, y1), readPixel(image, x1, y1), dx);

  return mixColor(top, bottom, dy);
}

function readPixel(image, x, y) {
  const index = (y * image.width + x) * 4;

  return {
    r: image.data[index],
    g: image.data[index + 1],
    b: image.data[index + 2],
    a: image.data[index + 3]
  };
}

function mixColor(a, b, ratio) {
  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
    a: a.a + (b.a - a.a) * ratio
  };
}

function parseHexColor(value) {
  const normalized = value.replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

main();
