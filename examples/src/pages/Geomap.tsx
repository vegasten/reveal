/*!
 * Copyright 2021 Cognite AS
 */

import * as THREE from 'three';
import * as GEOTHREE from 'geo-three';
import CameraControls from 'camera-controls';
import { getParamsFromURL } from '../utils/example-helpers';
import { CogniteClient } from '@cognite/sdk';
import * as reveal from '@cognite/reveal/internals';
import React, { useEffect, useRef, useState } from 'react';
import { CanvasWrapper, Loader } from '../components/styled';
import { resizeRendererToDisplaySize } from '../utils/sceneHelpers';
import { AnimationLoopHandler } from '../utils/AnimationLoopHandler';

CameraControls.install({ THREE });

export function Geomap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loadingState, setLoadingState] = useState<reveal.utilities.LoadingState>({ isLoading: false, itemsLoaded: 0, itemsRequested: 0, itemsCulled: 0 });

  // var DEV_BING_API_KEY = "AuViYD_FXGfc3dxc0pNa8ZEJxyZyPq1lwOLPCOydV3f0tlEVH-HKMgxZ9ilcRj-T";
  var DEV_MAPBOX_API_KEY = "pk.eyJ1IjoidGVudG9uZSIsImEiOiJjazBwNHU4eDQwZzE4M2VzOGhibWY5NXo5In0.8xpF1DEcT6Y4000vNhjj1g";
  // var OPEN_MAP_TILES_SERVER_MAP = "";

  useEffect(() => {
    let revealManager: reveal.RevealManager<unknown>;
    const animationLoopHandler: AnimationLoopHandler = new AnimationLoopHandler();
    async function main() {
      if (!canvas.current) {
        return;
      }
      const { project, modelUrl, modelRevision } = getParamsFromURL({
        project: 'publicdata',
        modelUrl: 'primitives',
      });
      const client = new CogniteClient({ appId: 'reveal.example.geomap' });
      client.loginWithOAuth({ project });

      const renderer = new THREE.WebGLRenderer({
        canvas: canvas.current,
      });
      renderer.setClearColor('#444');
      renderer.setPixelRatio(window.devicePixelRatio);

      const scene = new THREE.Scene();

      var map = new GEOTHREE.MapView(GEOTHREE.MapView.PLANAR, new GEOTHREE.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox/satellite-streets-v10", GEOTHREE.MapBoxProvider.STYLE, "jpg70"),
        new GEOTHREE.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox.terrain-rgb", GEOTHREE.MapBoxProvider.MAP_ID, "pngraw"));
		  scene.add(map);
		  map.updateMatrixWorld(true);

      let model: reveal.CadNode;
      if (modelRevision) {
        revealManager = reveal.createCdfRevealManager(client, renderer, scene, { logMetrics: false });
        model = await revealManager.addModel('cad', modelRevision);
      } else if (modelUrl) {
        revealManager = reveal.createLocalRevealManager(renderer, scene, { logMetrics: false });
        model = await revealManager.addModel('cad', modelUrl);
      } else {
        throw new Error(
          'Need to provide either project & model OR modelUrl as query parameters'
        );
      }

      revealManager.on('loadingStateChanged', setLoadingState);

      scene.add(model);

      const matrix = model.getModelTransformation();
      var coords = GEOTHREE.UnitsUtils.datumsToSpherical(59.90526172119701, 10.626304236857035);
      const newMatrix = matrix.setPosition(new THREE.Vector3(coords.x, 0, -coords.y));
      model.setModelTransformation(newMatrix);

      const { position, target, near, far } = model.suggestCameraConfig();
      const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 100000000.0);
      const controls = new CameraControls(camera, renderer.domElement);
      controls.setLookAt(
        position.x,
        position.y,
        position.z,
        target.x,
        target.y,
        target.z
      );

      controls.update(0.0);
      camera.updateMatrixWorld();
      revealManager.update(camera);

      animationLoopHandler.setOnAnimationFrameListener(async (deltaTime: number) => {
        let needsResize = resizeRendererToDisplaySize(renderer, camera);
        const controlsNeedUpdate = controls.update(deltaTime);
        if (controlsNeedUpdate) {
          revealManager.update(camera);
        }

        if (controlsNeedUpdate || revealManager.needsRedraw || needsResize) {
          renderer.render(scene, camera);
          revealManager.resetRedraw();
        }
      });
      animationLoopHandler.start();

      (window as any).scene = scene;
      (window as any).THREE = THREE;
      (window as any).camera = camera;
      (window as any).controls = controls;
      (window as any).renderer = renderer;
    }

    main();

    return () => {
      revealManager?.dispose();
      animationLoopHandler.dispose();
    };
  }, []);
  const { isLoading, itemsLoaded, itemsRequested } = loadingState;
  return (
    <CanvasWrapper>
      <Loader isLoading={isLoading} style={{ position: 'absolute' }}>
        Downloading {itemsLoaded} / {itemsRequested} sectors.
      </Loader>
      <canvas ref={canvas} />
    </CanvasWrapper>
  );
}
