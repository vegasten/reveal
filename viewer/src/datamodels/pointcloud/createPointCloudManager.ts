/*!
 * Copyright 2020 Cognite AS
 */

import { PointCloudManager } from './PointCloudManager';
import { PointCloudMetadataRepository } from './PointCloudMetadataRepository';
import { CdfModelDataClient } from '@cognite/reveal/utilities/networking/CdfModelDataClient';
import { LocalModelDataClient } from '@cognite/reveal/utilities/networking/LocalModelDataClient';
import { PointCloudFactory } from './PointCloudFactory';
import { CdfModelIdentifier, LocalModelIdentifier, ModelDataClient } from '@cognite/reveal/utilities/networking/types';

export function createLocalPointCloudManager(client: LocalModelDataClient): PointCloudManager<LocalModelIdentifier> {
  return createPointCloudManager(client);
}
export function createCdfPointCloudManager(client: CdfModelDataClient): PointCloudManager<CdfModelIdentifier> {
  return createPointCloudManager(client);
}

export function createPointCloudManager<T>(client: ModelDataClient<T>): PointCloudManager<T> {
  const metadataRepository = new PointCloudMetadataRepository(client);
  const modelFactory = new PointCloudFactory(client);
  return new PointCloudManager(metadataRepository, modelFactory);
}
