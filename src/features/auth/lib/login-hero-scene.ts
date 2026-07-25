import * as THREE from "three";

/**
 * A restrained particle/connection-line network for the login hero — evokes
 * a logistics/supply network (glowing nodes, thin drifting connections)
 * without literal radar-sweep/rotating-globe theatrics. Imperative and
 * isolated so `three` is only ever loaded on the login route.
 */

export interface HeroSceneHandle {
  dispose: () => void;
}

const PARTICLE_COUNT = 80;
const SPREAD_X = 16;
const SPREAD_Y = 8;
const MAX_LINE_DISTANCE = 4.2;
const GOLD = 0xf2c14e;
const LINE_BLUE = 0xbcd7ff;

export function createHeroScene(container: HTMLDivElement, reducedMotion: boolean): HeroSceneHandle {
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.z = 18;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities: { x: number; y: number }[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    velocities.push({ x: (Math.random() - 0.5) * 0.006, y: (Math.random() - 0.5) * 0.006 });
  }

  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointsMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(GOLD),
    size: 0.14,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  scene.add(points);

  const lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(LINE_BLUE), transparent: true, opacity: 0.18 });
  const lineGeometry = new THREE.BufferGeometry();
  const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lineSegments);

  function pointAt(index: number): [number, number, number] {
    return [positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!];
  }

  function updateLines() {
    const linePositions: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [ix, iy, iz] = pointAt(i);
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const [jx, jy, jz] = pointAt(j);
        const dx = ix - jx;
        const dy = iy - jy;
        const dz = iz - jz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < MAX_LINE_DISTANCE) {
          linePositions.push(ix, iy, iz, jx, jy, jz);
        }
      }
    }
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  }
  updateLines();
  renderer.render(scene, camera);

  let frameId: number | null = null;
  let frameCount = 0;

  if (!reducedMotion) {
    const animate = () => {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = velocities[i]!;
        positions[i * 3]! += v.x;
        positions[i * 3 + 1]! += v.y;
        if (Math.abs(positions[i * 3]!) > SPREAD_X) v.x *= -1;
        if (Math.abs(positions[i * 3 + 1]!) > SPREAD_Y) v.y *= -1;
      }
      pointsGeometry.attributes.position!.needsUpdate = true;

      frameCount += 1;
      if (frameCount % 4 === 0) updateLines();

      points.rotation.y += 0.0004;
      lineSegments.rotation.y += 0.0004;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
  }

  function handleResize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.render(scene, camera);
  }
  window.addEventListener("resize", handleResize);

  return {
    dispose() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
