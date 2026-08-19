export const starsFragmentShader = /* glsl */ `
uniform vec3 uColorBase;
uniform vec3 uColorAccent;

varying float vAlpha;
varying float vAccent;

void main() {
  vec2 offset = gl_PointCoord - 0.5;
  float d2 = dot(offset, offset);
  if (d2 > 0.25) discard;

  float edge = smoothstep(0.25, 0.02, d2);
  vec3 color = mix(uColorBase, uColorAccent, vAccent);

  gl_FragColor = vec4(color, edge * vAlpha);

  #include <colorspace_fragment>
}
`;
