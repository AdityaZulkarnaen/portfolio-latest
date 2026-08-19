export const starsVertexShader = /* glsl */ `
uniform float uTime;
uniform vec2  uExtent;     // half-size of the field at z = 0, in world units
uniform vec2  uParallax;   // damped pointer offset, world units
uniform float uCamZ;       // camera distance, for per-depth perspective fit
uniform float uScrollVel;
uniform float uDispersion;
uniform float uSize;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uMotion;     // 0 disables all animation (reduced motion)

attribute float aDepth;    // 0 = far, 1 = near
attribute float aSeed;
attribute float aAccent;   // 0 or 1

varying float vAlpha;
varying float vAccent;

void main() {
  // 1. Kecepatan bintang melesat mendekati layar (sesuaikan angkanya)
  float speed = 0.15;
  
  // fract() membuat nilai terus berulang dari 0 ke 1. 
  // 1 artinya bintang sudah tepat di depan "mata" (kamera).
  float movingDepth = fract(aDepth + (uTime * speed * uMotion));

  // 2. Mapping Z dari sangat jauh di belakang (-15.0) sampai tepat di lensa kamera (uCamZ)
  // Semakin dekat nilai Z ke kamera, proyeksi 3D akan otomatis melempar partikel
  // ke arah tepi layar (efek warp speed).
  float z = mix(-15.0, uCamZ - 0.1, movingDepth);

  // 3. Gunakan posisi X dan Y asli.
  float x = position.x;
  float y = position.y;

  // 4. Kita tidak lagi menggunakan variabel 'fit'.
  // Kita kalikan posisi dengan uExtent dan faktor yang besar (misal 5.0) 
  // agar ruang lahirnya bintang lebih luas dan memenuhi seluruh layar.
  vec2 world = vec2(x, y) * uExtent * 5.0;

  // Parallax: Semakin dekat (movingDepth mendekati 1.0), semakin responsif terhadap mouse
  world += uParallax * mix(0.1, 1.5, movingDepth);
  world.y += uScrollVel * 0.12 * movingDepth;

  vec4 mvPosition = modelViewMatrix * vec4(world, z, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // 5. Ukuran bintang membesar drastis saat mendekati layar
  gl_PointSize = clamp(
    uSize * uPixelRatio * mix(0.2, 3.0, movingDepth) / max(-mvPosition.z, 0.001),
    1.0,
    15.0 * uPixelRatio
  );

  float twinkle = mix(
    1.0,
    0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.5) + aSeed * 20.0),
    uMotion
  );

  // 6. Transisi halus (Fade)
  // Mencegah bintang tiba-tiba 'pop in' di kejauhan, dan 'pop out' secara kasar 
  // tepat sebelum dia ter-reset saat menyentuh layar.
  float depthFade = smoothstep(0.0, 0.1, movingDepth) * (1.0 - smoothstep(0.85, 1.0, movingDepth));
  
  // Opacity semakin tebal saat bintang makin dekat
  vAlpha = mix(0.1, 1.0, movingDepth) * twinkle * uOpacity * depthFade * (1.0 - uDispersion * 0.45);
  vAccent = aAccent;
}
`;