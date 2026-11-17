# template-web

全栈 Web 工程模板：**Vue 3 + Vite 前端** + **Fastify + TypeScript API** + PostgreSQL，覆盖工程化、测试、容器化到 GitOps 交付的完整基线。

采用 Turborepo monorepo：`apps/web`（SPA）与 `apps/api`（Node 服务）独立构建、独立镜像、独立扩缩容。两个 `src` 目录仅保留最小占位代码用于验证工具链，业务逻辑请自行替换。

## 技术栈与版本基线

配置基于以下主流稳定版本编写（2026-11），升级大版本时请对照各工具迁移指南：

| 领域 | 工具 | 版本区间 |
|---|---|---|
| 运行时 / 包管理 | Node.js 22、pnpm 10 | `>=22` |
| 前端 | Vue 3.5、Vite 7、@vitejs/plugin-vue 6 | — |
| 后端 | Fastify 5、@fastify/cors 10、@fastify/helmet 12、Zod 4（配置校验）、tsup 8、tsx 4 | — |
| 数据库 | PostgreSQL 16、Drizzle ORM 0.44（仅 schema/查询，迁移用轻量 SQL runner） | — |
| 类型 | TypeScript 5.9、vue-tsc 3 | — |
| Monorepo | Turborepo 2（注意是 `tasks`，非旧版 `pipeline`） | ^2.6 |
| 代码规范 | ESLint 9（flat config）、Prettier 3、typescript-eslint 8、eslint-plugin-vue 10 | — |
| Git 流程 | Husky 9（hook 为纯 shell，无 shebang）、lint-staged 16、commitlint 20（Conventional Commits） | — |
| 测试 | Vitest 3（web: jsdom + @vue/test-utils；api: node + app.inject）、Playwright 1.58 | — |
| 交付 | Docker 多阶段 + nginx-unprivileged、K8s、Argo CD（GitOps，双镜像） | — |

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
├── apps/
│   ├── web/                                          # Vue 3 SPA
│   │   ├── vite.config.ts / vitest.config.ts / playwright.config.ts
│   │   ├── src/  (最小占位组件 + 组件测试 + setup)
│   │   └── e2e/smoke.spec.ts
│   └── api/                                          # Fastify API
│       ├── tsup.config.ts / vitest.config.ts
│       ├── src/
│       │   ├── env.ts              # Zod 启动校验，配置错误 fail fast
│       │   ├── app.ts              # buildApp() 工厂：注入仓储 + 就绪检查，无副作用
│       │   ├── server.ts           # 监听端口 + 优雅关闭
│       │   ├── db/                 # Drizzle client / schema / repository / migrate runner
│       │   ├── routes/             # health（/health、/ready）与 users（示例 CRUD）
│       │   └── routes/routes.test.ts
│       └── migrations/0000_init.sql
├── deploy/
│   ├── Dockerfile                                    # web: node 构建 → nginx-unprivileged:8080
│   ├── Dockerfile.api                                # api: node 构建 → node 非 root:3000
│   ├── nginx.conf                                    # SPA fallback + /api 反向代理 + 安全头
│   └── docker-compose.yml                            # postgres + api + web 本地全栈
├── k8s/                                              # web 全套 + api 全套 + kustomization（双镜像）
├── gitops/argocd-application.yaml                    # Argo CD Application（拉取式 GitOps）
└── .github/workflows/
    ├── ci.yml                                        # lint → typecheck → web/api 测试 → build → e2e
    └── cd.yml                                        # 构建推 web+api 双镜像 → 回写两个 tag → Argo CD 同步
```

## 快速开始

```bash
nvm use                       # Node 22
corepack enable               # 启用 pnpm
cp .env.example .env          # 按需修改（本地默认指向 127.0.0.1 的 Postgres）
pnpm install                  # 安装依赖（prepare 脚本自动装 Husky hooks）

# 方式 A：用 Docker 起完整栈（Postgres + API + Web，含自动迁移）
docker compose -f deploy/docker-compose.yml up --build
# 打开 http://localhost:8080，API 经 nginx 的 /api 代理转发

# 方式 B：本地分别运行（需自行准备 Postgres）
pnpm db:migrate               # 执行 SQL 迁移
pnpm dev                      # Turbo 并行启动 web(5173) 与 api(3000)
```

常用脚本（根 `package.json`，经 Turbo 编排）：`dev` · `build` · `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `test` · `test:e2e` · `db:migrate` · `check`。

## API 设计与测试要点

- **探针分层**：`/health`（liveness）只回答进程存活，绝不查依赖；`/ready`（readiness）检查数据库，不可达返回 503。K8s 中 DB 故障只摘流量，不触发无谓重启。
- **可测试性**：`buildApp({ env, users, checkReady })` 返回 Fastify 实例但不监听端口；测试通过 `app.inject()` 注入假仓储，无需真实数据库。
- **配置校验**：`parseEnv()` 用 Zod 在启动时校验 `DATABASE_URL` 等，配置错误立即失败，不带着坏配置启动。
- **迁移**：`apps/api/migrations/*.sql` 按顺序执行并记录到 `schema_migrations`，支持重入；Docker Compose 与 K8s initContainer 都会在启动 API 前先跑迁移。生产复杂场景可替换为 Drizzle Kit / Prisma。

## 交付链路（GitOps 拉取模型）

```
push main
  └─ CI: lint → typecheck → web/api 单测(带覆盖率) → build → E2E
  └─ CD: 构建并推送 web + api 两个镜像（同一次提交使用相同 short-SHA tag）
         → sed 回写 k8s/kustomization.yaml 中两个 newTag → commit/push
                → Argo CD 检测 Git 变更 → 自动同步（prune + selfHeal）
```

- **回滚**：`git revert` 那次 tag 回写提交，Argo CD 同步回旧镜像；或在 Argo CD 手动同步到历史 revision。
- **发布策略**：web 与 api 均默认滚动更新（`maxSurge: 1` / `maxUnavailable: 0`）+ 就绪探针零停机；各自配 HPA 与 PDB。
- **流量入口**：Ingress `/` → web Service(80)；`/api`、`/api/` → api Service(3000)。容器内 web 的 nginx 也通过 `api:3000` 直接反代（Compose 与 K8s 同名字段，配置一致）。

## 拷入项目前必须替换的占位符

| 位置 | 占位符 | 说明 |
|---|---|---|
| `apps/api/src/env.ts` | `DATABASE_URL` 校验 | 按你的数据库地址调整 |
| `k8s/api-secret.yaml` | `postgres://REPLACE_ME...` | 生产改用 Sealed Secrets / ESO，勿提交明文 |
| `k8s/api-configmap.yaml` | `CORS_ORIGIN` 域名 | 改为真实前端域名 |
| `k8s/api-deployment.yaml`、`k8s/kustomization.yaml` | `ghcr.io/your-org/template-web-api` | 真实 API 镜像仓库地址 |
| `k8s/deployment.yaml`、`k8s/kustomization.yaml` | `ghcr.io/your-org/template-web` | 真实 Web 镜像仓库地址 |
| `k8s/ingress.yaml` | `web.example.com`、`letsencrypt-prod` | 域名与 cert-manager ClusterIssuer |
| `gitops/argocd-application.yaml` | `repoURL`、`targetRevision` | 你的 Git 仓库地址 |

## 前置条件与注意事项

- **锁文件**：Dockerfile 与 CI 用 `pnpm install --frozen-lockfile`，首次需本地 `pnpm install` 生成并提交 `pnpm-lock.yaml`，否则构建失败。
- **CD 写权限**：CD 需回写仓库，`contents: write` 已配置；建议主分支采用 PR + squash 的合并策略。
- **CI 中的 Husky**：工作流已设 `HUSKY=0`，避免 `prepare` 在 CI 里安装 hooks。
- **kustomization 位置**：必须在 `k8s/` 内（kustomize 不允许 `resources` 引用父目录之外的文件），Argo CD `source.path` 指向 `k8s`。
- **非 root 容器**：web 的 nginx 监听 8080、api 监听 3000；只读根文件系统下分别为可写路径挂载 `emptyDir`。
- **数据库**：模板未包含生产 Postgres 工作负载（生产多用托管数据库或独立 StatefulSet/Operator，需持久化与备份策略）；Compose 中的 db 仅供本地开发。
- **密钥**：切勿把真实 secret 写进镜像或 Git；K8s Secret 仅 base64 编码，不等于加密。
