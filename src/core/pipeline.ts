export async function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
) {
  return device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: await (await fetch("/src/core/shaders.wgsl")).text(),
      }),
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          stepMode: "instance",
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        }, // position
        {
          arrayStride: 16,
          stepMode: "instance",
          attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }],
        }, // color
        {
          arrayStride: 4,
          stepMode: "instance",
          attributes: [{ shaderLocation: 2, offset: 0, format: "float32" }],
        }, // size
        {
          arrayStride: 16,
          stepMode: "instance",
          attributes: [{ shaderLocation: 3, offset: 0, format: "float32x4" }],
        }, // stroke color
        {
          arrayStride: 4,
          stepMode: "instance",
          attributes: [{ shaderLocation: 4, offset: 0, format: "float32" }],
        }, // stroke width
        {
          arrayStride: 8,
          stepMode: "vertex",
          attributes: [{ shaderLocation: 5, offset: 0, format: "float32x2" }],
        }, // quad offset
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: await (await fetch("/src/core/shaders.wgsl")).text(),
      }),
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-strip",
    },
  });
}
