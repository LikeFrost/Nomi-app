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

## 尝试 2 后的新现象

- `yarn start` 扫码 Expo Go 预览正常。
- 但 build 安装到手机后仍然纯黑。
- `yarn ios` 打开 iOS 模拟器时看不到人物模型。
- iOS 模拟器日志包括：
  - `It is recommended to log in with your Expo account before proceeding.`
  - `EXGL: gl.pixelStorei() doesn't support this parameter yet!`
  - `THREE.WebGLRenderer: EXT_color_buffer_float extension not supported.`

## 新判断

- Expo Go 正常说明模型、贴图内容和材质本身大概率没有坏。
- build 后黑，更像是 Expo Go/dev 与 standalone/release 的 asset URI 解析方式不同。
- 进一步查源码后发现：
  - `expo-asset` 在 Android release 里可能把图片解析成 Android resource/drawable 标识，或 `file:///android_res/...`。
  - `expo-gl` native 的 `loadImage()` 只接受真实 `file://` 路径，并把它交给 `stbi_load` 读取。
  - React Native `Image` 能用 drawable/resource 标识，但 Expo GL 不能直接用它。
- 所以，即使贴图已经换成 PNG，如果传给 Expo GL 的不是 cache 里的真实 `file://` 文件，也仍然可能显示纯黑。

## 尝试 3

- 在 `src/three/loaders.ts` 增加 `resolveReadableAssetUri()`。
- 逻辑：
  - 先正常执行 `asset.downloadAsync()`；
  - 如果拿到的是 `file://`、`http(s)://` 或 `data:`，直接使用；
  - 如果拿到的是 Android resource/drawable 这类 Expo GL 不可读 URI，就强制把 asset 标记为未下载，再调用 `downloadAsync()`；
  - 这样会让 `expo-asset` 把资源复制到 cache，并最终返回真实 `file://`；
  - 如果仍拿不到可读 URI，就抛出明确错误，避免静默“没模型”。
- 这层保障同时用于：
  - `girl-opt.glb` 模型文件；
  - native 覆盖加载的 4 张 PNG 贴图。

## 当前日志解释

- `Proceed anonymously` / Expo 登录提示：不影响渲染。
- `EXGL: gl.pixelStorei() doesn't support this parameter yet!`：仍然大概率是无害日志，Three 设置了 Expo GL 不支持的 pixel-store 参数。
- `EXT_color_buffer_float extension not supported`：通常是模拟器/WebGL 扩展能力警告，不应单独导致模型完全消失；如果尝试 3 后 iOS 仍看不到人物，需要优先看是否出现新的 asset URI 或 GLB 加载错误。

## 尝试 4

- 拆分 GLB 文件加载和 Expo GL 贴图上传的 URI 判断：
  - GLB 本体：允许 `file://`、`http(s)://`、`data:`，并保留候选 URI 列表逐个尝试；
  - native 贴图：必须拿到真实 `file://`，因为 `expo-gl` 的 `texImage2D` / `texSubImage2D` native 图片路径只读取 `localUri` 且只接受 `file://`。
- 修正尝试 3 的关键漏洞：
  - `http(s)` 可以给 `GLTFLoader` / XHR 加载 GLB；
  - 但不能给 Expo GL 当作本地图片上传；
  - 因此 native 覆盖贴图不再复用“可读 URI”判断，而是强制走 `resolveExpoGLTextureFileUri()`。
- iOS 额外兜底：
  - 如果 GLB 的 `file://` 候选在 iOS 模拟器上被 RN XHR 拒绝，会自动尝试下一个候选 URI，例如 Metro dev server 的 `http://...`；
  - 这样避免 `CharacterRig.create()` 因 GLB 本体加载失败而不触发 `onReady`，导致 splash 一直遮住人物。

## 尝试 4 验证

- `yarn typecheck` 通过。
- `yarn lint` 通过。
- 下一步需要重新跑 `yarn ios`：
  - 如果 iOS 能看到人物，说明问题主要是 URI 类型混用；
  - 如果仍看不到，优先看控制台是否出现 `[loadGLB] failed to load GLB candidate:` 或 `Failed to resolve file:// texture URI`。

## 尝试 4 后的新现象

- iOS 仍然看不到人物。
- 截图里角色加载遮罩已经消失，只剩画布背景：
  - 这说明 `CharacterRig.create()` 大概率已经成功；
  - `onReady` 已触发，splash 和 loading overlay 才会消失；
  - 所以问题从“GLB 没加载”转向“模型进场景后没有画出像素”。
- 控制台仍只有：
  - `EXGL: gl.pixelStorei() doesn't support this parameter yet!`
  - `THREE.WebGLRenderer: EXT_color_buffer_float extension not supported.`
- 没看到明确 GLB/贴图加载错误。

## 尝试 5

- 在 native 上把 GLTF 的 PBR/Physical 材质降级成 `MeshBasicMaterial`：
  - 优先复用 diffuse/baseColor 贴图；
  - 如果贴图没有成功加载，使用一个明显可见的 fallback 色，避免白模融进浅色背景；
  - 关闭 tone mapping，使用 `DoubleSide`，并禁用 frustum culling。
- 在 iOS 上额外增加 CPU skinning fallback：
  - 保留原始 `SkinnedMesh` 和骨骼动画作为驱动；
  - 隐藏原始 `SkinnedMesh`；
  - 新建普通 `Mesh` 作为显示层；
  - 每帧从原始 `SkinnedMesh.getVertexPosition()` 计算骨骼变形后的顶点位置，写入普通 Mesh 的 dynamic position buffer。
- 目的：
  - 绕开 Expo GL / iOS 模拟器上可能不稳定的 skinned mesh bone texture shader 路径；
  - 即使 iOS 的 float bone texture / vertex texture 采样有问题，也能显示和播放动画。

## 尝试 5 验证

- `yarn typecheck` 通过。
- `yarn lint` 通过。
- 下一步重新跑 `yarn ios`。
- 如果仍为空白，下一轮需要加最小 debug primitive：
  - 先在同一个 scene 里画一个固定 cube/plane；
  - 如果 cube 能显示，继续查模型 transform/CPU skin buffer；
  - 如果 cube 也不能显示，说明问题在 GLView/renderer/framebuffer 层。

## 尝试 5 后的新报错

- iOS 卡在加载页，日志：
  - `[CharacterCanvas native] failed to load rig: [TypeError: position.setUsage is not a function (it is undefined)]`
- 原因：
  - GLB 的 `position` attribute 在当前模型里可能是 `InterleavedBufferAttribute`；
  - 普通 `BufferAttribute` 才有 `setUsage()`；
  - interleaved attribute 的 usage 要设置在底层 `attribute.data` 上。

## 尝试 6

- 增加 `setAttributeDynamicUsage()`，同时兼容：
  - `BufferAttribute.setUsage(...)`
  - `InterleavedBufferAttribute.data.setUsage(...)`
- CPU skinning fallback 的 position 类型改成 `BufferAttribute | InterleavedBufferAttribute`。

