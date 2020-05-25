/*!
 * Copyright 2020 Cognite AS
 */
import * as THREE from 'three';

import { OrderSectorsByVisibilityCoverage } from '@/dataModels/cad/internal/sector/culling/OrderSectorsByVisibilityCoverage';
import { ByVisibilityGpuSectorCuller } from '@/dataModels/cad/internal/sector/culling/ByVisibilityGpuSectorCuller';
import { CadModelMetadata } from '@/dataModels/cad/internal';
import { SectorMetadata } from '@/dataModels/cad/internal/sector/types';
import { LevelOfDetail } from '@/dataModels/cad/internal/sector/LevelOfDetail';
import { MaterialManager } from '@/dataModels/cad/internal/MaterialManager';
import { CadNode } from '@/dataModels/cad/internal/CadNode';
import { DetermineSectorsInput } from '@/dataModels/cad/internal/sector/culling/types';

import { generateSectorTree } from '../testUtils/createSectorMetadata';
import { createCadModelMetadata } from '../testUtils/createCadModelMetadata';

type PropType<TObj, TProp extends keyof TObj> = TObj[TProp];

describe('ByVisibilityGpuSectorCuller', () => {
  const materialManager = new MaterialManager();
  const setModelsMock: PropType<OrderSectorsByVisibilityCoverage, 'setModels'> = jest.fn();
  const orderSectorsByVisibilityMock: PropType<
    OrderSectorsByVisibilityCoverage,
    'orderSectorsByVisibility'
  > = jest.fn();

  const coverageUtil: OrderSectorsByVisibilityCoverage = {
    setModels: setModelsMock,
    orderSectorsByVisibility: c => {
      orderSectorsByVisibilityMock(c);
      return [];
    }
  };
  const camera = new THREE.PerspectiveCamera();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('determineSectors sets models to coverage utility', () => {
    const culler = new ByVisibilityGpuSectorCuller({ coverageUtil });
    const model = createCadModelMetadata(generateSectorTree(1));
    const input = createDetermineSectorInput(camera, model);
    culler.determineSectors(input);
    expect(setModelsMock).toBeCalled();
  });

  test('determineSectors returns sectors for all models', () => {
    // Arrange
    const culler = new ByVisibilityGpuSectorCuller({ coverageUtil });
    const model1 = createCadModelMetadata(generateSectorTree(1));
    const model2 = createCadModelMetadata(generateSectorTree(1));
    const input = createDetermineSectorInput(camera, [model1, model2]);

    // Act
    const sectors = culler.determineSectors(input);

    // Assert
    expect(orderSectorsByVisibilityMock).toBeCalledTimes(1); // Only render scene once
    const sectors1 = sectors.filter(x => x.scene === model1.scene);
    const sectors2 = sectors.filter(x => x.scene === model2.scene);
    expect(sectors1).not.toBeEmpty();
    expect(model1.scene.getAllSectors()).toContainAllValues(sectors1.map(x => x.metadata));
    expect(sectors2).not.toBeEmpty();
    expect(model2.scene.getAllSectors()).toContainAllValues(sectors2.map(x => x.metadata));
  });

  test('determineSectors returns sector from coverage utility by priority', () => {
    // Arrange
    const determineSectorCost = (sector: SectorMetadata, lod: LevelOfDetail) => {
      switch (lod) {
        case LevelOfDetail.Detailed:
          return [10, 10, 100][sector.id];
        case LevelOfDetail.Simple:
          return 1;
        default:
          return 0;
      }
    };
    const culler = new ByVisibilityGpuSectorCuller({ coverageUtil, determineSectorCost, costLimit: 20 });
    const model = createCadModelMetadata(generateSectorTree(2, 2));
    const cadNode = new CadNode(model, materialManager);
    Object.defineProperty(cadNode, 'cadModel', { get: jest.fn().mockReturnValue(model) });
    // culler.(model);
    coverageUtil.orderSectorsByVisibility = () => {
      return [
        { model, sectorId: 0, priority: 1000.0 },
        { model, sectorId: 1, priority: 100.0 },
        { model, sectorId: 2, priority: 10.0 }
      ];
    };
    // Place camera far away to avoid sectors being loaded because camera is near them
    camera.position.set(1000, 1000, 1000);
    const input = createDetermineSectorInput(camera, model);

    // Act
    const sectors = culler.determineSectors(input);

    // Assert
    expect(sectors.filter(x => x.levelOfDetail === LevelOfDetail.Detailed).map(x => x.metadata.id)).toEqual([0, 1]);
    expect(sectors.filter(x => x.levelOfDetail === LevelOfDetail.Simple).map(x => x.metadata.id)).toEqual([2]);
  });
});

function createDetermineSectorInput(
  camera: THREE.PerspectiveCamera,
  models: CadModelMetadata | CadModelMetadata[]
): DetermineSectorsInput {
  const determineSectorsInput: DetermineSectorsInput = {
    camera,
    clippingPlanes: [],
    cadModelsMetadata: Array.isArray(models) ? models : [models],
    loadingHints: {}
  };
  return determineSectorsInput;
}
