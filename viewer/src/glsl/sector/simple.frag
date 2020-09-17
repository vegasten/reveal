@include "../base/updateFragmentColor.glsl"
@include "../base/determineVisibility.glsl"
@include "../base/determineColor.glsl"
@include "../base/isSliced.glsl"

uniform sampler2D colorDataTexture;
uniform sampler2D overrideVisibilityPerTreeIndex;
uniform sampler2D matCapTexture;

uniform vec2 dataTextureSize;

varying float v_treeIndex;
varying vec3 v_color;
varying vec3 v_normal;

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
    updateFragmentColor(renderMode, color, v_treeIndex, v_normal, gl_FragCoord.z, matCapTexture);
}
