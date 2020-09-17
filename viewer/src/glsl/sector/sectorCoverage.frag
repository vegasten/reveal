@include "../math/rand2d.glsl"
@include "../base/isSliced.glsl"

varying mediump vec3 v_color;
varying lowp float v_coverageFactor;
varying lowp vec2 v_seed;

varying vec3 v_viewPosition;

void main() {

    if(isSliced(v_viewPosition)){
      discard;
    }

    float v = rand2d(gl_FragCoord.xy + v_seed);
    if (v >= v_coverageFactor) {
        discard;
    }

    gl_FragColor = vec4(v_color, 1.0);
}
