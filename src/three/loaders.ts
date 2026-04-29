import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const GIRL_TEXTURES: Record<
  number,
  { name: string; module: number; width: number; height: number }
> = {
  0: {
    name: 'Ch46_1001_Specular',
    module: require('../../assets/girl-textures/Ch46_1001_Specular.png'),
    width: 1024,
    height: 1024,
  },
  1: {
    name: 'Ch46_1001_Normal',
    module: require('../../assets/girl-textures/Ch46_1001_Normal.png'),
    width: 1024,
    height: 1024,
  },
  2: {
    name: 'Ch46_1001_Diffuse',
    module: require('../../assets/girl-textures/Ch46_1001_Diffuse.png'),
    width: 1024,
    height: 1024,
  },
  3: {
    name: 'Ch46_1001_Glossiness',
    module: require('../../assets/girl-textures/Ch46_1001_Glossiness.png'),
    width: 1024,
    height: 1024,
  },
};

type GltfParserWithImages = {
  loadImageSource: (sourceIndex: number, loader: unknown) => Promise<THREE.Texture>;
  sourceCache: Record<number, Promise<THREE.Texture> | undefined>;
  json: { images?: Array<{ name?: string }> };
};

async function loadExpoTexture(moduleRef: number, fallback: { width: number; height: number }) {
  const asset = Asset.fromModule(moduleRef);
  await asset.downloadAsync();

  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error('Failed to resolve texture asset URI');

  const texture = new THREE.Texture({
    localUri: uri,
    uri,
    width: asset.width || fallback.width,
    height: asset.height || fallback.height,
  } as unknown as TexImageSource);
  texture.needsUpdate = true;
  return texture;
}

function installNativeEmbeddedTextureLoader(loader: GLTFLoader) {
  if (Platform.OS === 'web') return;

  loader.register((parser) => {
    const imageParser = parser as unknown as GltfParserWithImages;

    return {
      name: 'NOMI_native_embedded_textures',
      beforeRoot() {
        const originalLoadImageSource = imageParser.loadImageSource.bind(imageParser);

        // React Native's Blob cannot be constructed from ArrayBuffer, which
        // GLTFLoader uses for embedded GLB images. Route this model's textures
        // through Expo Asset instead.
        imageParser.loadImageSource = (sourceIndex, imageLoader) => {
          const textureAsset = GIRL_TEXTURES[sourceIndex];
          const sourceName = imageParser.json.images?.[sourceIndex]?.name;
          if (!textureAsset || sourceName !== textureAsset.name) {
            return originalLoadImageSource(sourceIndex, imageLoader);
          }

          const cached = imageParser.sourceCache[sourceIndex];
          if (cached) return cached.then((texture) => texture.clone());

          const promise = loadExpoTexture(textureAsset.module, textureAsset);
          imageParser.sourceCache[sourceIndex] = promise;
          return promise;
        };

        return null;
      },
    };
  });
}

function createGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  installNativeEmbeddedTextureLoader(loader);
  return loader;
}

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
    const loader = createGLTFLoader();
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

  await MeshoptDecoder.ready;
  return new Promise<GLTF>((resolve, reject) => {
    const loader = createGLTFLoader();
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
