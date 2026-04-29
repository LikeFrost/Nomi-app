# Android GLB 贴图问题排查记录

日期：2026-04-30

## 问题现象

- 开发模式下角色显示正常。
- Android build 后下载安装到手机，角色模型本体能加载，但皮肤/贴图丢失。
- 最初的 LogBox 报错：
  - `THREE.GLTFLoader: Couldn't load texture {"_h":1,"_i":2,"_j":{},"_k":null}`
  - 后续展开 Metro 日志后看到：`Error: Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported`。
- 同时出现过的其他日志：
  - `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
  - `EXGL: gl.pixelStorei() doesn't support this parameter yet!`

## 资源情况

- 角色模型是 `assets/girl-opt.glb`。
- 这是一个二进制 glTF/GLB 文件，不是一个 `.gltf` 加外部贴图文件的目录结构。
- GLB 内嵌了 4 张图片：
  - `Ch46_1001_Specular`
  - `Ch46_1001_Normal`
  - `Ch46_1001_Diffuse`
  - `Ch46_1001_Glossiness`
- 这 4 张内嵌图片的格式都是 `image/webp`。
- GLB 同时在 `extensionsUsed` 和 `extensionsRequired` 里声明了 `EXT_texture_webp`。

## 根因判断

- `GLTFLoader` 读取 GLB 内嵌图片时，会先根据图片的 `bufferView` 取出二进制数据。
- 对于内嵌图片，Three 会用 `ArrayBuffer` 创建临时 `Blob`，然后通过临时 object URL 加载贴图。
- React Native 的 Blob 实现不支持从 `ArrayBuffer` / `ArrayBufferView` 创建 Blob。
- 所以 native build 下模型几何体和动画还能加载，但贴图加载全部失败。

## 尝试 1

- 把 GLB 内嵌的 4 张 WebP 文件抽取到 `assets/girl-textures/`。
- 在 `src/three/loaders.ts` 里加了一个仅 native 使用的 `GLTFLoader` 插件。
- 这个插件拦截 `parser.loadImageSource()`，只处理 `girl-opt.glb` 已知的 4 个贴图 source name。
- 不再让 `GLTFLoader` 走 `Blob(ArrayBuffer)`，而是从 `expo-asset` 的本地 URI 创建 `THREE.Texture`。
- `yarn typecheck` 和 `yarn lint` 都通过。

## 尝试 1 的结果

- 原来的 `Couldn't load texture` / Blob 报错消失。
- 但 Android 上角色变成纯黑。

## 尝试 1 可能失败的原因

- 抽取出来的文件仍然是 WebP。
- Expo GL native 通过 `texImage2D` / `texSubImage2D` 上传本地图片，并依赖 native 图片解码器。
- 当前安装的 `expo-gl` 包里，native 解码支持更偏向 JPEG/PNG；native 加载路径会用 `stbi_load` 读取 `file://` 本地 URI。
- 因此 WebP 本地文件上传在这里不可靠。
- 如果纹理上传失败或拿到空数据，JS 侧不一定再出现 `GLTFLoader` 报错，但材质采样会显示成黑色。
- `EXGL: gl.pixelStorei() doesn't support this parameter yet!` 大概率不是主因。Three 会设置一些 WebGL pixel-store 参数，Expo GL 不支持/忽略它们，所以会打日志，但这类日志比较常见。

## 尝试 2

- 把 4 张抽取出的 WebP 贴图转换成 PNG：
  - `assets/girl-textures/Ch46_1001_Specular.png`
  - `assets/girl-textures/Ch46_1001_Normal.png`
  - `assets/girl-textures/Ch46_1001_Diffuse.png`
  - `assets/girl-textures/Ch46_1001_Glossiness.png`
- 更新 `src/three/loaders.ts`，让 native 贴图覆盖逻辑指向 PNG 文件，而不是 WebP 文件。
- 保留 source name 校验，确保这段覆盖逻辑只作用于当前模型的已知贴图，不会误伤其他 GLB 的 source index 0-3。

## 其他改动

- 把 native 和 web 角色 canvas 里的 `THREE.Clock` 替换成 `performance.now()` / `Date.now()` 计算 delta。
- 这个改动只用于解决弃用 warning，不是皮肤丢失的根因。

## 验证计划

- 运行 `yarn typecheck`。
- 运行 `yarn lint`。
- 重新 build/install 到 Android。
- 确认：
  - 不再出现 `THREE.GLTFLoader: Couldn't load texture`；
  - 角色有正常贴图，不是纯黑；
  - 动画仍然正常；
  - 可能仍会存在一类无害日志：`EXGL: gl.pixelStorei() doesn't support this parameter yet!`。

## 尝试 2 执行成功!!!