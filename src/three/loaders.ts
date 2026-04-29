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

function isFileAssetUri(uri: string) {
  return uri.startsWith('file://');
}

function isLoaderReadableAssetUri(uri: string) {
  return (
    isFileAssetUri(uri) ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:')
  );
}

function addReadableUri(candidates: string[], uri: string | null | undefined) {
  if (!uri || candidates.includes(uri)) return;
  // On web, XHR can resolve relative paths; skip the scheme check.
  if (Platform.OS === 'web' || isLoaderReadableAssetUri(uri)) {
    candidates.push(uri);
  }
}

async function forceAssetCacheDownload(asset: Asset) {
  asset.localUri = null;
  asset.downloaded = false;
  await asset.downloadAsync();
}

async function resolveReadableAssetUris(asset: Asset) {
  await asset.downloadAsync();
  const candidates: string[] = [];
  addReadableUri(candidates, asset.localUri);
  addReadableUri(candidates, asset.uri);

  if (candidates.length > 0) return candidates;

  // In native release builds, image assets may initially resolve to Android
  // resource identifiers that React Native Image can use, but Expo GL cannot.
  // Force expo-asset to copy the resource into cache so native GL gets a real
  // file:// path for stbi_load().
  await forceAssetCacheDownload(asset);
  addReadableUri(candidates, asset.localUri);
  addReadableUri(candidates, asset.uri);

  if (candidates.length === 0) {
    throw new Error(`Failed to resolve readable asset URI for ${asset.name}.${asset.type}`);
  }

  return candidates;
}

async function resolveExpoGLTextureFileUri(asset: Asset) {
  await asset.downloadAsync();

  if (asset.localUri && isFileAssetUri(asset.localUri)) {
    return asset.localUri;
  }

  await forceAssetCacheDownload(asset);

  if (asset.localUri && isFileAssetUri(asset.localUri)) {
    return asset.localUri;
  }

  const uri = asset.localUri || asset.uri || '<empty>';
  throw new Error(
    `Failed to resolve file:// texture URI for ${asset.name}.${asset.type}. Got: ${uri}`,
  );
}

async function loadExpoTexture(moduleRef: number, fallback: { width: number; height: number }) {
  const asset = Asset.fromModule(moduleRef);
  const uri = await resolveExpoGLTextureFileUri(asset);

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

          const promise = loadExpoTexture(textureAsset.module, textureAsset).catch((error) => {
            console.warn(`[loadGLB] failed to load native texture ${textureAsset.name}:`, error);
            throw error;
          });
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

async function loadGLBFromUri(uri: string, onProgress?: (loaded: number, total: number) => void) {
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

async function loadGLBFromCandidateUris(
  uris: string[],
  onProgress?: (loaded: number, total: number) => void,
) {
  let lastError: unknown;

  for (const uri of uris) {
    try {
      return await loadGLBFromUri(uri, onProgress);
    } catch (error) {
      lastError = error;
      console.warn('[loadGLB] failed to load GLB candidate:', uri, error);
    }
  }

  throw lastError ?? new Error('Failed to load GLB: no readable URI candidates');
}

// Cross-platform GLB loader.
// Pass in a `require('../../assets/Foo.glb')` value. On web Metro turns this
// into a URI string; on native it's a numeric module id that Asset.fromModule
// resolves to a localUri. We pass the URI directly to loader.load() so that
// embedded textures can resolve relative to the file path on all platforms.
export async function loadGLB(moduleRef: number | string): Promise<GLTF> {
  const asset = Asset.fromModule(moduleRef as number);
  const uris = await resolveReadableAssetUris(asset);

  await MeshoptDecoder.ready;
  return loadGLBFromCandidateUris(uris);
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
  const uris = await resolveReadableAssetUris(asset);

  await MeshoptDecoder.ready;
  return loadGLBFromCandidateUris(uris, onProgress);
}
