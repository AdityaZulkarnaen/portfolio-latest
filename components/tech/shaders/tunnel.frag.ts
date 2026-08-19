export const tunnelFragmentShader = /* glsl */ `
uniform sampler2D uAtlas;

varying vec2  vUv;
varying float vAlpha;
varying float vNear;

void main() {
  vec4 texel = texture2D(uAtlas, vUv);

  // Most of each cell is transparent margin. Discarding early keeps the
  // overdraw of a few hundred overlapping quads off the blend pipeline.
  if (texel.a < 0.02) discard;

  // Aerial perspective: far tiles sink toward the void instead of hanging at
  // full brightness, which is what gives the field readable depth.
  vec3 color = texel.rgb * mix(0.28, 1.0, smoothstep(0.04, 0.62, vNear));

  gl_FragColor = vec4(color, texel.a * vAlpha);

  #include <colorspace_fragment>
}
`;
