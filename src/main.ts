import { Boid, createBoid, kNumObjects, uniformBufferSize, updateBoid } from "./boid";
import boidShader from "./shaders/boid.wgsl?raw";
import computeShader from "./shaders/compute.wgsl?raw";

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

const createRenderPipeline = (device: GPUDevice, presentationFormat: GPUTextureFormat) => {
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

  return pipeline;
};

const createBoids = (device: GPUDevice, pipeline: GPURenderPipeline) => {
  const boids: Boid[] = [];

  for (let i = 0; i < kNumObjects; ++i) {
    const uniformBuffer = device.createBuffer({
      label: `static uniforms for obj: ${i}`,
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    const bindGroup = device.createBindGroup({
      label: `bind group for obj: ${i}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
      ],
    });

    boids.push({
      uniformBuffer,
      uniformValues,
      bindGroup,
      ...createBoid(),
    });
  };

  return boids;
};

const createComputePipeline = async (device: GPUDevice) => {
  const computeModule = device.createShaderModule({
    label: 'compute shader',
    code: computeShader,
  });

  const pipeline = device.createComputePipeline({
    label: 'doubling compute pipeline',
    layout: 'auto',
    compute: {
      module: computeModule,
      entryPoint: 'compute',
    },
  });

  const input = new Float32Array([1, 3, 5]);

  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(workBuffer, 0, input);

  const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder({
    label: 'doubling encoder',
  });
  const pass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
  pass.end();

  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log('input', input);
  console.log('result', result);

  resultBuffer.unmap();
};

const main = async (device: GPUDevice) => {
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  await createComputePipeline(device);

  const pipeline = createRenderPipeline(device, presentationFormat);
  const boids = createBoids(device, pipeline);

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

    for (const boid of boids) {
      updateBoid(boid, aspect);

      device.queue.writeBuffer(boid.uniformBuffer, 0, boid.uniformValues);
      pass.setBindGroup(0, boid.bindGroup);
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
