/*!
 * Copyright 2021 Cognite AS
 */

import * as THREE from 'three';

import { DynamicDefragmentedBuffer } from '../../utilities/datastructures/dynamicDefragmentedBuffer';
import { MaterialManager } from './MaterialManager';
import { InstancedMesh, InstancedMeshFile } from './rendering/types';

export class InstancedMeshManager {
  private readonly _instancedGeometryMap: Map<
    number,
    { vertices: THREE.Float32BufferAttribute; indices: THREE.Uint32BufferAttribute }
  >;

  private readonly _instancedAttributeMap: Map<
    string,
    {
      mesh: THREE.InstancedMesh;
      treeIndexBuffer: DynamicDefragmentedBuffer<Float32Array>;
      colorBuffer: DynamicDefragmentedBuffer<Uint8Array>;
      instanceMatrixBuffer: DynamicDefragmentedBuffer<Float32Array>;
      updateAttributes: () => void;
    }
  >;

  private readonly _processedSectorMap: Map<
    number,
    { instanceIdentifier: string; treeIndicesbatchId: number; colorsBatchId: number; instanceMatricesBatchId: number }[]
  >;

  private readonly _instancedMeshGroup: THREE.Group;
  private readonly _materialManager: MaterialManager;

  constructor(instancedMeshGroup: THREE.Group, materialManager: MaterialManager) {
    this._materialManager = materialManager;

    this._instancedGeometryMap = new Map();
    this._instancedAttributeMap = new Map();

    this._processedSectorMap = new Map();

    this._instancedMeshGroup = instancedMeshGroup;
  }

  public addInstanceMeshes(meshFile: InstancedMeshFile, modelIdentifier: string, sectorId: number) {
    if (this._processedSectorMap.has(sectorId)) {
      return;
    }

    if (!this._instancedGeometryMap.has(meshFile.fileId)) {
      this._instancedGeometryMap.set(meshFile.fileId, {
        vertices: new THREE.Float32BufferAttribute(meshFile.vertices.buffer, 3),
        indices: new THREE.Uint32BufferAttribute(meshFile.indices.buffer, 1)
      });
    }

    const geometryAttributes = this._instancedGeometryMap.get(meshFile.fileId)!;
    const material = this._materialManager.getModelMaterials(modelIdentifier).instancedMesh;

    for (const instance of meshFile.instances) {
      const instanceIdentifier = JSON.stringify([meshFile.fileId, instance.triangleOffset]);

      if (!this._instancedAttributeMap.has(instanceIdentifier)) {
        this.createInstance(instance, geometryAttributes, material, instanceIdentifier, sectorId);
      } else {
        const currentAttributes = this._instancedAttributeMap.get(instanceIdentifier)!;

        const treeAdd = currentAttributes.treeIndexBuffer.add(instance.treeIndices);
        const colorAdd = currentAttributes.colorBuffer.add(instance.colors);
        const matrixAdd = currentAttributes.instanceMatrixBuffer.add(instance.instanceMatrices);
        currentAttributes.updateAttributes();

        this.addBatchDescriptor(instanceIdentifier, treeAdd.batchId, colorAdd.batchId, matrixAdd.batchId, sectorId);

        currentAttributes.mesh.count = currentAttributes.treeIndexBuffer.length;

        if (treeAdd.bufferIsReallocated || colorAdd.bufferIsReallocated || matrixAdd.bufferIsReallocated) {
          this.recreateBufferGeometry(geometryAttributes, currentAttributes, instance, instanceIdentifier);
        }
      }
    }
  }

  public removeSectorInstancedMeshes(sectorId: number) {
    const sectorBatchDescriptors = this._processedSectorMap.get(sectorId);

    if (!sectorBatchDescriptors) {
      return;
    }

    for (const sectorBatchDescriptor of sectorBatchDescriptors) {
      const attributeBuffers = this._instancedAttributeMap.get(sectorBatchDescriptor.instanceIdentifier);

      if (attributeBuffers === undefined) {
        throw new Error(`Cannot resolve instance identifier for sector ${sectorId}`);
      }

      attributeBuffers.treeIndexBuffer.remove(sectorBatchDescriptor.treeIndicesbatchId);
      attributeBuffers.colorBuffer.remove(sectorBatchDescriptor.colorsBatchId);
      attributeBuffers.instanceMatrixBuffer.remove(sectorBatchDescriptor.instanceMatricesBatchId);

      attributeBuffers.updateAttributes();
      attributeBuffers.mesh.count = attributeBuffers.treeIndexBuffer.length;
    }

    this._processedSectorMap.delete(sectorId);
  }

  private createInstancedBufferGeometry(
    vertices: THREE.Float32BufferAttribute,
    indices: THREE.Uint32BufferAttribute,
    treeIndexBuffer: DynamicDefragmentedBuffer<Float32Array>,
    colorBuffer: DynamicDefragmentedBuffer<Uint8Array>,
    instanceMatrixBuffer: DynamicDefragmentedBuffer<Float32Array>
  ): [THREE.InstancedBufferGeometry, () => void] {
    const instanceGeometry = new THREE.InstancedBufferGeometry();

    instanceGeometry.setIndex(indices);
    instanceGeometry.setAttribute('position', vertices);

    const treeIndexAttribute = new THREE.InstancedBufferAttribute(treeIndexBuffer.buffer, 1);
    instanceGeometry.setAttribute('a_treeIndex', treeIndexAttribute);

    const colorAttribute = new THREE.InstancedBufferAttribute(colorBuffer.buffer, 4, true);
    instanceGeometry.setAttribute('a_color', colorAttribute);

    const instanceMatrixInterleavedBuffer = new THREE.InstancedInterleavedBuffer(instanceMatrixBuffer.buffer, 16);
    for (let column = 0; column < 4; column++) {
      const attribute = new THREE.InterleavedBufferAttribute(instanceMatrixInterleavedBuffer, 4, column * 4);
      instanceGeometry.setAttribute(`a_instanceMatrix_column_${column}`, attribute);
    }

    const updateAttributes = () => {
      treeIndexAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      instanceMatrixInterleavedBuffer.needsUpdate = true;
    };

    return [instanceGeometry, updateAttributes];
  }

  private recreateBufferGeometry(
    geometryAttributes: { vertices: THREE.Float32BufferAttribute; indices: THREE.Uint32BufferAttribute },
    currentAttributes: {
      mesh: THREE.InstancedMesh;
      treeIndexBuffer: DynamicDefragmentedBuffer<Float32Array>;
      colorBuffer: DynamicDefragmentedBuffer<Uint8Array>;
      instanceMatrixBuffer: DynamicDefragmentedBuffer<Float32Array>;
      updateAttributes: () => void;
    },
    instance: InstancedMesh,
    instanceIdentifier: string
  ) {
    const bufferGeometry = this.createInstancedBufferGeometry(
      geometryAttributes.vertices,
      geometryAttributes.indices,
      currentAttributes.treeIndexBuffer,
      currentAttributes.colorBuffer,
      currentAttributes.instanceMatrixBuffer
    );

    bufferGeometry[0].setDrawRange(instance.triangleOffset * 3, instance.triangleCount * 3);

    currentAttributes.mesh.geometry.dispose();

    currentAttributes.mesh.geometry = bufferGeometry[0];

    currentAttributes.mesh.count = currentAttributes.treeIndexBuffer.length;

    this._instancedAttributeMap.set(instanceIdentifier, {
      mesh: currentAttributes.mesh,
      treeIndexBuffer: currentAttributes.treeIndexBuffer,
      colorBuffer: currentAttributes.colorBuffer,
      instanceMatrixBuffer: currentAttributes.instanceMatrixBuffer,
      updateAttributes: bufferGeometry[1]
    });
  }

  private createInstance(
    instance: InstancedMesh,
    geometryAttributes: { vertices: THREE.Float32BufferAttribute; indices: THREE.Uint32BufferAttribute },
    material: THREE.ShaderMaterial,
    instanceIdentifier: string,
    sectorId: number
  ) {
    const dynamicTreeIndicesBuffer = new DynamicDefragmentedBuffer<Float32Array>(
      instance.treeIndices.length,
      Float32Array
    );
    const treeIndicesAdd = dynamicTreeIndicesBuffer.add(instance.treeIndices);

    const dynamicColorsBuffer = new DynamicDefragmentedBuffer<Uint8Array>(instance.colors.length, Uint8Array);
    const colorsAdd = dynamicColorsBuffer.add(instance.colors);

    const dynamicinstanceMatricesBuffer = new DynamicDefragmentedBuffer<Float32Array>(
      instance.instanceMatrices.length,
      Float32Array
    );
    const instanceMatricesAdd = dynamicinstanceMatricesBuffer.add(instance.instanceMatrices);

    this.addBatchDescriptor(
      instanceIdentifier,
      treeIndicesAdd.batchId,
      colorsAdd.batchId,
      instanceMatricesAdd.batchId,
      sectorId
    );

    const instanceGeometry = this.createInstancedBufferGeometry(
      geometryAttributes.vertices,
      geometryAttributes.indices,
      dynamicTreeIndicesBuffer,
      dynamicColorsBuffer,
      dynamicinstanceMatricesBuffer
    );

    instanceGeometry[0].setDrawRange(instance.triangleOffset * 3, instance.triangleCount * 3);

    const instanceMesh = new THREE.InstancedMesh(instanceGeometry[0], material, dynamicTreeIndicesBuffer.length);

    instanceMesh.frustumCulled = false;

    this._instancedAttributeMap.set(instanceIdentifier, {
      mesh: instanceMesh,
      treeIndexBuffer: dynamicTreeIndicesBuffer,
      colorBuffer: dynamicColorsBuffer,
      instanceMatrixBuffer: dynamicinstanceMatricesBuffer,
      updateAttributes: instanceGeometry[1]
    });

    this._instancedMeshGroup.add(instanceMesh);

    instanceMesh.updateMatrixWorld(true);
  }

  private addBatchDescriptor(
    instanceIdentifier: string,
    treeIndicesBatchId: number,
    colorsBatchId: number,
    instanceMatricesBatchId: number,
    sectorId: number
  ) {
    const batchDescriptor: {
      instanceIdentifier: string;
      treeIndicesbatchId: number;
      colorsBatchId: number;
      instanceMatricesBatchId: number;
    } = {
      instanceIdentifier: instanceIdentifier,
      treeIndicesbatchId: treeIndicesBatchId,
      colorsBatchId: colorsBatchId,
      instanceMatricesBatchId: instanceMatricesBatchId
    };

    const descriptorList = this._processedSectorMap.get(sectorId);

    if (!descriptorList) {
      this._processedSectorMap.set(sectorId, [batchDescriptor]);
    } else {
      descriptorList.push(batchDescriptor);
    }
  }
}
