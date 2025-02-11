/*!
 * Copyright 2021 Cognite AS
 */
import * as Potree from '@cognite/potree-core';

import { PotreeNodeWrapper } from './PotreeNodeWrapper';

import { PointCloudMetadata } from './PointCloudMetadata';

import { HttpHeadersProvider } from '@reveal/modeldata-api';

export class PointCloudFactory {
  private readonly _httpHeadersProvider: HttpHeadersProvider;

  constructor(httpHeadersProvider: HttpHeadersProvider) {
    this._httpHeadersProvider = httpHeadersProvider;
  }

  createModel(modelMetadata: PointCloudMetadata): PotreeNodeWrapper {
    this.initializePointCloudXhrRequestHeaders();
    const { modelBaseUrl, scene } = modelMetadata;
    const geometry = new Potree.PointCloudEptGeometry(modelBaseUrl + '/', scene);
    const x = geometry.offset.x;
    const y = geometry.offset.y;
    const z = geometry.offset.z;
    const root = new Potree.PointCloudEptGeometryNode(geometry, geometry.boundingBox, 0, x, y, z);
    geometry.root = root;
    geometry.root.load();

    const octtree = new Potree.PointCloudOctree(geometry);
    octtree.name = `PointCloudOctree: ${modelBaseUrl}`;
    const node = new PotreeNodeWrapper(octtree);
    return node;
  }

  private initializePointCloudXhrRequestHeaders() {
    const clientHeaders = this._httpHeadersProvider.headers;
    let xhrHeaders: { header: string; value: string }[] = Potree.XHRFactory.config.customHeaders;
    for (const [header, value] of Object.entries(clientHeaders)) {
      xhrHeaders = xhrHeaders.filter(x => x.header !== header);
      xhrHeaders.push({ header, value });
    }
    Potree.XHRFactory.config.customHeaders = xhrHeaders.filter(x => x.header);
  }
}
