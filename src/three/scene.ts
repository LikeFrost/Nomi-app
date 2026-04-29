import * as THREE from 'three';
import type { Emotion } from '../ai/types';

export type Scene3D = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ambient: THREE.AmbientLight;
  key: THREE.DirectionalLight;
  setSize: (width: number, height: number) => void;
  setEmotionTint: (emotion: Emotion) => void;
};

const TINT_BY_EMOTION: Record<Emotion, number> = {
  happy: 0xfff2c4,    // warm yellow
  tired: 0xb0c4d6,    // cool blue-grey
  playful: 0xffc0e8,  // pink-purple
};

export function createScene(width: number, height: number): Scene3D {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 1.6, 3.2);
  camera.lookAt(0, 0.7, 0);

  // Hemisphere light: soft sky/ground gradient — fills shadows naturally so
  // dark side of the model doesn't go pitch black. This is the single biggest
  // win for "character looks too dark".
  const hemi = new THREE.HemisphereLight(0xffffff, 0xddd0c4, 1.0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-2, 2, -1);
  scene.add(fill);

  const setSize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const setEmotionTint = (emotion: Emotion) => {
    key.color.setHex(TINT_BY_EMOTION[emotion]);
  };

  return { scene, camera, ambient, key, setSize, setEmotionTint };
}
