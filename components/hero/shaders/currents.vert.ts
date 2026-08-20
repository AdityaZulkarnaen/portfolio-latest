/**
 * Nothing to do but hand the fragment shader a UV. The entire image is a
 * fragment program — there is no geometry to speak of, just the quad it runs on.
 */
export const currentsVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
