import { rand } from "./utils";

export const kNumObjects = 50;

export const createBoid = () => ({
  scale: rand(0.05, 0.10),
  position: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
  velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
})

export const updateBoid = ({ position, velocity, scale, values }: Boid, aspect: number) => {
  // position[0] += velocity[0] / 10;
  // position[1] += velocity[1] / 10;

  // if (position[0] <= -1) position[0] = 1;
  // if (position[0] > 1) position[0] = -1;
  // if (position[1] <= -1) position[1] = 1;
  // if (position[1] > 1) position[1] = -1;

  // values.set([position[0], position[1]], kOffsetOffset);
  values.set([velocity[0], velocity[1]], kVelocityOffset);
  values.set([scale / aspect, scale], kScaleOffset);
};

export const bufferSize =
  2 * 4 + // offset
  2 * 4 + // velocity
  2 * 4;  // scale

export const kOffsetOffset = 0;
export const kVelocityOffset = 2;
export const kScaleOffset = 4;

export type Boid = {
  scale: number,
  position: number[],
  velocity: number[],
  buffer: GPUBuffer,
  values: Float32Array,
  renderBindGroup: GPUBindGroup,
  computeBindGroup: GPUBindGroup,
};
