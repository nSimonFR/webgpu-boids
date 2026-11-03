import { rand } from "./utils";

// Layout of one boid in the storage buffers (must match the WGSL struct).
// pos(2) vel(2) size tint seed pad
export const FLOATS_PER_BOID = 8;

// Fixed palette lives in boid.wgsl; these are the odds of each entry.
const TINT_WEIGHTS = [0.45, 0.3, 0.2, 0.05];
const SIZE_TIERS = [
  { weight: 0.7, size: 0.8 },
  { weight: 0.25, size: 1.15 },
  { weight: 0.05, size: 1.5 },
];

const pick = (weights: number[]) => {
  let r = Math.random();
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};

// Density-based count: about one boid per 900 CSS px², never a flat 20k.
export const boidCount = (width: number, height: number, min = 200, max = 2000, perPx = 900) =>
  Math.round(Math.min(max, Math.max(min, (width * height) / perPx)));

// Spawn over the whole screen, already flying roughly the same way
// (shared heading +/- ~70°), so the flock starts calm.
export const spawnBoids = (count: number, width: number, height: number) => {
  const data = new Float32Array(count * FLOATS_PER_BOID);
  const heading = rand(Math.PI * 2);
  for (let i = 0; i < count; i += 1) {
    const angle = heading + rand(-1.2, 1.2);
    const size = SIZE_TIERS[pick(SIZE_TIERS.map((t) => t.weight))].size + rand(0.15);
    const speed = 140 / Math.sqrt(size);
    data.set(
      [
        rand(width),
        rand(height),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        size,
        pick(TINT_WEIGHTS),
        rand(Math.PI * 2),
        0,
      ],
      i * FLOATS_PER_BOID,
    );
  }
  return data;
};
