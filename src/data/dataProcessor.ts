import { TPoints, TParams } from "@/types";
import { hexToRgb } from "@/utils/hexToRgb";

export function processPoints(points: TPoints): {
  pointArray: Float32Array;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  let xValues: number[], yValues: number[];

  if (Array.isArray(points) && Array.isArray(points[0])) {
    xValues = points.map((p) => p[0]);
    yValues = points.map((p) => p[1]);
  } else if ("x" in points && "y" in points) {
    xValues = points.x;
    yValues = points.y;
  } else {
    throw new Error("Invalid points format.");
  }

  const { min: xMin, max: xMax, range: xRange } = getScale(xValues);
  const { min: yMin, max: yMax, range: yRange } = getScale(yValues);

  const scaleFactor = 0.9;

  const pointArray = new Float32Array(
    xValues
      .map((x, i) => [
        (((x - xMin) / xRange) * 2 - 1) * scaleFactor, // X 정규화 후 0.99 곱함
        (((yValues[i] - yMin) / yRange) * 2 - 1) * scaleFactor, // Y 정규화 후 0.99 곱함
      ])
      .flat()
  );

  return { pointArray, xMin, xMax, yMin, yMax };
}

export function processColors(
  colors: TParams<string>,
  opacity: TParams<number>,
  pointCount: number
): Float32Array {
  colors = Array.isArray(colors) ? colors : Array(pointCount).fill(colors);
  opacity = Array.isArray(opacity) ? opacity : Array(pointCount).fill(opacity);

  if (pointCount !== colors.length || pointCount !== opacity.length) {
    throw new Error("Mismatch between number of points and colors or opacity.");
  }

  const colorData = new Float32Array(colors.length * 4);
  colors.forEach((color, i) => {
    const [r, g, b] = hexToRgb(color);
    colorData.set([r, g, b, opacity[i]], i * 4);
  });
  return colorData;
}

export function processSizes(
  sizes: TParams<number>,
  pointCount: number
): Float32Array {
  sizes = Array.isArray(sizes) ? sizes : Array(pointCount).fill(sizes);

  if (sizes.length !== pointCount) {
    throw new Error("Mismatch between number of points and sizes.");
  }

  return new Float32Array(sizes);
}

function getScale(values: number[]): {
  min: number;
  max: number;
  range: number;
} {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min || 1 }; // 0 나누기 방지
}
