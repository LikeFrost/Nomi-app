# Nomi — 初始开发计划

## 目标

构建一个可交互的 AI 驱动虚拟伴侣 App，以 Nomi 小女孩动画角色为核心，V1 覆盖完整的核心体验闭环：3D 角色展示 → 用户互动 → 情绪反馈 → AI 驱动动画。

---

## 阶段一：基础工程搭建

**目标**：跑通 Expo + Three.js 渲染管线，确认移动端 WebGL 可行性。

- [x] 初始化 Expo 项目（React Native + TypeScript）
- [x] 集成 expo-gl，构建 "假 Canvas" 桥接层供 Three.js 使用
- [x] 搭建 Three.js 场景：相机、灯光、色调映射
- [x] 加载 GLB 角色模型（MeshoptDecoder 压缩格式）
- [x] 实现基础渲染循环（requestAnimationFrame）

**关键决策**：不使用第三方 Three.js-RN 封装库，直接通过 `expo-gl` 暴露 WebGL context，手动创建 fake HTMLCanvas 对象传入 Three.js，保持对渲染层的完全控制。

---

## 阶段二：角色动画系统

**目标**：角色能够响应触发，播放四段动画剪辑并平滑过渡。

- [x] 实现 `CharacterRig`：封装 AnimationMixer，管理 Idle / Greeting / Kiss / Cheering 剪辑
- [x] 动画打断机制：新动作直接 crossfade，不排队
- [x] 跳过每段剪辑前 ~80ms 稳定帧，提升响应即时感
- [x] `play()` 返回 Promise，动画结束后自动淡回 Idle
- [x] `timeScale` 和 `weight` 动态调整接口

---

## 阶段三：情绪模型

**目标**：建立可感知、真实的情绪状态系统。

- [x] 双轴状态（mood / energy）定义，范围 `[0, 1]`
- [x] 每种动作的情绪增量参数化
- [x] 饱和增量函数（靠近极值时增益递减）
- [x] 指数衰减：能量和心情独立时间常数，心情衰减受精力影响
- [x] 使用递归 setTimeout 驱动衰减 tick（非 setInterval）
- [x] AsyncStorage 持久化，后台时长补偿衰减

---

## 阶段四：AI 集成

**目标**：接入 Claude Haiku，让角色的情绪表达由 AI 上下文感知驱动。

- [x] 定义 AI 输入 / 输出类型（AIInput / AIOutput）
- [x] 编写系统提示词，描述情绪语义和输出格式
- [x] 集成 `@anthropic-ai/sdk`，启用系统提示词 Prompt Caching
- [x] 实现 `useAIState`：
  - 维护最近 8 条行为历史
  - 即发即忘模式：立即返回本地降级结果
  - 后台 LLM 调用，结果缓存供下次触发使用
  - 3 次失败后 30 秒冷却
- [x] 本地降级逻辑（无网络 / 超时时使用）
- [x] 5 秒窗口点击频率检测（识别"狂点"行为）

---

## 阶段五：动画参数生成

**目标**：将 AI 输出和情绪状态映射为具体的动画执行计划。

- [x] `useAnimationGenerator`：情绪 × AI 输出 → AnimationPlan
- [x] mixerSpeed 映射：pace × energy 插值，范围 0.4–1.6×
- [x] intensity 映射：精力不足时压制最多 35%
- [x] 无聊跳过逻辑：boredom > 0.7 且 intensity < 0.15 时跳过动作，保持 Idle

---

## 阶段六：UI 组装

**目标**：完成完整的用户界面，所有模块联动。

- [x] 设计 Token（theme.ts）：软糖 Bento 配色、圆角、阴影
- [x] `ActionButtons`：三个动作按钮，带手势反馈
- [x] `StatusBars`：心情 / 精力进度条 + 重置按钮
- [x] `Header`：每日互动计数展示（中文）
- [x] `SplashOverlay`：脉冲光环加载动画，角色就绪后淡出
- [x] `CharacterCard`：整合 CharacterCanvas + 加载状态 + 进度遮罩
- [x] `App.tsx`：组合所有 Hook 和组件，实现完整互动流程（500ms 节流）

---

## 阶段七：彩蛋与打磨

**目标**：增加探索感，提升整体体验质感。

- [x] 状态栏彩蛋：第 4–7 次互动渐入显示
- [x] 动画过渡优化：AI 输出平滑插值，防止跳变
- [x] 跨平台 CORS 处理：Web 端通过 Expo dev server 代理 LLM 请求
- [x] Husky pre-commit hooks（ESLint + lint-staged）

---

## 已知风险与应对

| 风险 | 应对策略 |
|------|----------|
| LLM 延迟影响交互体验 | 即发即忘 + 本地降级，零等待 |
| 移动端 Three.js 兼容性 | 自建 fake Canvas 桥接，避免依赖第三方 shim |
| 后台精力衰减不准确 | 记录离开时间戳，前台恢复时补算衰减量 |
| 动画卡顿 / 重叠 | 预抢占 crossfade，新动作立即打断旧动作 |
| Token 成本 | Prompt Caching + 1.5s 超时快速降级 |

---

## V2 方向（暂不实现）

- 多角色 / 皮肤系统
- 推送通知（角色心情低落提醒）
- 社交分享（状态截图）
- 成就 / 里程碑系统
- 更丰富的互动动作
