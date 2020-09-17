@include "../../base/updateFragmentColor.glsl"
@include "../../base/determineVisibility.glsl"
@include "../../base/determineColor.glsl"
@include "../../base/isSliced.glsl"

varying float v_treeIndex;
varying vec3 v_normal;
varying vec3 v_color;

uniform sampler2D colorDataTexture;
uniform sampler2D overrideVisibilityPerTreeIndex;
uniform sampler2D matCapTexture;

uniform vec2 dataTextureSize;

uniform int renderMode;

varying vec3 vViewPosition;

void main() {
    if (!determineVisibility(colorDataTexture, dataTextureSize, v_treeIndex, renderMode)) {
        discard;
    }
    if (isSliced(vViewPosition)) {
        discard;
    }

    vec4 color = determineColor(v_color, colorDataTexture, dataTextureSize, v_treeIndex);
    vec3 normal = normalize(v_normal);
    updateFragmentColor(renderMode, color, v_treeIndex, normal, gl_FragCoord.z, matCapTexture);
}
