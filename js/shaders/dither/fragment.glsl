// source: https://www.shadertoy.com/view/mddXzs

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iChannel0Res;

uniform bool dither;
uniform float downScale;
uniform vec3 color;

varying vec2 vUv;



#define distanceParam 0.25

#define PaletteSize 2
vec3 palette[PaletteSize];
void init() {
    palette[0] = vec3(0, 0, 0) / 255.0;
    palette[1] = color / 255.0;
}

float colorDistance(vec3 color, vec3 c1, vec3 c2, float frac) {
    return mix(distance(color, mix(c1, c2, frac)), distance(color, c1) + distance(color, c2), 0.5 * distanceParam * distanceParam);
}

vec3 getPalettifiedColor(vec3 color, vec2 coord) {
    color *= color;

    vec3 c1 = vec3(0);
    vec3 c2 = vec3(0);

    float frac = 0.0;

    for(int i = 0; i < PaletteSize - 1; ++i) {
        for(int j = 1; j < PaletteSize; ++j) {
            vec3 p1 = palette[i];
            vec3 p2 = palette[j];

            p1 *= p1;
            p2 *= p2;

            vec3 num = p1 * p1 - p1 * color - p1 * p2 + p2 * color;
            vec3 den = p1 * p1 - 2.0 * p1 * p2 + p2 * p2;

            float a = (num.r + num.g + num.b) / (den.r + den.g + den.b);

            if(colorDistance(color, p1, p2, a) < colorDistance(color, c1, c2, frac)) {
                c1 = p1;
                c2 = p2;
                frac = a;
            }
        }
    }

    vec2 ditherRepeat = iResolution.xy / iChannel0Res / vec2(downScale, downScale);
    vec2 ditherUv = fract(vUv * ditherRepeat);
    vec2 ditherSmoothUv = ditherRepeat * vUv;
    vec4 ditherUv2 = vec4(dFdx(ditherSmoothUv), dFdy(ditherSmoothUv));
    vec3 ditherTxl = textureGrad(iChannel0, ditherUv, ditherUv2.xy, ditherUv2.zw).rgb;

    return dither ? sqrt(mix(c1, c2, float(frac > ditherTxl.r))) : sqrt(mix(c1, c2, frac));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    init();

    vec2 pixelFragCoord = floor(fragCoord / downScale) * downScale;

    vec2 pixelUv = pixelFragCoord / iResolution.xy;
    pixelUv.y = 1.0 - pixelUv.y;

    vec3 outColor = texture2D(iChannel1, pixelUv).rgb;

    outColor = getPalettifiedColor(outColor, fragCoord);

    fragColor = vec4(outColor, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
    
    //gl_FragColor = texture2D(iChannel1, vUv);
}