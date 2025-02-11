/*!
 * Copyright 2021 Cognite AS
 */

import { LoadingState } from '@reveal/model-base';
import { RenderOptions } from '@reveal/rendering';
import { InternalRevealCadOptions } from '@reveal/cad-model';

/**
 * @property logMetrics Might be used to disable usage statistics.
 * @property nodeAppearanceProvider Style node by tree-index.
 * @property internal Internals are for internal usage only (like unit-testing).
 */
export type RevealOptions = {
  logMetrics?: boolean;
  renderOptions?: RenderOptions;
  continuousModelStreaming?: boolean;
  internal?: {
    cad?: InternalRevealCadOptions;
  };
};

/**
 * Handler for events about data being loaded.
 */
export type LoadingStateChangeListener = (loadingState: LoadingState) => any;

export {
  PotreePointShape,
  PotreePointColorType,
  PotreePointSizeType,
  WellKnownAsprsPointClassCodes
} from '@reveal/pointclouds';

export * from './migration/types';
