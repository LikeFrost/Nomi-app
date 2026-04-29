# Nomi

一款由 AI 驱动情绪系统的交互式 3D 虚拟伴侣应用。

## 功能简介

- **3D 角色渲染**：基于 Three.js + expo-gl，在移动端实时渲染 Nomi 小女孩动画角色
- **情绪模型**：双轴状态（心情 / 精力）随互动变化、随时间自然衰减
- **AI 驱动**：调用 Claude Haiku 分析行为历史，决定角色的情绪表现和动画参数
- **每日计数**：记录当天互动次数，零点自动重置
- **彩蛋机制**：累计互动 4 次后，状态栏渐入显示

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React Native 0.81 + Expo 54 |
| 3D 渲染 | Three.js 0.184 + expo-gl |
| 动画 | React Native Reanimated 4 |
| AI | @anthropic-ai/sdk（Claude Haiku） |
| 存储 | AsyncStorage |
| 语言 | TypeScript 5.9 |

## 项目结构

```
src/
├── ai/              # LLM 客户端、类型定义、系统提示词
├── components/      # UI 组件（角色画布、按钮、状态栏等）
├── hooks/           # 情绪模型、AI 状态、动画生成、每日计数
├── three/           # Three.js 场景、角色动画控制器、模型加载
├── ui/              # 设计 Token、Card 组件
└── utils/           # 存储封装、数学工具、日期 Key
```

## 快速开始

### 环境要求

- Node.js 18+
- Yarn
- Expo CLI（`npm i -g expo-cli`）
- iOS Simulator / Android Emulator 或真机

### 安装依赖

```bash
yarn install
```

### 配置环境变量

在根目录新建 `.env`：

```env
EXPO_PUBLIC_LLM_BASE_URL=<你的 Claude 代理地址>
EXPO_PUBLIC_LLM_AUTH_TOKEN=<API Token>
EXPO_PUBLIC_LLM_MODEL=claude-haiku-4-5-20251001
```

### 启动

```bash
# 开发服务器
yarn start

# iOS
yarn ios

# Android
yarn android

# Web
yarn web
```

## 架构说明

### 互动流程

```
用户点击按钮（500ms 节流）
  ↓
App.tsx handleAction()
  ├→ 每日计数 +1
  ├→ 记录行为历史（最近 8 条）
  ├→ 情绪增量 + 触发衰减
  ├→ 请求 AI 状态（即发即忘，本地降级兜底）
  ├→ 生成动画参数
  └→ CharacterCard.play(plan)（可打断，Promise 驱动）
```

### 情绪衰减

- 精力衰减时间常数 ~3 分钟，心情 ~5 分钟
- 心情衰减受精力制约：精力越低，心情恢复越慢
- 使用递归 setTimeout 替代 setInterval，防止后台积压

### AI 调用策略

- 立即使用本地降级逻辑返回结果，零延迟
- 后台异步调用 LLM，结果缓存供下次使用
- 连续 3 次失败后冷却 30 秒
- 系统提示词开启 Prompt Caching 降低成本

## 开发规范

项目配置了 Husky pre-commit hooks，提交前自动运行 ESLint + Prettier。

```bash
# 手动 lint
yarn lint

# 类型检查
yarn tsc --noEmit
```
