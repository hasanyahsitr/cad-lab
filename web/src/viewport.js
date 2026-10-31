import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createViewport(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minDistance = 1;
  controls.maxDistance = 16000;
  scene.add(new THREE.HemisphereLight(0xd7eefc, 0x31404a, 2.7));
  const key = new THREE.DirectionalLight(0xfff7de, 3.5);
  key.position.set(50, -80, 150);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x92c6ff, 1.6);
  fill.position.set(-80, 100, 60);
  scene.add(fill);
  const grid = new THREE.GridHelper(300, 30, 0x4b6571, 0x344d5b);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.15;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  scene.add(grid);
  let model = null;
  let dimensions = null;
  let renderQueued = false;

  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderer.render(scene, camera);
    });
  }
  controls.addEventListener('change', render);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(resize).observe(container);

  function fit(view = 'iso') {
    if (!dimensions) return;
    const { width, depth, thickness } = dimensions;
    const center = new THREE.Vector3(width / 2, depth / 2, thickness / 2);
    const radius = Math.hypot(width, depth, thickness) / 2;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalFov = Math.atan(Math.tan(halfFov) * camera.aspect);
    const distance = (radius / Math.sin(Math.min(halfFov, horizontalFov))) * 1.22;
    camera.near = Math.max(0.01, distance / 1000);
    camera.far = Math.max(10000, distance * 20);
    camera.updateProjectionMatrix();
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(...(view === 'top' ? [0, -0.0001, 1] : [1.1, -1.4, 1.15]))
          .normalize()
          .multiplyScalar(distance),
      );
    controls.target.copy(center);
    controls.maxDistance = Math.max(16000, distance * 5);
    controls.update();
    render();
  }

  function setModel(mesh, parameters) {
    const geometry = new THREE.BufferGeometry();
    // Unindexed triangles preserve sharp face normals and smooth silhouette edges.
    const flat = mesh.triangles.flatMap((triangle) =>
      triangle.flatMap((index) => mesh.vertices[index]),
    );
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
    geometry.computeVertexNormals();
    const next = new THREE.Group();
    next.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xc1d0db,
          roughness: 0.38,
          metalness: 0.35,
          side: THREE.DoubleSide,
        }),
      ),
    );
    next.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 25),
        new THREE.LineBasicMaterial({ color: 0x526c7d, transparent: true, opacity: 0.85 }),
      ),
    );
    if (model) {
      scene.remove(model);
      model.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
    }
    model = next;
    scene.add(model);
    dimensions = parameters;
    const gridSize = Math.max(parameters.width, parameters.depth) * 3;
    grid.scale.setScalar(gridSize / 300);
    grid.position.set(parameters.width / 2, parameters.depth / 2, -0.15);
    fit();
  }

  container.addEventListener('keydown', (event) => {
    if (!dimensions) return;
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      fit();
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      offset.multiplyScalar(event.key === '-' ? 1.12 : 0.89);
    } else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), event.key === 'ArrowLeft' ? 0.12 : -0.12);
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const axis = new THREE.Vector3().crossVectors(offset, camera.up).normalize();
      offset.applyAxisAngle(axis, event.key === 'ArrowUp' ? 0.1 : -0.1);
    } else return;
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  });
  resize();
  return { setModel, fit };
}
