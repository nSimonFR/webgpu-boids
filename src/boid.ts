import { rand } from "./utils";

export const kNumObjects = 20000;
export const boidsParams = {
  deltaT: 0.02,
  rule1Distance: 0.1,
  rule2Distance: 0.01,
  rule3Distance: 0.025,
  rule1Scale: 0.02,
  rule2Scale: 0.05,
  rule3Scale: 0.005,
};

export const createBoid = () => {
  const position = [rand(-0.9, 0.9), rand(-0.9, 0.9)];
  const velocity = [rand(-0.01, 0.01), rand(-0.01, 0.01)];
  const scaling = 0.05;
  const scale = [scaling / 10, scaling];
  return [...position, ...velocity, ...scale];
};

export const bufferSize =
  2 * 4 + // position
  2 * 4 + // velocity
  2 * 4;  // scale

export const kOffsetOffset = 0;
export const kVelocityOffset = kOffsetOffset + 2;
export const kScaleOffset = kVelocityOffset + 2;
export const kTotalOffset = kScaleOffset + 2;

export type Boid = {
  scale: number,
  position: number[],
  velocity: number[],
  buffer: GPUBuffer,
  values: Float32Array,
  renderBindGroup: GPUBindGroup,
  computeBindGroup: GPUBindGroup,
};
