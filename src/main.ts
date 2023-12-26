import boidShader from "./shaders/boid.wgsl?raw";

const start = async () => {
  if (!navigator.gpu) {
    throw new Error(`WebGPU is not supported in your browser`);
  }

  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU disabled");
  }

  const device = await adapter?.requestDevice();
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);

    if (info.reason !== 'destroyed') {
      start();
    }
  });

  main(device);
};

const rand = (min?: number, max?: number): number => {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

const main = async (device: GPUDevice) => {
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const boidModule = device.createShaderModule({
    label: 'boid shader',
    code: boidShader,
  });

  const pipeline = device.createRenderPipeline({
    label: 'render pipeline',
    layout: 'auto',
    vertex: {
      module: boidModule,
      entryPoint: 'vertex_main',
    },
    fragment: {
      module: boidModule,
      entryPoint: 'fragment_main',
      targets: [{ format: presentationFormat }],
    },
  });

  type objectInfo = {
    scale: number,
    position: number[],
    velocity: number[],
    uniformBuffer: GPUBuffer,
    uniformValues: Float32Array,
    bindGroup: GPUBindGroup,
  };

  const uniformBufferSize =
    2 * 4 + // offset
    2 * 4 + // velocity
    2 * 4;  // scale

  const kOffsetOffset = 0;
  const kVelocityOffset = 2;
  const kScaleOffset = 4;

  const kNumObjects = 50;
  const objectInfos: objectInfo[] = [];

  for (let i = 0; i < kNumObjects; ++i) {
    const uniformBuffer = device.createBuffer({
      label: `static uniforms for obj: ${i}`,
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    const position = [rand(-0.9, 0.9), rand(-0.9, 0.9)];
    const velocity = [rand(-0.1, 0.1), rand(-0.1, 0.1)];

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const bindGroup = device.createBindGroup({
      label: `bind group for obj: ${i}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
      ],
    });

    objectInfos.push({
      scale: rand(0.1, 0.2),
      position,
      velocity,
      uniformBuffer,
      uniformValues,
      bindGroup,
    });
  };

  const render = () => {
    const aspect = canvas.width / canvas.height;

    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: 'canvas renderPass',
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const encoder = device.createCommandEncoder({ label: 'encoder' });

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    for (const { scale, position, velocity, bindGroup, uniformBuffer, uniformValues } of objectInfos) {
      position[0] += velocity[0] / 10;
      position[1] += velocity[1] / 10;
      console.log(position[0], position[1]);

      if (position[0] <= -1) position[0] = 1;
      if (position[0] > 1) position[0] = -1;
      if (position[1] <= -1) position[1] = 1;
      if (position[1] > 1) position[1] = -1;

      uniformValues.set([position[0], position[1]], kOffsetOffset);
      uniformValues.set([velocity[0], velocity[1]], kVelocityOffset);
      uniformValues.set([scale / aspect, scale], kScaleOffset);

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
    }
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
  };

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement;

      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));

      requestAnimationFrame(render);
    }
  });
  observer.observe(canvas);
};

start();
