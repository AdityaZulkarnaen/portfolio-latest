export const particlesFragmentShader = /* glsl */ `
uniform vec3  uColorBase;
uniform vec3  uColorAccent;
uniform float uOpacity;

varying float vAccent;
varying float vAlpha;

void main() {
  // Soft round sprite from the point quad — no texture upload needed.
  vec2 offset = gl_PointCoord - 0.5;
  float d2 = dot(offset, offset);
  if (d2 > 0.25) discard;

  float edge = smoothstep(0.25, 0.05, d2);
  vec3 color = mix(uColorBase, uColorAccent, vAccent);

  gl_FragColor = vec4(color, edge * vAlpha * uOpacity);

  // ShaderMaterial opts out of three's automatic output conversion, and
  // THREE.Color already converted our hex to the linear working space — so
  // without this the accent would render visibly wrong.
  #include <colorspace_fragment>
}
`;
