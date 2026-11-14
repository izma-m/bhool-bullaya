// Opening scene: the original Jugnoo on his dewy leaf under a vivid night sky.
import * as THREE from 'three';
import { makeJug } from './models.js';
const clamp = THREE.MathUtils.clamp;

export function createMenu() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  scene.background = new THREE.Color(0x160a4a);
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; scene.add(root);
  const J = makeJug(); root.add(J.jug);

  const lf = (x, yn) => { const w = 1.9 * Math.sqrt(Math.max(0, 1 - (x / 3.4) * (x / 3.4))); return { y: yn * w, z: 0.28 * yn * yn * (w / 1.9) + 0.07 * (x / 3.4) * (x / 3.4) }; };
  const lg = new THREE.PlaneGeometry(7, 4.4, 40, 24), pos = lg.attributes.position, col = [], a = new THREE.Color(0x1fc24a), b = new THREE.Color(0x9cff6a), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = clamp(pos.getX(i), -3.4, 3.4), yn = pos.getY(i) / 2.2, o = lf(x, yn); pos.setXYZ(i, x, o.y, o.z); cc.copy(a).lerp(b, 1 - Math.abs(yn)); col.push(cc.r, cc.g, cc.b); }
  lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); lg.rotateX(-Math.PI / 2); lg.computeVertexNormals();
  root.add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide })));
  const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.4 });
  const shine = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
  [[-1.6, 0.3, 0.2], [-2.3, -0.2, 0.15], [1.7, -0.35, 0.24], [2.4, 0.1, 0.14], [0.9, 0.6, 0.18], [-0.6, -0.55, 0.2]].forEach((d) => {
    const o = lf(d[0], d[1]), s = new THREE.Mesh(new THREE.SphereGeometry(d[2], 16, 12), dm); s.scale.y = 0.5; s.position.set(d[0], o.z + 0.03, -o.y); root.add(s);
    const h = new THREE.Mesh(new THREE.SphereGeometry(d[2] * 0.25, 8, 6), shine); h.position.set(d[0] + d[2] * 0.3, o.z + d[2] * 0.45, -o.y - d[2] * 0.3); root.add(h); });
  const sa = []; for (let i = 0; i < 260; i++) sa.push((Math.random() - 0.5) * 34, Math.random() * 14 - 1, -6 - Math.random() * 12);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sa, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x7aff9a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3, 7, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xff8af0, 0.9); fill.position.set(-4, 2, -2); scene.add(fill);

  let mx = 0, my = 0, waveT = -9;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
  return {
    scene, camera,
    wave(t) { if (t - waveT > 2.4) waveT = t; },
    resize(aspect) { camera.aspect = aspect; camera.position.set(0, 2.4, aspect < 1 ? 11 : 7.4); camera.lookAt(0, 0.9, 0); camera.updateProjectionMatrix(); },
    update(t) {
      root.rotation.y = -0.55 + Math.sin(t * 0.3) * 0.3;
      J.head.rotation.y += (mx * 0.5 - J.head.rotation.y) * 0.08; J.head.rotation.x += (my * 0.3 - J.head.rotation.x) * 0.08;
      J.idle(t, t - waveT < 2.2 || t % 9 > 7.2);
    },
  };
}
