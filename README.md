# template-web-fullstack

全栈 Web **应用模板**：**Vue 3 + Vite 前端** + **Fastify + TypeScript API** + PostgreSQL，覆盖工程化、测试、容器化到 Gitea + Argo CD 的 GitOps 交付链路。

已包含一个可运行的**任务看板**（增删改查 + 数据落库），既是可交付的最小应用，也是验证整条工具链的样例。`apps/web`（SPA）与 `apps/api`（Node 服务）独立构建、独立镜像、独立扩缩容。

> **当前阶段**：代码仓 + CI/CD 工作流 + 独立部署仓骨架已就绪。集群尚未接入——端到端 GitOps 的最后一步（Argo CD → K8s）按需要后续完成。
> 在 Gitea 上跑通 CI/CD 的完整配置步骤见 **[GITEA-GUIDE.md](./GITEA-GUIDE.md)**。

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
| CI/CD | Gitea Actions（`.gitea/workflows/`，兼容 GitHub Actions 语法） | Gitea 1.22+ |
| 交付 | Docker 多阶段 + nginx-unprivileged、K8s、Argo CD（双仓 GitOps，双镜像） | — |

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
├── GITEA-GUIDE.md                                    # Gitea 侧配置全流程指引
├── apps/
│   ├── web/                                          # Vue 3 SPA（任务看板前端）
│   │   ├── vite.config.ts / vitest.config.ts / playwright.config.ts
│   │   ├── src/App.vue                               # 任务看板 UI
│   │   ├── src/composables/useTasks.ts               # API 调用封装（fetch）
│   │   └── e2e/smoke.spec.ts
│   └── api/                                          # Fastify API
│       ├── tsup.config.ts / vitest.config.ts
│       ├── src/
│       │   ├── env.ts              # Zod 启动校验，配置错误 fail fast
│       │   ├── app.ts              # buildApp() 工厂：注入仓储 + 就绪检查，无副作用
│       │   ├── server.ts           # 监听端口 + 优雅关闭
│       │   ├── db/                 # Drizzle client / schema / repository / migrate runner
│       │   ├── routes/             # health（/health、/ready）与 tasks（完整 CRUD）
│       │   └── routes/routes.test.ts
│       └── migrations/0000_init.sql
├── deploy/
│   ├── Dockerfile                                    # web: node 构建 → nginx-unprivileged:8080
│   ├── Dockerfile.api                                # api: node 构建 → node 非 root:3000
│   ├── nginx.conf                                    # SPA fallback + /api 反向代理 + 安全头
│   └── docker-compose.yml                            # postgres + api + web 本地全栈
├── .gitea/workflows/
│   ├── ci.yml                                        # lint → typecheck → web/api 测试 → build
│   └── cd.yml                                        # 构建推双镜像到 Gitea Registry → 回写部署仓 tag
└── deploy-repo/                                      # 独立 GitOps 部署仓骨架（单独推送）
    ├── README.md                                     # 部署仓职责与初始化步骤
    ├── argocd/application.yaml                       # Argo CD Application
    └── k8s/                                          # web + api 全套 + kustomization（双镜像）
```

## 快速开始

```bash
nvm use                       # Node 22
corepack enable               # 启用 pnpm
cp .env.example .env          # 按需修改（本地默认指向 127.0.0.1 的 Postgres）
pnpm install                  # 安装依赖（prepare 脚本自动装 Husky hooks；首次会生成 pnpm-lock.yaml）

# 方式 A：用 Docker 起完整栈（Postgres + API + Web，含自动迁移）
docker compose -f deploy/docker-compose.yml up --build
# 打开 http://localhost:8080，任务看板可直接增删改查，API 经 nginx 的 /api 代理转发

# 方式 B：本地分别运行（需自行准备 Postgres）
pnpm db:migrate               # 执行 SQL 迁移
pnpm dev                      # Turbo 并行启动 web(5173) 与 api(3000)
```

常用脚本（根 `package.json`，经 Turbo 编排）：`dev` · `build` · `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `test` · `test:e2e` · `db:migrate` · `check`。

## 应用与测试要点

- **任务看板 API**：`GET /api/tasks` 列表、`POST /api/tasks` 新建、`PATCH /api/tasks/:id` 切换完成/改名、`DELETE /api/tasks/:id` 删除；Zod 校验输入，缺失资源返回 404。
- **探针分层**：`/health`（liveness）只回答进程存活，绝不查依赖；`/ready`（readiness）检查数据库，不可达返回 503。K8s 中 DB 故障只摘流量，不触发无谓重启。
- **可测试性**：`buildApp({ env, tasks, checkReady })` 返回 Fastify 实例但不监听端口；测试通过 `app.inject()` 注入假仓储，无需真实数据库。
- **配置校验**：`parseEnv()` 用 Zod 在启动时校验 `DATABASE_URL` 等，配置错误立即失败。
- **迁移**：`apps/api/migrations/*.sql` 按顺序执行并记录到 `schema_migrations`，支持重入；Compose 与 K8s initContainer 都会在启动 API 前先跑迁移。

## 交付链路（双仓 GitOps，Gitea）

```
开发者 push 代码仓 main
  └─ Gitea Actions CI: lint → typecheck → web/api 单测 → build
  └─ Gitea Actions CD: 构建 web + api 双镜像 → 推到 gitea.meos.center/<owner>/...
         → clone 部署仓 → sed 回写 k8s/kustomization.yaml 两个 newTag → commit/push
                → Argo CD 检测部署仓变更 → 自动同步（prune + selfHeal）→ K8s
```

- **双仓分离**：代码仓只放源码与 workflow；部署仓（骨架见 `deploy-repo/`）只放 manifests。Argo CD 只盯部署仓，CD 从不直接 `kubectl` 操作集群。
- **镜像 tag**：同一次提交的两个镜像用同一个 short-SHA，回写时一次替换所有 `newTag`，保持 web/api 版本一致。
- **回滚**：`git revert` 部署仓那次 tag 回写提交，Argo CD 同步回旧镜像；旧镜像保留在 Gitea Registry。
- **发布策略**：web 与 api 均滚动更新（`maxSurge: 1` / `maxUnavailable: 0`）+ 就绪探针；各自配 HPA 与 PDB。
- **流量入口**：Ingress `/` → web Service(80)；`/api`、`/api/` → api Service(3000)。

完整的 Gitea 配置（建仓、PAT、runner、secrets）见 **[GITEA-GUIDE.md](./GITEA-GUIDE.md)**；部署仓初始化见 **[deploy-repo/README.md](./deploy-repo/README.md)**。

## 拷入项目前必须替换的占位符

| 位置 | 占位符 | 说明 |
|---|---|---|
| `apps/api/src/env.ts` | `DATABASE_URL` 校验 | 按你的数据库地址调整 |
| `deploy-repo/k8s/api-secret.yaml` | `postgres://REPLACE_ME...` | 生产改用 Sealed Secrets / ESO，勿提交明文 |
| `deploy-repo/k8s/api-configmap.yaml` | `CORS_ORIGIN` 域名 | 改为真实前端域名 |
| `deploy-repo/k8s/{deployment,api-deployment,kustomization}.yaml` | `gitea.meos.center/your-org/...` | 真实 owner/repo，须与代码仓的 `gitea.repository` 一致 |
| `deploy-repo/k8s/ingress.yaml` | `web.example.com`、`letsencrypt-prod` | 域名与 cert-manager ClusterIssuer |
| `deploy-repo/argocd/application.yaml` | `repoURL` | 部署仓真实 Gitea 地址 |
| `.gitea/workflows/cd.yml` / 代码仓 Actions Variables | `DEPLOY_REPO`、`GITEA_TOKEN` | 见 GITEA-GUIDE.md |

## 前置条件与注意事项

- **锁文件**：Dockerfile 与 CI 用 `pnpm install --frozen-lockfile`，首次需本地 `pnpm install` 生成并提交 `pnpm-lock.yaml`，否则构建失败。
- **CI 中的 Husky**：工作流已设 `HUSKY=0`，避免 `prepare` 在 CI 里安装 hooks。
- **kustomization 位置**：必须在部署仓 `k8s/` 内（kustomize 不允许 `resources` 引用父目录之外的文件），Argo CD `source.path` 指向 `k8s`。
- **非 root 容器**：web nginx 监听 8080、api 监听 3000；只读根文件系统下分别为可写路径挂载 `emptyDir`。
- **数据库**：模板未包含生产 Postgres 工作负载（生产多用托管数据库或独立 StatefulSet/Operator）；Compose 中的 db 仅供本地开发。
- **密钥**：切勿把真实 secret 写进镜像或 Git；K8s Secret 仅 base64 编码，不等于加密。
- **Runner 依赖 Docker**：Gitea Actions 的 job 用 Docker 构建镜像，runner 必须部署在有 Docker 的机器上（详见 GITEA-GUIDE.md）。
