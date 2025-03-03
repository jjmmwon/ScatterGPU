import { initWebGPU, createPipeline } from "@/core";
import { processColors, processPoints, processSizes } from "@/data";

import { TPoints, TParams } from "@/types";

export class Scatterplot {
  private canvas: HTMLCanvasElement;

  private gpu: {
    device: GPUDevice | null;
    context: GPUCanvasContext | null;
    pipeline: GPURenderPipeline | null;
    bindGroup: GPUBindGroup | null;
  } = { device: null, context: null, pipeline: null, bindGroup: null };

  private buffers: Record<string, GPUBuffer> = {};
  private pointCount: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    const { device, context } = await initWebGPU(this.canvas);
    this.gpu.device = device;
    this.gpu.context = context;
    this.gpu.pipeline = await createPipeline(
      device,
      navigator.gpu.getPreferredCanvasFormat()
    );
    console.log("Scatterplot initialized with WebGPU.");
    this.initCanvasSizeBuffer();
    this.initOffsetBuffer();
    this.createBindGroup();
  }

  private initCanvasSizeBuffer() {
    if (!this.gpu.device) return;

    const canvasSize = new Float32Array([
      this.canvas.width,
      this.canvas.height,
    ]);

    this.buffers.canvasSize = this.gpu.device.createBuffer({
      size: canvasSize.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.updateCanvasSize();
  }

  private updateCanvasSize() {
    if (!this.gpu.device || !this.buffers.canvasSize) return;

    const canvasSize = new Float32Array([
      this.canvas.width,
      this.canvas.height,
    ]);
    this.gpu.device.queue.writeBuffer(this.buffers.canvasSize, 0, canvasSize);
  }

  private createBindGroup() {
    if (!this.gpu.device || !this.buffers.canvasSize) return;

    this.gpu.bindGroup = this.gpu.device.createBindGroup({
      layout: this.gpu.pipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.buffers.canvasSize },
        },
      ],
    });
  }

  private initOffsetBuffer() {
    const quadOffsets = new Float32Array([
      -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ]);

    this.buffers.offset = this.gpu.device!.createBuffer({
      size: quadOffsets.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.gpu.device!.queue.writeBuffer(this.buffers.offset, 0, quadOffsets);
  }

  private createBuffer(data: Float32Array): GPUBuffer {
    const buffer = this.gpu.device!.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.gpu.device!.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  setData(
    points: TPoints,
    {
      colors = "#000000",
      sizes = 5,
      opacity = 1.0,
      strokeColors = "#FFFFFF",
      strokeWidths = 0,
    }: {
      colors?: TParams<string>;
      sizes?: TParams<number>;
      opacity?: TParams<number>;
      strokeColors?: TParams<string>;
      strokeWidths?: TParams<number>;
    } = {}
  ) {
    if (!this.gpu.device) {
      console.error("WebGPU device is not initialized.");
      return;
    }

    const { pointArray } = processPoints(points);
    const colorData = processColors(colors, opacity, pointArray.length / 2);
    const sizeData = processSizes(sizes, pointArray.length / 2);
    const strokeColorData = processColors(
      strokeColors,
      opacity,
      pointArray.length / 2
    );
    const strokeWidthData = new Float32Array(
      Array(pointArray.length / 2).fill(strokeWidths)
    );

    this.buffers.vertex = this.createBuffer(pointArray);
    this.buffers.color = this.createBuffer(colorData);
    this.buffers.size = this.createBuffer(sizeData);
    this.buffers.strokeColor = this.createBuffer(strokeColorData);
    this.buffers.strokeWidth = this.createBuffer(strokeWidthData);

    this.updateCanvasSize();

    this.pointCount = pointArray.length / 2;
  }

  render() {
    if (!this.pointCount) {
      console.warn("No points to render.");
      return;
    }

    const commandEncoder = this.gpu.device!.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.gpu.context!.getCurrentTexture().createView(),
          clearValue: { r: 1, g: 1, b: 1, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    passEncoder.setPipeline(this.gpu.pipeline!);
    passEncoder.setBindGroup(0, this.gpu.bindGroup!);
    passEncoder.setVertexBuffer(0, this.buffers.vertex);
    passEncoder.setVertexBuffer(1, this.buffers.color);
    passEncoder.setVertexBuffer(2, this.buffers.size);
    passEncoder.setVertexBuffer(3, this.buffers.strokeColor);
    passEncoder.setVertexBuffer(4, this.buffers.strokeWidth);
    passEncoder.setVertexBuffer(5, this.buffers.offset);
    passEncoder.draw(4, this.pointCount);
    passEncoder.end();

    this.gpu.device!.queue.submit([commandEncoder.finish()]);
  }
}
