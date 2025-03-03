import { processColors, processPoints, processSizes } from "@/data";

import { TPoints, TParams } from "@/types";
import { BufferManager } from "@/manager/bufferManager";
import { GPUManager } from "@/manager/gpuManager";

export class Scatterplot {
  private canvas: HTMLCanvasElement;
  private gpu: GPUManager;
  private buffer!: BufferManager;
  private pointCount: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gpu = new GPUManager(canvas);
  }

  async init() {
    await this.gpu.init();
    this.buffer = new BufferManager(this.gpu.device);
    this.initBuffers();
    this.createBindGroup();
  }

  private initBuffers() {
    this.buffer.createBuffer(
      "canvasSize",
      new Float32Array([this.canvas.width, this.canvas.height]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    this.buffer.createBuffer(
      "offset",
      new Float32Array([-0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5]),
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );
  }

  private createBindGroup() {
    if (!this.gpu.device || !this.buffer.buffers.canvasSize) return;

    this.gpu.bindGroup = this.gpu.device.createBindGroup({
      layout: this.gpu.pipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.buffer.buffers.canvasSize },
        },
      ],
    });
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

    this.buffer.createBuffer(
      "vertex",
      pointArray,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );

    this.buffer.createBuffer(
      "color",
      colorData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );
    this.buffer.createBuffer(
      "size",
      sizeData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );
    this.buffer.createBuffer(
      "strokeColor",
      strokeColorData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );
    this.buffer.createBuffer(
      "strokeWidth",
      strokeWidthData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    );

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
    passEncoder.setVertexBuffer(0, this.buffer.buffers.vertex);
    passEncoder.setVertexBuffer(1, this.buffer.buffers.color);
    passEncoder.setVertexBuffer(2, this.buffer.buffers.size);
    passEncoder.setVertexBuffer(3, this.buffer.buffers.strokeColor);
    passEncoder.setVertexBuffer(4, this.buffer.buffers.strokeWidth);
    passEncoder.setVertexBuffer(5, this.buffer.buffers.offset);
    passEncoder.draw(4, this.pointCount);
    passEncoder.end();

    this.gpu.device!.queue.submit([commandEncoder.finish()]);
  }
}
