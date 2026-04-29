import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Cross-platform GLB loader.
// Pass in a `require('../../assets/Foo.glb')` value. On web Metro turns this
// into a URI string; on native it's a numeric module id that Asset.fromModule
// resolves to a localUri. We pass the URI directly to loader.load() so that
// embedded textures can resolve relative to the file path on all platforms.
export async function loadGLB(moduleRef: number | string): Promise<GLTF> {
  const asset = Asset.fromModule(moduleRef as number);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error('Failed to resolve asset URI');

  await MeshoptDecoder.ready;
  return new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(uri, resolve, undefined, reject);
  });
}

// On web, large GLBs benefit from progress reporting. The caller can pass an
// onProgress callback; we pipe XHR progress events through.
export async function loadGLBWithProgress(
  moduleRef: number | string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<GLTF> {
  if (Platform.OS !== 'web') {
    // Native doesn't expose download progress through Asset, so just fall back
    return loadGLB(moduleRef);
  }
  const asset = Asset.fromModule(moduleRef as number);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error('Failed to resolve asset URI');

  return new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      uri,
      resolve,
      (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded, event.total);
      },
      reject,
    );
  });
}
