import * as THREE from 'three';
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

export class CharacterRig {
  scene: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<ActionName, THREE.AnimationAction>;
  current: THREE.AnimationAction;
  // Tracks the in-flight play() so a new play() can pre-empt it: removing the
  // pending 'finished' listener and resolving the old promise as superseded.
  private currentFinishListener: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  private currentPromiseResolve: (() => void) | null = null;

  private constructor(args: {
    scene: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Record<ActionName, THREE.AnimationAction>;
  }) {
    this.scene = args.scene;
    this.mixer = args.mixer;
    this.actions = args.actions;
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
  }

  dispose() {
    this.mixer.stopAllAction();
    this.scene.parent?.remove(this.scene);
  }
}
