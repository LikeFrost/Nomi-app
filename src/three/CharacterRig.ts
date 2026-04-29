import * as THREE from 'three';
import { Platform } from 'react-native';
import { loadGLBWithProgress } from './loaders';

export type ActionName = 'idle' | 'greet' | 'kiss' | 'cheer';

// Map our internal action names to the clip names in girl.glb.
const CLIP_NAME: Record<ActionName, string> = {
  idle: 'Idle',
  greet: 'Greeting',
  kiss: 'Kiss',
  cheer: 'Cheering',
};

function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip {
  const hit = clips.find((c) => c.name === name);
  if (!hit) {
    const available = clips.map((c) => c.name).join(', ');
    throw new Error(`girl.glb missing clip "${name}". Available: ${available}`);
  }
  return hit;
}

type MaterialWithMap = THREE.Material & {
  map?: THREE.Texture | null;
  color?: THREE.Color;
  opacity?: number;
  alphaTest?: number;
};

type CpuSkinnedMesh = {
  source: THREE.SkinnedMesh;
  mesh: THREE.Mesh;
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
};

function asMaterialArray(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material];
}

function createNativeMaterial(material: THREE.Material) {
  const source = material as MaterialWithMap;
  const fallbackColor = source.color?.getHex() ?? 0xd68dac;

  return new THREE.MeshBasicMaterial({
    map: source.map ?? null,
    color: source.map ? 0xffffff : fallbackColor,
    side: THREE.DoubleSide,
    transparent: false,
    alphaTest: source.alphaTest ?? 0,
    opacity: source.opacity ?? 1,
    toneMapped: false,
  });
}

function simplifyNativeMaterials(scene: THREE.Object3D) {
  if (Platform.OS !== 'ios') return;

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = asMaterialArray(mesh.material).map(createNativeMaterial);
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.frustumCulled = false;
  });
}

function setAttributeDynamicUsage(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  if ('setUsage' in attribute && typeof attribute.setUsage === 'function') {
    attribute.setUsage(THREE.DynamicDrawUsage);
    return;
  }

  if (
    'data' in attribute &&
    'setUsage' in attribute.data &&
    typeof attribute.data.setUsage === 'function'
  ) {
    attribute.data.setUsage(THREE.DynamicDrawUsage);
  }
}

function createCpuSkinnedMeshes(scene: THREE.Object3D): CpuSkinnedMesh[] {
  if (Platform.OS !== 'ios') return [];

  const cpuMeshes: CpuSkinnedMesh[] = [];

  scene.traverse((object) => {
    const source = object as THREE.SkinnedMesh;
    if (!source.isSkinnedMesh || !source.geometry || !source.parent) return;

    const geometry = source.geometry.clone();
    const position = geometry.getAttribute('position') as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    if (!position) return;

    setAttributeDynamicUsage(position);

    const mesh = new THREE.Mesh(geometry, source.material);
    mesh.name = `${source.name || 'SkinnedMesh'}_cpu`;
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    mesh.matrix.copy(source.matrix);
    mesh.matrixAutoUpdate = source.matrixAutoUpdate;
    mesh.renderOrder = source.renderOrder;
    mesh.frustumCulled = false;

    source.parent.add(mesh);
    source.visible = false;
    cpuMeshes.push({ source, mesh, position });
  });

  return cpuMeshes;
}

export class CharacterRig {
  scene: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<ActionName, THREE.AnimationAction>;
  current: THREE.AnimationAction;
  // Tracks the in-flight play() so a new play() can pre-empt it: removing the
  // pending 'finished' listener and resolving the old promise as superseded.
  private currentFinishListener: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  private currentPromiseResolve: (() => void) | null = null;
  private cpuSkinnedMeshes: CpuSkinnedMesh[];
  private skinnedVertex = new THREE.Vector3();

  private constructor(args: {
    scene: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Record<ActionName, THREE.AnimationAction>;
    cpuSkinnedMeshes: CpuSkinnedMesh[];
  }) {
    this.scene = args.scene;
    this.mixer = args.mixer;
    this.actions = args.actions;
    this.cpuSkinnedMeshes = args.cpuSkinnedMeshes;
    this.current = args.actions.idle;
    this.current.play();
  }

  static async create(
    parent: THREE.Scene,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<CharacterRig> {
    const gltf = await loadGLBWithProgress(
      require('../../assets/girl-opt.glb'),
      onProgress,
    );
    simplifyNativeMaterials(gltf.scene);
    const cpuSkinnedMeshes = createCpuSkinnedMeshes(gltf.scene);

    parent.add(gltf.scene);
    gltf.scene.position.set(0, 0, 0);

    const mixer = new THREE.AnimationMixer(gltf.scene);

    const idle = mixer.clipAction(findClip(gltf.animations, CLIP_NAME.idle));

    const mk = (clip: THREE.AnimationClip): THREE.AnimationAction => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      return a;
    };

    return new CharacterRig({
      scene: gltf.scene,
      mixer,
      cpuSkinnedMeshes,
      actions: {
        idle,
        greet: mk(findClip(gltf.animations, CLIP_NAME.greet)),
        kiss: mk(findClip(gltf.animations, CLIP_NAME.kiss)),
        cheer: mk(findClip(gltf.animations, CLIP_NAME.cheer)),
      },
    });
  }

  // Cross-fade to the named action and resolve when it finishes (then auto-fade
  // back to idle). intensity (0..1) drives the action's blend weight; >1 is an
  // over-drive that exaggerates the motion past the original mocap amplitude.
  // If called while another play() is still in flight, that previous play is
  // pre-empted: its 'finished' listener is dropped and its promise resolves so
  // awaiters unblock — we cross-fade straight from the in-progress action into
  // the new one, no detour through idle.
  play(actionKey: Exclude<ActionName, 'idle'>, mixerSpeed: number, intensity: number): Promise<void> {
    if (this.currentFinishListener) {
      this.mixer.removeEventListener('finished', this.currentFinishListener);
      this.currentFinishListener = null;
    }
    if (this.currentPromiseResolve) {
      this.currentPromiseResolve();
      this.currentPromiseResolve = null;
    }

    this.mixer.timeScale = mixerSpeed;
    const next = this.actions[actionKey];
    // Keep targetWeight >= 1 so idle.fadeOut + next.fadeIn weights always sum
    // to >= 1 during the crossfade — prevents rest-pose bleed-through.
    const targetWeight = Math.max(1, 0.7 + intensity * 0.6);
    // Skip the mocap clip's first ~80ms — it's the "settle" pre-roll where the
    // skeleton is barely moving. Starting partway in puts the character into
    // motion immediately so a click never reads as a pause.
    const skipSec = Math.min(0.08, next.getClip().duration * 0.1);

    // No .stop() on rivals: a previous action that's mid-fade-out (e.g. its
    // 0.2s return-to-idle) would snap from 0.6 weight to 0 instantly. We let
    // its existing fadeOut interpolant complete naturally instead. Listener
    // bookkeeping is already handled by currentFinishListener above, so there
    // are no ghost handlers to worry about.

    if (this.current !== next) {
      next.reset();
      next.time = skipSec;
      next.setEffectiveWeight(targetWeight);
      this.current.fadeOut(0.1);
      next.fadeIn(0.1).play();
      this.current = next;
    } else {
      // Same action re-clicked: relocate the clip past the pre-roll for a
      // visible restart, but DON'T re-fade — fading the only visible action
      // through 0 would briefly leave the rig with no weighted contributors,
      // flashing the base pose.
      // next.reset();
      // next.time = skipSec;
      next.setEffectiveWeight(targetWeight);
      next.play();
    }

    return new Promise<void>((resolve) => {
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== next) return;
        this.mixer.removeEventListener('finished', onFinished);
        if (this.currentFinishListener === onFinished) {
          this.currentFinishListener = null;
          this.currentPromiseResolve = null;
        }
        next.fadeOut(0.2);
        this.actions.idle.reset().setEffectiveWeight(1).fadeIn(0.2).play();
        this.current = this.actions.idle;
        resolve();
      };
      this.mixer.addEventListener('finished', onFinished);
      this.currentFinishListener = onFinished;
      this.currentPromiseResolve = resolve;
    });
  }

  update(deltaSec: number) {
    this.mixer.update(deltaSec);

    if (this.cpuSkinnedMeshes.length > 0) {
      this.scene.updateMatrixWorld(true);

      for (const item of this.cpuSkinnedMeshes) {
        const { source, position } = item;
        for (let i = 0; i < position.count; i += 1) {
          source.getVertexPosition(i, this.skinnedVertex);
          position.setXYZ(i, this.skinnedVertex.x, this.skinnedVertex.y, this.skinnedVertex.z);
        }
        position.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    for (const item of this.cpuSkinnedMeshes) {
      item.mesh.parent?.remove(item.mesh);
      item.mesh.geometry.dispose();
      asMaterialArray(item.mesh.material).forEach((material) => material.dispose());
    }
    this.scene.parent?.remove(this.scene);
  }
}
