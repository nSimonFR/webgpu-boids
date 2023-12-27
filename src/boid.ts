import { rand } from "./utils";

export const kNumObjects = 5000;

export const bufferSize =
  2 * 4 + // offset
  2 * 4 + // velocity
  2 * 4;  // scale

export const kOffsetOffset = 0;
export const kVelocityOffset = kOffsetOffset + 2;
export const kScaleOffset = kVelocityOffset + 2;
export const kTotalOffset = kScaleOffset + 2;

export const createBoid = () => {
  const position = [rand(-0.9, 0.9), rand(-0.9, 0.9)];
  const velocity = [rand(-0.1, 0.1), rand(-0.1, 0.1)];
  const scaling = rand(0.05, 0.10);
  const scale = [scaling / 10, scaling];
  return [...position, ...velocity, ...scale];
};

export type Boid = {
  scale: number,
  position: number[],
  velocity: number[],
  buffer: GPUBuffer,
  values: Float32Array,
  renderBindGroup: GPUBindGroup,
  computeBindGroup: GPUBindGroup,
};
