define([
        '../Core/buildModuleUrl',
        '../Core/createGuid',
        '../Core/Color',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/Ellipsoid',
        '../Renderer/PixelDatatype',
        '../Shaders/PostProcessStages/ACESTonemapping',
        '../Shaders/PostProcessStages/AmbientOcclusionGenerate',
        '../Shaders/PostProcessStages/AmbientOcclusionModulate',
        '../Shaders/PostProcessStages/BlackAndWhite',
        '../Shaders/PostProcessStages/BloomComposite',
        '../Shaders/PostProcessStages/Brightness',
        '../Shaders/PostProcessStages/BrightPass',
        '../Shaders/PostProcessStages/ContrastBias',
        '../Shaders/PostProcessStages/DepthOfField',
        '../Shaders/PostProcessStages/DepthView',
        '../Shaders/PostProcessStages/EdgeDetection',
        '../Shaders/PostProcessStages/FilmicTonemapping',
        '../Shaders/PostProcessStages/FXAA',
        '../Shaders/PostProcessStages/GaussianBlur1D',
        '../Shaders/PostProcessStages/LensFlare',
        '../Shaders/PostProcessStages/ModifiedReinhardTonemapping',
        '../Shaders/PostProcessStages/NightVision',
        '../shaders/PostProcessStages/ReinhardTonemapping',
        '../Shaders/PostProcessStages/Silhouette',
        '../ThirdParty/Shaders/FXAA3_11',
        './PostProcessStage',
        './PostProcessStageComposite',
        './PostProcessStageSampleMode'
    ], function(
        buildModuleUrl,
        createGuid,
        Color,
        defined,
        defineProperties,
        destroyObject,
        Ellipsoid,
        PixelDatatype,
        ACESTonemapping,
        AmbientOcclusionGenerate,
        AmbientOcclusionModulate,
        BlackAndWhite,
        BloomComposite,
        Brightness,
        BrightPass,
        ContrastBias,
        DepthOfField,
        DepthView,
        EdgeDetection,
        FilmicTonemapping,
        FXAA,
        GaussianBlur1D,
        LensFlare,
        ModifiedReinhardTonemapping,
        NightVision,
        ReinhardTonemapping,
        Silhouette,
        FXAA3_11,
        PostProcessStage,
        PostProcessStageComposite,
        PostProcessStageSampleMode) {
    'use strict';

    /**
     * Contains functions for creating common post-process stages.
     *
     * @exports PostProcessStageLibrary
     */
    var PostProcessStageLibrary = {};

    function createBlur(name, pixelDatatype, forcePowerOfTwo, textureScale) {
        var delta = 1.0;
        var sigma = 2.0;
        var stepSize = 1.0;

        var blurShader = '#define USE_STEP_SIZE\n' + GaussianBlur1D;
        var blurX = new PostProcessStage({
            name : name + '_x_direction',
            fragmentShader : blurShader,
            uniforms: {
                delta : delta,
                sigma : sigma,
                stepSize : stepSize,
                direction : 0.0
            },
            sampleMode : PostProcessStageSampleMode.LINEAR,
            pixelDatatype : pixelDatatype,
            forcePowerOfTwo : forcePowerOfTwo,
            textureScale : textureScale
        });
        var blurY = new PostProcessStage({
            name : name + '_y_direction',
            fragmentShader : blurShader,
            uniforms: {
                delta : delta,
                sigma : sigma,
                stepSize : stepSize,
                direction : 1.0
            },
            sampleMode : PostProcessStageSampleMode.LINEAR,
            pixelDatatype : pixelDatatype,
            forcePowerOfTwo : forcePowerOfTwo,
            textureScale : textureScale
        });

        var uniforms = {};
        defineProperties(uniforms, {
            delta : {
                get : function() {
                    return blurX.uniforms.delta;
                },
                set : function(value) {
                    var blurXUniforms = blurX.uniforms;
                    var blurYUniforms = blurY.uniforms;
                    blurXUniforms.delta = blurYUniforms.delta = value;
                }
            },
            sigma : {
                get : function() {
                    return blurX.uniforms.sigma;
                },
                set : function(value) {
                    var blurXUniforms = blurX.uniforms;
                    var blurYUniforms = blurY.uniforms;
                    blurXUniforms.sigma = blurYUniforms.sigma = value;
                }
            },
            stepSize : {
                get : function() {
                    return blurX.uniforms.stepSize;
                },
                set : function(value) {
                    var blurXUniforms = blurX.uniforms;
                    var blurYUniforms = blurY.uniforms;
                    blurXUniforms.stepSize = blurYUniforms.stepSize = value;
                }
            }
        });
        return new PostProcessStageComposite({
            name : name,
            stages : [blurX, blurY],
            uniforms : uniforms
        });
    }

    /**
     * Creates a post-process stage that applies a Gaussian blur to the input texture. This stage is usually applied in conjunction with another stage.
     * <p>
     * This stage has the following uniforms: <code>delta</code>, <code>sigma</code>, and <code>stepSize</code>.
     * </p>
     * <p>
     * <code>delta</code> and <code>sigma</code> are used to compute the weights of a Gaussian filter. The equation is <code>exp((-0.5 * delta * delta) / (sigma * sigma))</code>.
     * The default value for <code>delta</code> is <code>1.0</code>. The default value for <code>sigma</code> is <code>2.0</code>.
     * <code>stepSize</code> is the distance to the next texel. The default is <code>1.0</code>.
     * </p>
     * @return {PostProcessStageComposite} A post-process stage that applies a Gaussian blur to the input texture.
     */
    PostProcessStageLibrary.createBlurStage = function() {
        return createBlur('czm_blur');
    };

    /**
     * Creates a post-process stage that applies a depth of field effect.
     * <p>
     * Depth of field simulates camera focus. Objects in the scene that are in focus
     * will be clear whereas objects not in focus will be blurred.
     * </p>
     * <p>
     * This stage has the following uniforms: <code>focalDistance</code>, <code>delta</code>, <code>sigma</code>, and <code>stepSize</code>.
     * </p>
     * <p>
     * <code>focalDistance</code> is the distance in meters from the camera to set the camera focus.
     * </p>
     * <p>
     * <code>delta</code>, <code>sigma</code>, and <code>stepSize</code> are the same properties as {@link PostProcessStageLibrary#createBlurStage}.
     * The blur is applied to the areas out of focus.
     * </p>
     * @return {PostProcessStageComposite} A post-process stage that applies a depth of field effect.
     */
    PostProcessStageLibrary.createDepthOfFieldStage = function() {
        var blur = createBlur('czm_depth_of_field_blur');
        var dof = new PostProcessStage({
            name : 'czm_depth_of_field_composite',
            fragmentShader : DepthOfField,
            uniforms : {
                focalDistance : 5.0,
                blurTexture : blur.name
            }
        });

        var uniforms = {};
        defineProperties(uniforms, {
            focalDistance : {
                get : function() {
                    return dof.uniforms.focalDistance;
                },
                set : function(value) {
                    dof.uniforms.focalDistance = value;
                }
            },
            delta : {
                get : function() {
                    return blur.uniforms.delta;
                },
                set : function(value) {
                    blur.uniforms.delta = value;
                }
            },
            sigma : {
                get : function() {
                    return blur.uniforms.sigma;
                },
                set : function(value) {
                    blur.uniforms.sigma = value;
                }
            },
            stepSize : {
                get : function() {
                    return blur.uniforms.stepSize;
                },
                set : function(value) {
                    blur.uniforms.stepSize = value;
                }
            }
        });
        return new PostProcessStageComposite({
            name : 'czm_depth_of_field',
            stages : [blur, dof],
            inputPreviousStageTexture : false,
            uniforms : uniforms
        });
    };

    /**
     * Creates a post-process stage that detects edges.
     * <p>
     * Writes the color to the output texture with alpha set to 1.0 when it is on an edge.
     * </p>
     * <p>
     * This stage has the following uniforms: <code>color</code> and <code>length</code>
     * </p>
     * <ul>
     * <li><code>color</code> is the color of the highlighted edge. The default is {@link Color#BLACK}.</li>
     * <li><code>length</code> is the length of the edges in pixels. The default is <code>0.5</code>.</li>
     * </ul>
     * @return {PostProcessStageComposite} A post-process stage that applies an edge detection effect.
     *
     * @example
     * // multiple silhouette effects
     * var yellowEdge = Cesium.PostProcessLibrary.createEdgeDetectionStage();
     * yellowEdge.uniforms.color = Cesium.Color.YELLOW;
     * yellowEdge.selectedFeatures = [feature0];
     *
     * var greenEdge = Cesium.PostProcessLibrary.createEdgeDetectionStage();
     * greenEdge.uniforms.color = Cesium.Color.LIME;
     * greenEdge.selectedFeatures = [feature1];
     *
     * // draw edges around feature0 and feature1
     * postProcessStages.add(Cesium.PostProcessLibrary.createSilhouetteEffect([yellowEdge, greenEdge]);
     */
    PostProcessStageLibrary.createEdgeDetectionStage = function() {
        // unique name generated on call so more than one effect can be added
        var name = createGuid();
        return new PostProcessStage({
            name : 'czm_edge_detection_' + name,
            fragmentShader : EdgeDetection,
            uniforms : {
                length : 0.25,
                color : Color.clone(Color.BLACK)
            }
        });
    };

    function getSilhouetteEdgeDetection(edgeDetectionStages) {
        if (!defined(edgeDetectionStages)) {
            return PostProcessStageLibrary.createEdgeDetectionStage();
        }

        var edgeDetection = new PostProcessStageComposite({
            name : 'czm_edge_detection_multiple',
            stages : edgeDetectionStages,
            inputPreviousStageTexture : false
        });

        var compositeUniforms = {};
        var fsDecl = '';
        var fsLoop = '';
        for (var i = 0; i < edgeDetectionStages.length; ++i) {
            fsDecl += 'uniform sampler2D edgeTexture' + i + '; \n';
            fsLoop +=
                '        vec4 edge' + i + ' = texture2D(edgeTexture' + i + ', v_textureCoordinates); \n' +
                '        if (edge' + i + '.a > 0.0) \n' +
                '        { \n' +
                '            color = edge' + i + '; \n' +
                '            break; \n' +
                '        } \n';
            compositeUniforms['edgeTexture' + i] = edgeDetectionStages[i].name;
        }

        var fs =
            fsDecl +
            'varying vec2 v_textureCoordinates; \n' +
            'void main() { \n' +
            '    vec4 color = vec4(0.0); \n' +
            '    for (int i = 0; i < ' + edgeDetectionStages.length + '; i++) \n' +
            '    { \n' +
            fsLoop +
            '    } \n' +
            '    gl_FragColor = color; \n' +
            '} \n';

        var edgeComposite = new PostProcessStage({
            name : 'czm_edge_detection_combine',
            fragmentShader : fs,
            uniforms : compositeUniforms
        });
        return new PostProcessStageComposite({
            name : 'czm_edge_detection_composite',
            stages : [edgeDetection, edgeComposite]
        });
    }

    /**
     * Creates a post-process stage that applies a silhouette effect.
     * <p>
     * A silhouette effect composites the color from the edge detection pass with input color texture.
     * </p>
     * <p>
     * This stage has the following uniforms when <code>edgeDetectionStages</code> is <code>undefined</code>: <code>color</code> and <code>length</code>
     * </p>
     * <p>
     * <code>color</code> is the color of the highlighted edge. The default is {@link Color#BLACK}.
     * <code>length</code> is the length of the edges in pixels. The default is <code>0.5</code>.
     * </p>
     * @return {PostProcessStageComposite} A post-process stage that applies a silhouette effect.
     */
    PostProcessStageLibrary.createSilhouetteStage = function(edgeDetectionStages) {
        var edgeDetection = getSilhouetteEdgeDetection(edgeDetectionStages);
        var silhouetteProcess = new PostProcessStage({
            name : 'czm_silhouette_color_edges',
            fragmentShader : Silhouette,
            uniforms : {
                silhouetteTexture : edgeDetection.name
            }
        });

        return new PostProcessStageComposite({
            name : 'czm_silhouette',
            stages : [edgeDetection, silhouetteProcess],
            inputPreviousStageTexture : false,
            uniforms : edgeDetection.uniforms
        });
    };

    /**
     * Creates a post-process stage that applies a bloom effect to the input texture.
     * <p>
     * A bloom effect adds glow effect, makes bright areas brighter, and dark areas darker.
     * </p>
     * <p>
     * This post-process stage has the following uniforms: <code>contrast</code>, <code>brightness</code>, <code>glowOnly</code>,
     * <code>delta</code>, <code>sigma</code>, and <code>stepSize</code>.
     * </p>
     * <ul>
     * <li><code>contrast</code> is a scalar value in the range [-255.0, 255.0] and affects the contract of the effect. The default value is <code>128.0</code>.</li>
     * <li><code>brightness</code> is a scalar value. The input texture RGB value is converted to hue, saturation, and brightness (HSB) then this value is
     * added to the brightness. The default value is <code>-0.3</code>.</li>
     * <li><code>glowOnly</code> is a boolean value. When <code>true</code>, only the glow effect will be shown. When <code>false</code>, the glow will be added to the input texture.
     * The default value is <code>false</code>. This is a debug option for viewing the effects when changing the other uniform values.</li>
     * </ul>
     * <p>
     * <code>delta</code>, <code>sigma</code>, and <code>stepSize</code> are the same properties as {@link PostProcessStageLibrary#createBlurStage}.
     * </p>
     * @return {PostProcessStageComposite} A post-process stage to applies a bloom effect.
     *
     * @private
     */
    // TODO HDR
    /*
    PostProcessStageLibrary.createBloomStage = function() {
        var contrastBias = new PostProcessStage({
            name : 'czm_bloom_contrast_bias',
            fragmentShader : ContrastBias,
            uniforms : {
                contrast : 128.0,
                brightness : -0.3
            }
        });
        var blur = createBlur('czm_bloom_blur');
        var generateComposite = new PostProcessStageComposite({
            name : 'czm_bloom_contrast_bias_blur',
            stages : [contrastBias, blur]
        });

        var bloomComposite = new PostProcessStage({
            name : 'czm_bloom_generate_composite',
            fragmentShader : BloomComposite,
            uniforms : {
                glowOnly : false,
                bloomTexture : generateComposite.name
            }
        });

        var uniforms = {};
        defineProperties(uniforms, {
            glowOnly : {
                get : function() {
                    return bloomComposite.uniforms.glowOnly;
                },
                set : function(value) {
                    bloomComposite.uniforms.glowOnly = value;
                }
            },
            contrast : {
                get : function() {
                    return contrastBias.uniforms.contrast;
                },
                set : function(value) {
                    contrastBias.uniforms.contrast = value;
                }
            },
            brightness : {
                get : function() {
                    return contrastBias.uniforms.brightness;
                },
                set : function(value) {
                    contrastBias.uniforms.brightness = value;
                }
            },
            delta : {
                get : function() {
                    return blur.uniforms.delta;
                },
                set : function(value) {
                    blur.uniforms.delta = value;
                }
            },
            sigma : {
                get : function() {
                    return blur.uniforms.sigma;
                },
                set : function(value) {
                    blur.uniforms.sigma = value;
                }
            },
            stepSize : {
                get : function() {
                    return blur.uniforms.stepSize;
                },
                set : function(value) {
                    blur.uniforms.stepSize = value;
                }
            }
        });

        return new PostProcessStageComposite({
            name : 'czm_bloom',
            stages : [generateComposite, bloomComposite],
            inputPreviousStageTexture : false,
            uniforms : uniforms
        });
    };
    */

    PostProcessStageLibrary.createBloomStage = function() {
        var scale = 0.75;

        var toLuminance = 'uniform sampler2D colorTexture; varying vec2 v_textureCoordinates; void main() { gl_FragColor = vec4(czm_luminance(texture2D(colorTexture, v_textureCoordinates).rgb)); }';
        var luminance = new PostProcessStage({
            fragmentShader : toLuminance,
            textureScale : 0.5,
            pixelDatatype : PixelDatatype.FLOAT
        });
        var passThrough = 'uniform sampler2D colorTexture; varying vec2 v_textureCoordinates; void main() { gl_FragColor = texture2D(colorTexture, v_textureCoordinates); }';
        var downsample = new PostProcessStage({
            fragmentShader : passThrough,
            textureScale : 0.5,
            pixelDatatype : PixelDatatype.FLOAT
        });
        var downsample2 = new PostProcessStage({
            fragmentShader : passThrough,
            textureScale : 0.25,
            pixelDatatype : PixelDatatype.FLOAT
        });
        var downsample3 = new PostProcessStage({
            fragmentShader : passThrough,
            textureScale : 0.125,
            pixelDatatype : PixelDatatype.FLOAT
        });
        var downsample4 = new PostProcessStage({
            fragmentShader : passThrough,
            textureScale : 0.0625,
            pixelDatatype : PixelDatatype.FLOAT
        });

        var avgLuminance = new PostProcessStageComposite({
            stages : [luminance, downsample, downsample2, downsample3, downsample4]
        });

        var brightPassFS =
            'uniform sampler2D colorTexture; \n' +
            'uniform sampler2D luminanceTexture; \n' +
            'uniform float threshold; \n' +
            'uniform float offset; \n' +
            'varying vec2 v_textureCoordinates; \n' +
            'float key(float avg) { \n' +
            '    float guess = 1.5 - (1.5 / (avg * 0.1 + 1.0)); \n' +
            '    return max(0.0, guess) + 0.1; \n' +
            '} \n' +
            'void main() { \n' +
            '    vec4 color = texture2D(colorTexture, v_textureCoordinates); \n' +
            //'    float avgLuminance = texture2D(luminanceTexture, vec2(0.5)).r; \n' +
            '    float avgLuminance = 1.5; \n' +
            '    vec3 Yxy = czm_RGBToXYZ(color.rgb); \n' +
            '    float luminance = Yxy.r; \n' +
            '    float scaledLum = key(avgLuminance) * luminance / avgLuminance; \n' +
            '    float brightLum = max(scaledLum - threshold, 0.0); \n' +
            '    float brightness = brightLum / (offset + brightLum); \n' +
            '    Yxy.r = brightness; \n' +
            '    gl_FragColor = vec4(czm_XYZToRGB(Yxy), 1.0); \n' +
            '} \n';

        var brightPass = new PostProcessStage({
            fragmentShader : brightPassFS,
            uniforms : {
                luminanceTexture : avgLuminance.name,
                threshold : 0.25,
                offset : 0.1
            },
            pixelDatatype : PixelDatatype.FLOAT,
            textureScale : scale
        });

        var brightPassComposite = new PostProcessStageComposite({
            stages : [avgLuminance, brightPass],
            inputPreviousStageTexture : false
        });

        /*
        var brightFS =
            'uniform sampler2D colorTexture; \n' +
            'varying vec2 v_textureCoordinates; \n' +
            'void main() { \n' +
            '    vec4 color = texture2D(colorTexture, v_textureCoordinates); \n' +
            '    if (color.r > 1.0 || color.g > 1.0 || color.b > 1.0) { \n' +
            '        gl_FragColor = vec4(color.rgb, 1.0); \n' +
            '    } else { \n' +
            '        gl_FragColor = vec4(vec3(0.0), 1.0); \n' +
            '    } \n' +
            '} \n';
        var scale = 0.75;
        var brightPass = new PostProcessStage({
            fragmentShader : brightFS,
            pixelDatatype : PixelDatatype.FLOAT,
            textureScale : scale
        });
        */

        var blurFS =
            'uniform sampler2D colorTexture; \n' +
            'uniform vec2 colorTextureDimensions; \n' +
            'uniform bool horizontal; \n' +
            'varying vec2 v_textureCoordinates; \n' +
            'void main() { \n' +
            'float weights[5]; \n' +
            'weights[0] = 0.227027; \n' +
            'weights[1] = 0.1945946; \n' +
            'weights[2] = 0.1216216; \n' +
            'weights[3] = 0.054054; \n' +
            'weights[4] = 0.016216; \n' +
            '    vec2 offset = 1.0 / colorTextureDimensions; \n' +
            '    vec3 result = texture2D(colorTexture, v_textureCoordinates).rgb * weights[0]; \n' +
            '    if(horizontal) { \n' +
            '        for(int i = 1; i < 5; ++i) { \n' +
            '            result += texture2D(colorTexture, v_textureCoordinates + vec2(offset.x * float(i), 0.0)).rgb * weights[i]; \n' +
            '            result += texture2D(colorTexture, v_textureCoordinates - vec2(offset.x * float(i), 0.0)).rgb * weights[i]; \n' +
            '        } \n' +
            '    } else { \n' +
            '        for(int i = 1; i < 5; ++i) { \n' +
            '            result += texture2D(colorTexture, v_textureCoordinates + vec2(0.0, offset.y * float(i))).rgb * weights[i]; \n' +
            '            result += texture2D(colorTexture, v_textureCoordinates - vec2(0.0, offset.y * float(i))).rgb * weights[i]; \n' +
            '        } \n' +
            '    } \n' +
            '    gl_FragColor = vec4(result, 1.0); \n' +
            '} \n';
        var blurX = new PostProcessStage({
            fragmentShader : blurFS,
            uniforms : {
                horizontal : true
            },
            pixelDatatype : PixelDatatype.FLOAT,
            textureScale : scale
        });
        var blurY = new PostProcessStage({
            fragmentShader : blurFS,
            uniforms : {
                horizontal : false
            },
            pixelDatatype : PixelDatatype.FLOAT,
            textureScale : scale
        });
        var blur = new PostProcessStageComposite({
            stages : [blurX, blurY]
        });
        //var blur = createBlur('czm_bloom_blur0', PixelDatatype.FLOAT, powerOfTwo, scale);
        var brightBlur = new PostProcessStageComposite({
            name : 'czm_brightness_blur',
            //stages : [brightPass, blur]
            stages : [brightPassComposite, blur]
        });

        var addFS =
            'uniform sampler2D colorTexture; \n' +
            'uniform sampler2D brightTexture; \n' +
            'varying vec2 v_textureCoordinates; \n' +
            'void main() { \n' +
            '    vec4 color = texture2D(colorTexture, v_textureCoordinates); \n' +
            '    vec4 bloom = texture2D(brightTexture, v_textureCoordinates); \n' +
            '    gl_FragColor = vec4(color.rgb + bloom.rgb, 1.0); \n' +
            '} \n';
        var add = new PostProcessStage({
            fragmentShader : addFS,
            pixelDatatype : PixelDatatype.FLOAT,
            uniforms : {
                brightTexture : brightBlur.name
            }
        });

        return new PostProcessStageComposite({
            name : 'czm_bloom',
            stages : [brightBlur, add],
            inputPreviousStageTexture : false
        });
    };

    /**
     * Creates a post-process stage that Horizon-based Ambient Occlusion (HBAO) to the input texture.
     * <p>
     * Ambient occlusion simulates shadows from ambient light. These shadows would always be present when the
     * surface receives light and regardless of the light's position.
     * </p>
     * <p>
     * The uniforms have the following properties: <code>intensity</code>, <code>bias</code>, <code>lengthCap</code>,
     * <code>stepSize</code>, <code>frustumLength</code>, <code>randomTexture</code>, <code>ambientOcclusionOnly</code>,
     * <code>delta</code>, <code>sigma</code>, and <code>blurStepSize</code>.
     * </p>
     * <ul>
     * <li><code>intensity</code> is a scalar value used to lighten or darken the shadows exponentially. Higher values make the shadows darker. The default value is <code>3.0</code>.</li>
     * <li><code>bias</code> is a scalar value representing an angle in radians. If the dot product between the normal of the sample and the vector to the camera is less than this value,
     * sampling stops in the current direction. This is used to remove shadows from near planar edges. The default value is <code>0.1</code>.</li>
     * <li><code>lengthCap</code> is a scalar value representing a length in meters. If the distance from the current sample to first sample is greater than this value,
     * sampling stops in the current direction. The default value is <code>0.26</code>.</li>
     * <li><code>stepSize</code> is a scalar value indicating the distance to the next texel sample in the current direction. The default value is <code>1.95</code>.</li>
     * <li><code>frustumLength</code> is a scalar value in meters. If the current fragment has a distance from the camera greater than this value, ambient occlusion is not computed for the fragment.
     * The default value is <code>1000.0</code>.</li>
     * <li><code>randomTexture</code> is a texture where the red channel is a random value in [0.0, 1.0]. The default value is <code>undefined</code>. This texture needs to be set.</li>
     * <li><code>ambientOcclusionOnly</code> is a boolean value. When <code>true</code>, only the shadows generated are written to the output. When <code>false</code>, the input texture is modulated
     * with the ambient occlusion. This is a useful debug option for seeing the effects of changing the uniform values. The default value is <code>false</code>.</li>
     * </ul>
     * <p>
     * <code>delta</code>, <code>sigma</code>, and <code>blurStepSize</code> are the same properties as {@link PostProcessStageLibrary#createBlurStage}.
     * The blur is applied to the shadows generated from the image to make them smoother.
     * </p>
     * @return {PostProcessStageComposite} A post-process stage that applies an ambient occlusion effect.
     *
     * @private
     */
    PostProcessStageLibrary.createAmbientOcclusionStage = function() {
        var generate = new PostProcessStage({
            name : 'czm_ambient_occlusion_generate',
            fragmentShader : AmbientOcclusionGenerate,
            uniforms : {
                intensity : 3.0,
                bias : 0.1,
                lengthCap : 0.26,
                stepSize : 1.95,
                frustumLength : 1000.0,
                randomTexture : undefined
            }
        });
        var blur = createBlur('czm_ambient_occlusion_blur');
        blur.uniforms.stepSize = 0.86;
        var generateAndBlur = new PostProcessStageComposite({
            name : 'czm_ambient_occlusion_generate_blur',
            stages : [generate, blur]
        });

        var ambientOcclusionModulate = new PostProcessStage({
            name : 'czm_ambient_occlusion_composite',
            fragmentShader : AmbientOcclusionModulate,
            uniforms : {
                ambientOcclusionOnly : false,
                ambientOcclusionTexture : generateAndBlur.name
            }
        });

        var uniforms = {};
        defineProperties(uniforms, {
            intensity : {
                get : function() {
                    return generate.uniforms.intensity;
                },
                set : function(value) {
                    generate.uniforms.intensity = value;
                }
            },
            bias : {
                get : function() {
                    return generate.uniforms.bias;
                },
                set : function(value) {
                    generate.uniforms.bias = value;
                }
            },
            lengthCap : {
                get : function() {
                    return generate.uniforms.lengthCap;
                },
                set : function(value) {
                    generate.uniforms.lengthCap = value;
                }
            },
            stepSize : {
                get : function() {
                    return generate.uniforms.stepSize;
                },
                set : function(value) {
                    generate.uniforms.stepSize = value;
                }
            },
            frustumLength : {
                get : function() {
                    return generate.uniforms.frustumLength;
                },
                set : function(value) {
                    generate.uniforms.frustumLength = value;
                }
            },
            randomTexture : {
                get : function() {
                    return generate.uniforms.randomTexture;
                },
                set : function(value) {
                    generate.uniforms.randomTexture = value;
                }
            },
            delta : {
                get : function() {
                    return blur.uniforms.delta;
                },
                set : function(value) {
                    blur.uniforms.delta = value;
                }
            },
            sigma : {
                get : function() {
                    return blur.uniforms.sigma;
                },
                set : function(value) {
                    blur.uniforms.sigma = value;
                }
            },
            blurStepSize : {
                get : function() {
                    return blur.uniforms.stepSize;
                },
                set : function(value) {
                    blur.uniforms.stepSize = value;
                }
            },
            ambientOcclusionOnly : {
                get : function() {
                    return ambientOcclusionModulate.uniforms.ambientOcclusionOnly;
                },
                set : function(value) {
                    ambientOcclusionModulate.uniforms.ambientOcclusionOnly = value;
                }
            }
        });

        return new PostProcessStageComposite({
            name : 'czm_ambient_occlusion',
            stages : [generateAndBlur, ambientOcclusionModulate],
            inputPreviousStageTexture : false,
            uniforms : uniforms
        });
    };

    var fxaaFS =
        '#define FXAA_QUALITY_PRESET 39 \n' +
        FXAA3_11 + '\n' +
        FXAA;

    /**
     * Creates a post-process stage that applies Fast Approximate Anti-aliasing (FXAA) to the input texture.
     * @return {PostProcessStage} A post-process stage that applies Fast Approximate Anti-aliasing to the input texture.
     *
     * @private
     */
    PostProcessStageLibrary.createFXAAStage = function() {
        return new PostProcessStage({
            name : 'czm_FXAA',
            fragmentShader : fxaaFS,
            sampleMode : PostProcessStageSampleMode.LINEAR
        });
    };

    PostProcessStageLibrary.createACESTonemappingStage = function() {
        return new PostProcessStage({
            name : 'czm_aces',
            fragmentShader : ACESTonemapping
        });
    };

    PostProcessStageLibrary.createFilmicTonemappingStage = function() {
        return new PostProcessStage({
            name : 'czm_filmic',
            fragmentShader : FilmicTonemapping
        });
    };

    PostProcessStageLibrary.createReinhardTonemappingStage = function() {
        return new PostProcessStage({
            name : 'czm_reinhard',
            fragmentShader : ReinhardTonemapping
        });
    };

    PostProcessStageLibrary.createModifiedReinhardTonemappingStage = function() {
        return new PostProcessStage({
            name : 'czm_modified_reinhard',
            fragmentShader : ModifiedReinhardTonemapping,
            uniforms : {
                white : Color.WHITE
            }
        });
    };

    /**
     * Creates a post-process stage that renders the input texture with black and white gradations.
     * <p>
     * This stage has one uniform value, <code>gradations</code>, which scales the luminance of each pixel.
     * </p>
     * @return {PostProcessStage} A post-process stage that renders the input texture with black and white gradations.
     */
    PostProcessStageLibrary.createBlackAndWhiteStage = function() {
        return new PostProcessStage({
            name : 'czm_black_and_white',
            fragmentShader : BlackAndWhite,
            uniforms : {
                gradations : 5.0
            }
        });
    };

    /**
     * Creates a post-process stage that saturates the input texture.
     * <p>
     * This stage has one uniform value, <code>brightness</code>, which scales the saturation of each pixel.
     * </p>
     * @return {PostProcessStage} A post-process stage that saturates the input texture.
     */
    PostProcessStageLibrary.createBrightnessStage = function() {
        return new PostProcessStage({
            name : 'czm_brightness',
            fragmentShader : Brightness,
            uniforms : {
                brightness : 0.5
            }
        });
    };

    /**
     * Creates a post-process stage that adds a night vision effect to the input texture.
     * @return {PostProcessStage} A post-process stage that adds a night vision effect to the input texture.
     */
    PostProcessStageLibrary.createNightVisionStage = function() {
        return new PostProcessStage({
            name : 'czm_night_vision',
            fragmentShader : NightVision
        });
    };

    /**
     * Creates a post-process stage that replaces the input color texture with a black and white texture representing the fragment depth at each pixel.
     * @return {PostProcessStage} A post-process stage that replaces the input color texture with a black and white texture representing the fragment depth at each pixel.
     *
     * @private
     */
    PostProcessStageLibrary.createDepthViewStage = function() {
        return new PostProcessStage({
            name : 'czm_depth_view',
            fragmentShader : DepthView
        });
    };

    /**
     * Creates a post-process stage that applies an effect simulating light flaring a camera lens.
     * <p>
     * This stage has the following uniforms: <code>dirtTexture</code>, <code>starTexture</code>, <code>intensity</code>, <code>distortion</code>, <code>ghostDispersal</code>,
     * <code>haloWidth</code>, and <code>earthRadius</code>.
     * <ul>
     * <li><code>dirtTexture</code> is a texture sampled to simulate dirt on the lens.</li>
     * <li><code>starTexture</code> is the texture sampled for the star pattern of the flare.</li>
     * <li><code>intensity</code> is a scalar multiplied by the result of the lens flare. The default value is <code>2.0</code>.</li>
     * <li><code>distortion</code> is a scalar value that affects the chromatic effect distortion. The default value is <code>10.0</code>.</li>
     * <li><code>ghostDispesal</code> is a scalar indicating how far the halo effect is from the center of the texture. The default value is <code>0.4</code>.</li>
     * <li><code>haloWidth</code> is a scalar representing the width of the halo  from the ghost dispersal. The default value is <code>0.4</code>.</li>
     * <li><code>earthRadius</code> is the maximum radius of the earth. The default value is <code>Ellipsoid.WGS84.maximumRadius</code>.</li>
     * </ul>
     * </p>
     * @return {PostProcessStage} A post-process stage for applying a lens flare effect.
     */
    PostProcessStageLibrary.createLensFlarStage = function() {
        return new PostProcessStage({
            name : 'czm_lens_flare',
            fragmentShader : LensFlare,
            uniforms : {
                dirtTexture : buildModuleUrl('Assets/Textures/LensFlare/DirtMask.jpg'),
                starTexture : buildModuleUrl('Assets/Textures/LensFlare/StarBurst.jpg'),
                intensity : 2.0,
                distortion : 10.0,
                ghostDispersal : 0.4,
                haloWidth : 0.4,
                earthRadius : Ellipsoid.WGS84.maximumRadius
            }
        });
    };

    return PostProcessStageLibrary;
});