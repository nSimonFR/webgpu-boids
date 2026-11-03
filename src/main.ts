import { boidCount, spawnBoids } from "./boid";
import boidShader from "./shaders/boid.wgsl?raw";
import computeShader from "./shaders/compute.wgsl?raw";
import { createPointer, setFPSCounter } from "./utils";

const PARAMS_FLOATS = 8; // dt time width height mouse(2) mouseStrength fade
const SAMPLES = 4; // MSAA: smooth edges, no shimmering on thin shapes
const FADE_MS = 1800;
const WARMUP_STEPS = 240; // reduced motion: pre-flock, then show one still frame

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const main = async (device: GPUDevice) => {
  const infoElem = document.querySelector("#info");
  const canvas = document.querySelector("canvas")!;
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  let width = window.innerWidth;
  let height = window.innerHeight;
  const count = boidCount(width, height);

  // Two boid buffers: compute reads one and writes the other (ping-pong), so
  // every boid sees the same snapshot of the flock.
  const data = spawnBoids(count, width, height);
  const boidBuffers = [0, 1].map((i) => {
    const buffer = device.createBuffer({
      label: `boids ${i}`,
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  });

  const params = new Float32Array(PARAMS_FLOATS);
  const paramsBuffer = device.createBuffer({
    label: "params",
    size: params.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const [computePipeline, renderPipeline] = await Promise.all([
    device.createComputePipelineAsync({
      label: "compute pipeline",
      layout: "auto",
      compute: { module: device.createShaderModule({ code: computeShader }), entryPoint: "main" },
    }),
    device.createRenderPipelineAsync({
      label: "render pipeline",
      layout: "auto",
      vertex: { module: device.createShaderModule({ code: boidShader }), entryPoint: "vs" },
      fragment: {
        module: device.createShaderModule({ code: boidShader }),
        entryPoint: "fs",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        }],
      },
      multisample: { count: SAMPLES },
    }),
  ]);

  // computeGroups[k]: reads buffer k, writes buffer 1-k. renderGroups[k]: draws buffer k.
  const computeGroups = [0, 1].map((k) => device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: boidBuffers[k] } },
      { binding: 1, resource: { buffer: boidBuffers[1 - k] } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  }));
  const renderGroups = [0, 1].map((k) => device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: boidBuffers[k] } },
      { binding: 1, resource: { buffer: paramsBuffer } },
    ],
  }));

  let msaaTexture: GPUTexture | undefined;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const max = device.limits.maxTextureDimension2D;
    canvas.width = Math.max(1, Math.min(Math.round(width * dpr), max));
    canvas.height = Math.max(1, Math.min(Math.round(height * dpr), max));
    msaaTexture?.destroy();
    msaaTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      sampleCount: SAMPLES,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  };
  resize();

  const pointer = createPointer();
  let current = 0;
  let time = 0;

  const writeParams = (dt: number, fade: number) => {
    params.set([dt, time, width, height, pointer.x, pointer.y, pointer.strength, fade]);
    device.queue.writeBuffer(paramsBuffer, 0, params);
  };

  const encodeStep = (encoder: GPUCommandEncoder) => {
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, computeGroups[current]);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
    current = 1 - current;
  };

  const encodeDraw = (encoder: GPUCommandEncoder) => {
    const pass = encoder.beginRenderPass({
      label: "canvas renderPass",
      colorAttachments: [{
        view: msaaTexture!.createView(),
        resolveTarget: context.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 0],
        loadOp: "clear",
        storeOp: "discard",
      }],
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, renderGroups[current]);
    pass.draw(3, count);
    pass.end();
  };

  // Still frame for prefers-reduced-motion: let the flock form first.
  const drawStill = (warmup = WARMUP_STEPS) => {
    pointer.strength = 0;
    for (let i = 0; i < warmup; i += 1) {
      time += 1 / 60;
      writeParams(1 / 60, 1);
      const encoder = device.createCommandEncoder();
      encodeStep(encoder);
      device.queue.submit([encoder.finish()]);
    }
    const encoder = device.createCommandEncoder();
    encodeDraw(encoder);
    device.queue.submit([encoder.finish()]);
  };

  let startedAt: number | null = null;
  let last = 0;
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    setFPSCounter(now, infoElem);
    if (startedAt === null) {
      startedAt = now;
      last = now;
    }
    // Clamp dt: same speed on 60/120/144 Hz, no jump after a hidden tab.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    time += dt;
    pointer.update(now, dt);
    const t = Math.min(1, (now - startedAt) / FADE_MS);
    writeParams(dt, 1 - (1 - t) ** 3);

    const encoder = device.createCommandEncoder({ label: "encoder" });
    encodeStep(encoder);
    encodeDraw(encoder);
    device.queue.submit([encoder.finish()]);
  };

  const run = () => {
    cancelAnimationFrame(raf);
    if (reducedMotion.matches) drawStill();
    else raf = requestAnimationFrame(frame);
  };

  window.addEventListener("resize", () => {
    resize();
    if (reducedMotion.matches) drawStill(0);
  });
  reducedMotion.addEventListener("change", run);

  run();
};

const start = async () => {
  if (!navigator.gpu) {
    throw new Error(`WebGPU is not supported in your browser`);
  }

  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU disabled");
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);

    if (info.reason !== "destroyed") {
      start();
    }
  });

  await main(device);
};

start();
