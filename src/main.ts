import fragmentShader from "./shaders/fragment.wgsl?raw";
import vertexShader from "./shaders/vertex.wgsl?raw";

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

const main = async (device: GPUDevice) => {
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const vertexModule = device.createShaderModule({
    label: 'vertex shader',
    code: vertexShader,
  });

  const fragmentModule = device.createShaderModule({
    label: 'fragment shader',
    code: fragmentShader,
  });

  const pipeline = device.createRenderPipeline({
    label: 'render pipeline',
    layout: 'auto',
    vertex: {
      module: vertexModule,
      entryPoint: 'vs',
    },
    fragment: {
      module: fragmentModule,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });

  const render = () => {
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
    pass.draw(3);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  };

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement;

      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));

      render();
    }
  });
  observer.observe(canvas);
};

start();
