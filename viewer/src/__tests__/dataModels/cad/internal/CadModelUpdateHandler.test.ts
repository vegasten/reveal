/*!
 * Copyright 2020 Cognite AS
 */

import * as THREE from 'three';

import { CadNode } from '@cognite/reveal/datamodels/cad';
import { MaterialManager } from '@cognite/reveal/datamodels/cad/MaterialManager';
import { CadSectorParser } from '@cognite/reveal/datamodels/cad/sector/CadSectorParser';
import { SimpleAndDetailedToSector3D } from '@cognite/reveal/datamodels/cad/sector/SimpleAndDetailedToSector3D';
import { CachedRepository } from '@cognite/reveal/datamodels/cad/sector/CachedRepository';
import { SectorCuller } from '@cognite/reveal/datamodels/cad/sector/culling/SectorCuller';

import { createCadModelMetadata } from '../../../testutils/createCadModelMetadata';
import { generateSectorTree } from '../../../testutils/createSectorMetadata';
import { CadModelUpdateHandler } from '@cognite/reveal/datamodels/cad/CadModelUpdateHandler';
import { BinaryFileProvider } from '@cognite/reveal/utilities/networking/types';

describe('CadModelUpdateHandler', () => {
  const modelSectorProvider: BinaryFileProvider = {
    getBinaryFile: jest.fn()
  };
  const materialManager = new MaterialManager();
  const modelDataParser = new CadSectorParser();
  const modelDataTransformer = new SimpleAndDetailedToSector3D(materialManager);
  const repository = new CachedRepository(modelSectorProvider, modelDataParser, modelDataTransformer);
  const mockCuller: SectorCuller = {
    determineSectors: jest.fn(),
    dispose: jest.fn()
  };

  const cadModelMetadata = createCadModelMetadata(generateSectorTree(5));
  const cadModel = new CadNode(cadModelMetadata, materialManager);

  jest.useFakeTimers();

  // TODO: 24-07-2020 j-bjorne skipped until pipeline split from update handler.
  test.skip('updateCamera(), updateLoadingHints() and updateClipPlanes() triggers SectorCuller.determineSectors()', () => {
    const updateHandler = new CadModelUpdateHandler(repository, mockCuller);
    // TODO: 16-07-2020 j-bjorne reimplement tests when update handler has been separated from loading pipeline.
    updateHandler.consumedSectorObservable().subscribe();
    updateHandler.updateModels(cadModel);
    updateHandler.updateCamera(new THREE.PerspectiveCamera());
    jest.advanceTimersByTime(2000);
    expect(mockCuller.determineSectors).toBeCalledTimes(1);
    updateHandler.clippingPlanes = [new THREE.Plane()];
    jest.advanceTimersByTime(1000);
    expect(mockCuller.determineSectors).toBeCalledTimes(2);
    updateHandler.clipIntersection = true;
    jest.advanceTimersByTime(1000);
    expect(mockCuller.determineSectors).toBeCalledTimes(3);
    updateHandler.updateLoadingHints({});
    jest.advanceTimersByTime(1000);
    expect(mockCuller.determineSectors).toBeCalledTimes(4);
  });

  test('dipose() disposes culler', () => {
    const updateHandler = new CadModelUpdateHandler(repository, mockCuller);
    updateHandler.dispose();
    expect(mockCuller.dispose).toBeCalledTimes(1);
  });
});
