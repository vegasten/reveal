/*!
 * Copyright 2020 Cognite AS
 */

import * as THREE from 'three';
import { CameraConfiguration } from '@cognite/reveal/utilities';

export interface PointCloudMetadata {
  blobUrl: string;
  modelMatrix: THREE.Matrix4;
  cameraConfiguration?: CameraConfiguration;
  scene: any;
}
