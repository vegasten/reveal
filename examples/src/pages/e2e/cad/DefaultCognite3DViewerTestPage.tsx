/*!
 * Copyright 2021 Cognite AS
 */

import { Cognite3DViewer } from '@cognite/reveal';
import React from 'react';
import * as THREE from 'three';
import { registerVisualTest } from '../../../visual_tests';

import { Cognite3DTestViewer } from '../Cognite3DTestViewer';

function DefaultCognite3DViewerTestPage() {
  const modelUrl = 'primitives';
  
  return <Cognite3DTestViewer modelUrls={[modelUrl]} initializeCallback={(viewer:Cognite3DViewer) => {
    viewer.cameraManager.setCameraState({position: new THREE.Vector3(30,10,50), 
      target: new THREE.Vector3()});
  }}/>;
}

registerVisualTest('cad', 'default-cognite3dviewer', 'Default Cognite3DViewer', <DefaultCognite3DViewerTestPage />)
