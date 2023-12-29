import { bufferSize, createBoid, kNumObjects, kTotalOffset } from "./boid";
import boidShader from "./shaders/boid.wgsl?raw";
import computeShader from "./shaders/compute.wgsl?raw";
import { setFPSCounter } from "./utils";

const createRenderPipeline = (device: GPUDevice, buffer: GPUBuffer, presentationFormat: GPUTextureFormat) => {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {
        type: 'read-only-storage',
      },
    }]
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [
      bindGroupLayout,
    ]
  });

  const boidModule = device.createShaderModule({
    label: 'boid shader',
    code: boidShader,
  });

  const pipeline = device.createRenderPipeline({
    label: 'render pipeline',
    layout: pipelineLayout,
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

  const bindGroup = device.createBindGroup({
    label: `render bind group`,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
    ],
  });

  return { pipeline, bindGroup };
};

const createComputePipeline = (device: GPUDevice, buffer: GPUBuffer) => {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage',
      },
    }]
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [
      bindGroupLayout,
    ]
  });

  const computeModule = device.createShaderModule({
    label: 'compute shader',
    code: computeShader,
  });

  const pipeline = device.createComputePipeline({
    label: 'compute pipeline',
    layout: pipelineLayout,
    compute: {
      module: computeModule,
      entryPoint: 'compute',
    },
  });

  const bindGroup = device.createBindGroup({
    label: `compute bind group`,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
    ],
  });

  return { pipeline, bindGroup };
};

const createBoidsBuffer = (device: GPUDevice) => {
  const values = new Float32Array(bufferSize * kNumObjects / 4);

  const buffer = device.createBuffer({
    label: `static buffer`,
    size: values.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  for (let i = 0; i < kNumObjects; ++i) {
    values.set(createBoid(), i * kTotalOffset)
  };
  device.queue.writeBuffer(buffer, 0, values);

  return buffer;
};

const main = async (device: GPUDevice) => {
  const infoElem = document.querySelector('#info');
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const buffer = createBoidsBuffer(device);
  const {
    pipeline: renderPipeline,
    bindGroup: renderBindGroup,
  } = createRenderPipeline(device, buffer, presentationFormat);
  const {
    pipeline: computePipeline,
    bindGroup: computeBindGroup,
  } = createComputePipeline(device, buffer);

  const render = (now: number) => {
    setFPSCounter(now, infoElem);

    // const aspect = canvas.width / canvas.height; // TODO

    const encoder = device.createCommandEncoder({ label: 'encoder' });
    {
      const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'canvas renderPass',
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: [0, 0, 0, 1],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      };

      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.draw(3, kNumObjects, 0, 0);
      pass.end();
    }
    {
      const computePassDescriptor: GPUComputePassDescriptor = {};

      const pass = encoder.beginComputePass(computePassDescriptor);
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, computeBindGroup);
      pass.dispatchWorkgroups((kNumObjects / 128) + 1);
      pass.end();
    }
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
