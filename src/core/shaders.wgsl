struct InstanceData {
  @location(0) position: vec2<f32>,   
  @location(1) color: vec4<f32>,      
  @location(2) size: f32,             
  @location(3) strokeColor: vec4<f32>, 
  @location(4) strokeWidth: f32       
};

struct QuadVertex {
  @location(5) offset: vec2<f32>
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) localPos: vec2<f32>,   
  @location(2) strokeColor: vec4<f32>, 
  @location(3) strokeWidth: f32       
};

struct CanvasSize {
  width: f32,
  height: f32,
};

@group(0) @binding(0) var<uniform> canvas: CanvasSize;

@vertex
fn vs_main(instance: InstanceData, quad: QuadVertex) -> VertexOutput {
    var output: VertexOutput;

    // transform px to clip space 
    let size_clip = (instance.size / min(canvas.width, canvas.height)) * 2.0;
    let stroke_clip = instance.strokeWidth / instance.size;

    // 🎯 크기 조정 후 오프셋 적용
    let scaledOffset = quad.offset * size_clip;
    let pos = instance.position + scaledOffset;

    // 정규화된 클립 공간 좌표로 변환
    output.position = vec4<f32>(pos, 0.0, 1.0);
    output.color = instance.color;

    // 🎯 localPos를 [-1, 1] 범위로 변환
    output.localPos = quad.offset * 2.0;
    
    // 🎯 stroke 정보 전달 (clip space에서 상대 크기로 변환)
    output.strokeColor = instance.strokeColor;
    output.strokeWidth = stroke_clip; // 🎯 strokeWidth 변환 반영

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let dist = length(input.localPos);

    let radius = 1.0;
    let innerRadius = max(0.0, radius - input.strokeWidth);

    if input.strokeWidth > 0.0 {

        if dist > radius {
            discard;
        } else if dist >= innerRadius {
            return input.strokeColor;
        }
    } else {
        if dist > radius {
            discard;
        }
    }

    return input.color;
}
