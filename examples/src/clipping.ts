/*!
 * Copyright 2019 Cognite AS
 */

import * as THREE from 'three';
import * as reveal_threejs from '@cognite/reveal/threejs';
import { BoundingBoxClipper } from '@cognite/reveal/threejs';
import CameraControls from 'camera-controls';
import { loadCadModelFromCdfOrUrl, createModelIdentifierFromUrlParams, createClientIfNecessary } from './utils/loaders';
import dat from 'dat.gui';

CameraControls.install({ THREE });

async function main() {
  const urlParams = new URL(location.href).searchParams;
  const modelIdentifier = createModelIdentifierFromUrlParams(urlParams, '/primitives');
  const apiKey = urlParams.get('apiKey');

  const scene = new THREE.Scene();
  const cadModel = await loadCadModelFromCdfOrUrl(
    modelIdentifier,
    await createClientIfNecessary(modelIdentifier, apiKey)
  );

  const params = {
    clipIntersection: true,
    width: 10,
    height: 10,
    depth: 10,
    x: 0,
    y: 0,
    z: 0,
    showHelpers: false
  };

  let planesNeedUpdate = true;

  const boxClipper = new BoundingBoxClipper(
    new THREE.Box3(
      new THREE.Vector3(params.x - params.width / 2, params.y - params.height / 2, params.z - params.depth / 2),
      new THREE.Vector3(params.x + params.width / 2, params.y + params.height / 2, params.z + params.depth / 2)
    ),
    params.clipIntersection
  );

  const cadNode = new reveal_threejs.CadNode(cadModel);
  cadNode.clippingPlanes = boxClipper.clippingPlanes;
  cadNode.clipIntersection = boxClipper.intersection;
  cadNode.renderHints = { showSectorBoundingBoxes: false };
  let sectorsNeedUpdate = true;
  cadNode.addEventListener('update', () => {
    sectorsNeedUpdate = true;
  });
  scene.add(cadNode);

  const renderer = new THREE.WebGLRenderer();
  renderer.localClippingEnabled = true;
  // renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.0)];
  renderer.setClearColor('#444');
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera();
  const { position, target, near, far } = cadNode.suggestCameraConfig();
  camera.near = near;
  camera.far = 3 * far;
  camera.fov = 75;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const controls = new CameraControls(camera, renderer.domElement);
  controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z);
  controls.update(0.0);
  camera.updateMatrixWorld();
  cadNode.update(camera);

  const helpers = new THREE.Group();
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[0], 2, 0xff0000));
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[1], 2, 0xff0000));
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[2], 2, 0x00ff00));
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[3], 2, 0x00ff00));
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[4], 2, 0x0000ff));
  helpers.add(new THREE.PlaneHelper(boxClipper.clippingPlanes[5], 2, 0x0000ff));
  // helpers.visible = false;
  scene.add(helpers);

  const clock = new THREE.Clock();
  const render = async () => {
    const delta = clock.getDelta();
    const controlsNeedUpdate = controls.update(delta);
    if (controlsNeedUpdate) {
      cadNode.update(camera);
    }

    if (controlsNeedUpdate || sectorsNeedUpdate || planesNeedUpdate) {
      renderer.render(scene, camera);
      planesNeedUpdate = false;
      sectorsNeedUpdate = false;
    }

    requestAnimationFrame(render);
  };
  render();

  const gui = new dat.GUI();

  gui
    .add(params, 'clipIntersection')
    .name('clip intersection')
    .onChange(value => {
      cadNode.clipIntersection = value;
      boxClipper.intersection = value;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'x', -600, 600)
    .step(0.1)
    .name('x')
    .onChange(_ => {
      boxClipper.minX = params.x - params.width / 2;
      boxClipper.maxX = params.x + params.width / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'y', -600, 600)
    .step(0.1)
    .name('y')
    .onChange(_ => {
      boxClipper.minY = params.y - params.height / 2;
      boxClipper.maxY = params.y + params.height / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'z', -600, 600)
    .step(0.1)
    .name('z')
    .onChange(_ => {
      boxClipper.minZ = params.z - params.depth / 2;
      boxClipper.maxZ = params.z + params.depth / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'width', 0, 100)
    .step(0.1)
    .name('width')
    .onChange(_ => {
      boxClipper.minX = params.x - params.width / 2;
      boxClipper.maxX = params.x + params.width / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'height', 0, 100)
    .step(0.1)
    .name('height')
    .onChange(_ => {
      boxClipper.minY = params.y - params.height / 2;
      boxClipper.maxY = params.y + params.height / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'depth', 0, 100)
    .step(0.1)
    .name('depth')
    .onChange(_ => {
      boxClipper.minZ = params.z - params.depth / 2;
      boxClipper.maxZ = params.z + params.depth / 2;
      planesNeedUpdate = true;
    });

  gui
    .add(params, 'showHelpers')
    .name('show helpers')
    .onChange(_ => {
      // helpers.visible = value;
      planesNeedUpdate = true;
    });

  (window as any).scene = scene;
  (window as any).THREE = THREE;
  (window as any).camera = camera;
  (window as any).controls = controls;
}

main();
