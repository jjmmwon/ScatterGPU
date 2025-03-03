import { processColors, processPoints, processSizes } from "@/data";
import { TPoints, TParams } from "@/types";
import { GPUHandler, BufferHandler, InteractionHandler } from "@/handler";

export class Scatterplot {
  private canvas: HTMLCanvasElement;
  private gpu: GPUHandler;
  private buffer!: BufferHandler;
  private interaction!: InteractionHandler;
  private pointCount: number = 0;
  private transform: { scale: number; x: number; y: number } = {
    scale: 1.0,
    x: 0.0,
    y: 0.0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gpu = new GPUHandler(canvas);
  }

  async init() {
    await this.gpu.init();
    this.buffer = new BufferHandler(this.gpu.device);
    this.initBuffers();
    this.createBindGroup();

    new InteractionHandler(
      this.canvas,
      (scale, mousePos) => this.handleZoom(scale, mousePos),
      (translate) => this.handlePan(translate),
      () => this.handleReset() // 🎯 Reset 이벤트 연결
    );
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
    this.buffer.createBuffer(
      "transform",
      new Float32Array([
        this.transform.scale,
        this.transform.x,
        this.transform.y,
      ]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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
        { binding: 1, resource: { buffer: this.buffer.buffers.transform } },
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

  private handleZoom(scale: number, mousePos: { x: number; y: number }) {
    this.transform.scale *= scale;

    // 🎯 마우스 위치 기준으로 이동 (Semantic Zoom 효과)
    this.transform.x = mousePos.x - (mousePos.x - this.transform.x) * scale;
    this.transform.y = mousePos.y - (mousePos.y - this.transform.y) * scale;
    this.updateTransformBuffer();
    this.render();
  }

  private handlePan(translate: { x: number; y: number }) {
    const scaleFactor = this.transform.scale;

    // Normalize translation to clip space with scale factor adjustment
    this.transform.x += ((translate.x / this.canvas.width) * 2.0) / scaleFactor;
    this.transform.y -=
      ((translate.y / this.canvas.height) * 2.0) / scaleFactor;

    this.updateTransformBuffer();
    this.render();
  }

  private handleReset() {
    // 🎯 Zoom & Pan 초기화
    this.transform.scale = 1.0;
    this.transform.x = 0.0;
    this.transform.y = 0.0;

    // 🎯 WebGPU Transform Buffer 업데이트
    this.updateTransformBuffer();

    // 🎯 Re-render
    this.render();
  }

  private updateTransformBuffer() {
    if (!this.gpu.device) return;

    const transformData = new Float32Array([
      this.transform.scale,
      this.transform.x,
      this.transform.y,
    ]);

    this.gpu.device.queue.writeBuffer(
      this.buffer.buffers.transform,
      0,
      transformData
    );
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
