import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { createScene } from '../three/scene';
import { CharacterRig } from '../three/CharacterRig';

type Props = {
  onReady: (rig: CharacterRig) => void;
  onProgress?: (loaded: number, total: number) => void;
  style?: StyleProp<ViewStyle>;
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// Native implementation: use expo-gl's GLView to obtain a WebGL context, then
// hand it to three.js via a fake canvas object that satisfies its interface.
// The GLView fills its parent; resize is detected by polling the drawing
// buffer in the render loop.
export function CharacterCanvas({ onReady, onProgress, style }: Props) {
  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    let lastW = gl.drawingBufferWidth;
    let lastH = gl.drawingBufferHeight;

    const fakeCanvas: HTMLCanvasElement = {
      width: lastW,
      height: lastH,
      style: {} as CSSStyleDeclaration,
      addEventListener: () => { },
      removeEventListener: () => { },
      clientHeight: lastH,
      clientWidth: lastW,
      getContext: () => gl as unknown as RenderingContext,
    } as unknown as HTMLCanvasElement;

    const renderer = new THREE.WebGLRenderer({
      canvas: fakeCanvas,
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(lastW, lastH, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const sceneCtx = createScene(lastW, lastH);
    let lastFrameMs = nowMs();

    let rig: CharacterRig | null = null;
    try {
      rig = await CharacterRig.create(sceneCtx.scene, onProgress);
      onReady(rig);
    } catch (e) {
      console.error('[CharacterCanvas native] failed to load rig:', e);
    }

    const renderFrame = () => {
      // Cap dt to ~33ms (30fps equivalent) so a JS-busy frame doesn't cause
      // the animation mixer to jump multiple frames at once.
      const frameMs = nowMs();
      const dt = Math.min((frameMs - lastFrameMs) / 1000, 1 / 30);
      lastFrameMs = frameMs;
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        renderer.setSize(w, h, false);
        sceneCtx.setSize(w, h);
      }
      if (rig) rig.update(dt);
      renderer.render(sceneCtx.scene, sceneCtx.camera);
      gl.endFrameEXP();
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  };

  return (
    <View style={[styles.container, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
