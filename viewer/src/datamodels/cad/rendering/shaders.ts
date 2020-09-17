/*!
 * Copyright 2020 Cognite AS
 */

import simpleFrag from '@/glsl/sector/simple.frag';
import simpleVert from '@/glsl/sector/simple.vert';
import meshFrag from '@/glsl/sector/mesh.frag';
import meshVert from '@/glsl/sector/mesh.vert';
import instancedMeshFrag from '@/glsl/sector/instancedMesh.frag';
import instancedMeshVert from '@/glsl/sector/instancedMesh.vert';
import instancedFrag from '@/glsl/sector/primitives/instanced.frag';
import instancedVert from '@/glsl/sector/primitives/instanced.vert';
import circleFrag from '@/glsl/sector/primitives/circle.frag';
import circleVert from '@/glsl/sector/primitives/circle.vert';
import coneFrag from '@/glsl/sector/primitives/cone.frag';
import coneVert from '@/glsl/sector/primitives/cone.vert';
import eccentricConeFrag from '@/glsl/sector/primitives/eccentricCone.frag';
import eccentricConeVert from '@/glsl/sector/primitives/eccentricCone.vert';
import ellipsoidSegmentFrag from '@/glsl/sector/primitives/ellipsoidSegment.frag';
import ellipsoidSegmentVert from '@/glsl/sector/primitives/ellipsoidSegment.vert';
import generalCylinderFrag from '@/glsl/sector/primitives/generalCylinder.frag';
import generalCylinderVert from '@/glsl/sector/primitives/generalCylinder.vert';
import generalringFrag from '@/glsl/sector/primitives/generalring.frag';
import generalringVert from '@/glsl/sector/primitives/generalring.vert';
import torusSegmentFrag from '@/glsl/sector/primitives/torusSegment.frag';
import torusSegmentVert from '@/glsl/sector/primitives/torusSegment.vert';
import trapeziumFrag from '@/glsl/sector/primitives/trapezium.frag';
import trapeziumVert from '@/glsl/sector/primitives/trapezium.vert';
import sectorCoverageFrag from '@/glsl/sector/sectorCoverage.frag';
import sectorCoverageVert from '@/glsl/sector/sectorCoverage.vert';

import edgeDetectionVert from '@/glsl/post-processing/edgeDetection.vert';
import edgeDetectCombineFrag from '@/glsl/post-processing/edgeDetectCombine.frag';

/**
 * Defines used to enable debugging features in shaders.
 */
export const shaderDefines = {
  defines: {
    // Color geometry by tree index instead of model colors.
    COGNITE_COLOR_BY_TREE_INDEX: false
  }
};

export const sectorShaders = {
  // ----------------
  // "Regular" meshes
  // ----------------
  simpleMesh: {
    fragment: simpleFrag,
    vertex: simpleVert
  },
  detailedMesh: {
    fragment: meshFrag,
    vertex: meshVert
  },
  instancedMesh: {
    fragment: instancedMeshFrag,
    vertex: instancedMeshVert
  },

  // ----------------
  // Primitives
  // ----------------
  boxPrimitive: {
    fragment: instancedFrag,
    vertex: instancedVert
  },
  circlePrimitive: {
    fragment: circleFrag,
    vertex: circleVert
  },
  conePrimitive: {
    fragment: coneFrag,
    vertex: coneVert
  },
  eccentricConePrimitive: {
    fragment: eccentricConeFrag,
    vertex: eccentricConeVert
  },
  ellipsoidSegmentPrimitive: {
    fragment: ellipsoidSegmentFrag,
    vertex: ellipsoidSegmentVert
  },
  generalCylinderPrimitive: {
    fragment: generalCylinderFrag,
    vertex: generalCylinderVert
  },
  generalRingPrimitive: {
    fragment: generalringFrag,
    vertex: generalringVert
  },
  nutPrimitive: {
    fragment: instancedFrag,
    vertex: instancedVert
  },
  quadPrimitive: {
    fragment: instancedFrag,
    vertex: instancedVert
  },
  torusSegmentPrimitive: {
    fragment: torusSegmentFrag,
    vertex: torusSegmentVert
  },
  trapeziumPrimitive: {
    fragment: trapeziumFrag,
    vertex: trapeziumVert
  }
};

export const edgeDetectionShaders = {
  combine: edgeDetectCombineFrag,
  vertex: edgeDetectionVert
};

/**
 * Shaders use to estimate how many pixels a sector covers on screen.
 */
export const coverageShaders = {
  fragment: sectorCoverageFrag,
  vertex: sectorCoverageVert
};
