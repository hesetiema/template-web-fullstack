# template-web

Vue 3 + Vite + TypeScript web 工程模板，覆盖工程化、测试、容器化与 GitOps 交付的完整基线。
本仓库以**配置模板**为核心：`apps/web/src` 下仅保留最小占位文件，便于验证工具链联通，业务代码请自行替换。

## 技术栈与版本基线

配置基于以下主流稳定版本编写（2026-11），升级大版本时请对照各工具迁移指南：

| 领域 | 工具 | 版本区间 |
|---|---|---|
| 运行时 / 包管理 | Node.js 22、pnpm 10 | `>=22` |
| 框架 / 构建 | Vue 3.5、Vite 7、@vitejs/plugin-vue 6 | — |
| 类型 | TypeScript 5.9、vue-tsc 3 | — |
| Monorepo | Turborepo 2（注意是 `tasks`，非旧版 `pipeline`） | ^2.6 |
| 代码规范 | ESLint 9（flat config）、Prettier 3、typescript-eslint 8、eslint-plugin-vue 10 | — |
| Git 流程 | Husky 9（hook 为纯 shell，无 shebang）、lint-staged 16、commitlint 20（Conventional Commits） | — |
| 测试 | Vitest 3 + jsdom + @vue/test-utils、Playwright 1.58 | — |
| 交付 | Docker 多阶段 + nginx-unprivileged、K8s、Argo CD（GitOps） | — |

> TS 配置文件（`eslint.config.ts` / `prettier.config.ts` / `commitlint.config.ts`）依赖 `jiti` 加载，已列入根 `devDependencies`。
> `npm` 用户可将 config 改为 `.mjs`；本模板默认 pnpm。

## 目录结构

```
.
├── package.json / pnpm-workspace.yaml / turbo.json   # 根：脚本、workspace、任务编排
├── tsconfig.base.json                                # 共享 TS 严格配置
├── eslint.config.ts / prettier.config.ts / commitlint.config.ts
├── .husky/                                           # pre-commit、commit-msg hooks
├── .editorconfig / .nvmrc / .npmrc / .env.example / .gitignore
├── apps/web/
│   ├── package.json / tsconfig*.json / vite.config.ts
│   ├── vitest.config.ts / playwright.config.ts
│   ├── src/                                          # 最小占位源码（可替换）
│   ├── e2e/smoke.spec.ts                             # E2E 示例
│   └── index.html
├── deploy/
│   ├── Dockerfile                                    # 多阶段：deps → build → nginx
│   ├── nginx.conf                                    # SPA fallback / gzip / 缓存 / 安全头 / /health
│   └── docker-compose.yml                            # 本地生产态预览
├── k8s/                                              # namespace / sa / configmap / deployment /
│   └── kustomization.yaml                            # service / ingress / hpa / pdb + 镜像 tag 基线
├── gitops/argocd-application.yaml                    # Argo CD Application（拉取式 GitOps）
└── .github/workflows/
    ├── ci.yml                                        # PR/push: lint → typecheck → test → build → e2e
    └── cd.yml                                        # main: 构建推镜像 → 回写镜像 tag → Argo CD 同步
```

## 快速开始

```bash
nvm use                       # Node 22
corepack enable               # 启用 pnpm
pnpm install                  # 安装依赖（prepare 脚本会自动装 Husky hooks）
pnpm dev                      # 本地开发，http://localhost:5173
pnpm check                    # lint + typecheck + test
pnpm build                    # vue-tsc 类型检查 + vite 构建
```

常用脚本（均定义在根 `package.json`，经 Turbo 编排）：`dev` · `build` · `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `test` · `test:e2e` · `check`。

## 交付链路（GitOps 拉取模型）

```
开发者 push main
   └─> CI: lint → typecheck → unit test → build → E2E
   └─> CD: 构建镜像 → 推送 GHCR（tag = commit SHA）
          → sed 回写 k8s/kustomization.yaml 的 newTag → git commit/push
                 → Argo CD 检测 Git 变更 → 自动同步到集群（prune + selfHeal）
```

- 回滚：`git revert` 那次 tag 回写提交，Argo CD 自动同步回旧镜像；或在 Argo CD 中手动同步到历史 revision。
- 发布策略：默认滚动更新（`maxSurge: 1` / `maxUnavailable: 0`），配合就绪探针实现零停机；蓝绿/金丝雀可在 Ingress 或网关层扩展。
- 探针：K8s 三类探针均指向 nginx 的 `/health`；`startupProbe` 容忍慢启动，`readiness` 控制流量接入。

## 拷入项目前必须替换的占位符

| 位置 | 占位符 | 说明 |
|---|---|---|
| `k8s/deployment.yaml`、`k8s/kustomization.yaml` | `ghcr.io/your-org/template-web` | 改为真实镜像仓库地址 |
| `k8s/ingress.yaml` | `web.example.com`、`letsencrypt-prod` | 域名与 cert-manager ClusterIssuer |
| `gitops/argocd-application.yaml` | `repoURL`、`targetRevision` | 你的 Git 仓库地址 |
| `.github/workflows/cd.yml` | `IMAGE_NAME`（取 `github.repository`） | 如镜像名与仓库名不同需调整 |
| `.env.example` | `VITE_API_BASE_URL` | 后端地址；前端仅暴露 `VITE_` 前缀变量 |

## 前置条件与注意事项

- **锁文件**：`deploy/Dockerfile` 与 CI 使用 `pnpm install --frozen-lockfile`，首次需先本地 `pnpm install` 生成并提交 `pnpm-lock.yaml`，否则构建失败。
- **CD 写权限**：CD 需回写仓库，`contents: write` 已配置；推送到 `main` 需是合并后的分支策略（PR + squash 等），避免直接在受保护分支上强推。
- **CI 中的 Husky**：工作流已设 `HUSKY=0`，避免 `prepare` 在 CI 里安装 hooks。
- **kustomization 位置**：必须放在 `k8s/` 内（kustomize 不允许 `resources` 引用父目录之外的文件），Argo CD `source.path` 指向 `k8s`。
- **非 root nginx**：容器监听 `8080`（镜像用户无法绑定 80），`readOnlyRootFilesystem` 下为 nginx 挂载了 `/tmp`、`/var/cache/nginx` 的 `emptyDir`。
- **Type-aware ESLint 规则**：`eslint.config.ts` 使用 `projectService: true`，需保证 `tsconfig` 覆盖被检查文件；若报解析错误，检查 `apps/web/tsconfig.app.json` 的 `include`。
- **密钥**：切勿将真实 secret 写入镜像或 Git；K8s Secret 请用 Sealed Secrets / External Secrets Operator 管理。
