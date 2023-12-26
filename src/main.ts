import { Boid, bufferSize, createBoid, kNumObjects, kOffsetOffset, updateBoid } from "./boid";
import boidShader from "./shaders/boid.wgsl?raw";
import computeShader from "./shaders/compute.wgsl?raw";

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

const createBoids = (device: GPUDevice, renderPipeline: GPURenderPipeline, computeBindline: GPUComputePipeline) => {
  const boids: Boid[] = [];

  for (let i = 0; i < kNumObjects; ++i) {
    const buffer = device.createBuffer({
      label: `static uniforms for obj: ${i}`,
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const values = new Float32Array(bufferSize / 4);

    const renderBindGroup = device.createBindGroup({
      label: `render bind group for obj: ${i}`,
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } },
      ],
    });

    const computeBindGroup = device.createBindGroup({
      label: `compute bind group for obj: ${i}`,
      layout: computeBindline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } },
      ],
    });

    const boid = createBoid();
    values.set([boid.position[0], boid.position[1]], kOffsetOffset);

    boids.push({
      buffer,
      values,
      renderBindGroup,
      computeBindGroup,
      ...boid,
    });
  };

  return boids;
};

const createComputePipeline = (device: GPUDevice) => {
  const computeModule = device.createShaderModule({
    label: 'compute shader',
    code: computeShader,
  });

  const pipeline = device.createComputePipeline({
    label: 'compute pipeline',
    layout: 'auto',
    compute: {
      module: computeModule,
      entryPoint: 'compute',
    },
  });

  // const input = new Float32Array([1, 3, 5]);

  // const workBuffer = device.createBuffer({
  //   label: 'work buffer',
  //   size: input.byteLength,
  //   usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  // });

  // device.queue.writeBuffer(workBuffer, 0, input);

  return pipeline;
};

const main = async (device: GPUDevice) => {
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const renderPipeline = createRenderPipeline(device, presentationFormat);
  const computePipeline = createComputePipeline(device);
  const boids = createBoids(device, renderPipeline, computePipeline);

  const render = () => {
    const aspect = canvas.width / canvas.height;

    const encoder = device.createCommandEncoder({ label: 'encoder' });
    {
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

      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(renderPipeline);
      for (const boid of boids) {
        updateBoid(boid, aspect);
        device.queue.writeBuffer(boid.buffer, 0, boid.values);
        pass.setBindGroup(0, boid.renderBindGroup);
        pass.draw(3);
      }
      pass.end();
    }
    {
      const computePassDescriptor: GPUComputePassDescriptor = {};

      const pass = encoder.beginComputePass(computePassDescriptor);
      pass.setPipeline(computePipeline);
      for (const boid of boids) {
        device.queue.writeBuffer(boid.buffer, 0, boid.values);
        pass.setBindGroup(0, boid.computeBindGroup);
        pass.dispatchWorkgroups(1); // TODO
      }
      pass.end();
    }

    // commandEncoder.resolveQuerySet(querySet, 0, 4, resolveBuffer, 0);

    device.queue.submit([encoder.finish()]);

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

start();
