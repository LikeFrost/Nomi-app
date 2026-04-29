import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';
import { createScene } from '../three/scene';
import { CharacterRig } from '../three/CharacterRig';

type Props = {
  onReady: (rig: CharacterRig) => void;
  onProgress?: (loaded: number, total: number) => void;
  style?: StyleProp<ViewStyle>;
};

// Web implementation: a real <canvas> element gets a THREE.WebGLRenderer.
// React Native Web renders our <View> into a <div>; we attach a <canvas>
// inside via a portal-like approach using a ref. ResizeObserver keeps the
// renderer + camera in sync with the container's measured size.
export function CharacterCanvas({ onReady, onProgress, style }: Props) {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    let renderer: THREE.WebGLRenderer | null = null;
    let rig: CharacterRig | null = null;
    let rafId = 0;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const node = containerRef.current as unknown as HTMLDivElement | null;
    if (!node) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    node.appendChild(canvas);

    const initialW = Math.max(1, node.clientWidth);
    const initialH = Math.max(1, node.clientHeight);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(initialW, initialH, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const sceneCtx = createScene(initialW, initialH);
    const clock = new THREE.Clock();

    const renderFrame = () => {
      if (cancelled) return;
      const dt = clock.getDelta();
      if (rig) rig.update(dt);
      renderer!.render(sceneCtx.scene, sceneCtx.camera);
      rafId = requestAnimationFrame(renderFrame);
    };
    renderFrame();

    ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(1, Math.round(e.contentRect.width));
        const h = Math.max(1, Math.round(e.contentRect.height));
        renderer!.setSize(w, h, false);
        sceneCtx.setSize(w, h);
      }
    });
    ro.observe(node);

    CharacterRig.create(sceneCtx.scene, onProgress)
      .then((r) => {
        if (cancelled) {
          r.dispose();
          return;
        }
        rig = r;
        onReady(r);
      })
      .catch((e) => {
        console.error('[CharacterCanvas] failed to load rig:', e);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      rig?.dispose();
      renderer?.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [onProgress, onReady]);

  return (
    <View ref={containerRef} style={[styles.container, style]} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
