# template-web-fullstack

全栈 Web **应用模板**：**Vue 3 + Vite 前端** + **Fastify + TypeScript API** + PostgreSQL，覆盖工程化、测试、容器化，并内置一条**本机即可跑通的 Git 驱动交付链路**（Forgejo + Forgejo Actions + Docker Compose）。

已包含一个可运行的**任务看板**（增删改查 + 数据落库），既是可交付的最小应用，也是验证整条工具链的样例。`apps/web`（SPA）与 `apps/api`（Node 服务）独立构建、独立镜像。

> **当前方案**：本机最简交付 —— 一台装了 Docker Desktop 的机器即可，无需云服务器、无需 K8s、无需公司内网。完整操作步骤见 **[LOCAL-GUIDE.md](./LOCAL-GUIDE.md)**。

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
| CI/CD | Forgejo Actions（`.forgejo/workflows/`，兼容 GitHub Actions 语法，用 `forgejo.*` context） | Forgejo 1.21+ |
| 本机交付 | Forgejo 17.0.1（Git + 内置 Registry）+ Forgejo Runner 13（自构建镜像）+ Docker Compose | — |

> TS 配置文件（`eslint.config.ts` / `prettier.config.ts` / `commitlint.config.ts`）依赖 `jiti` 加载，已列入根 `devDependencies`。
> `pnpm-lock.yaml` 已提交，CI 与 Docker 构建使用 `--frozen-lockfile`，可复现。

## 目录结构

```
.
├── package.json / pnpm-workspace.yaml / turbo.json   # 根：脚本、workspace、任务编排
├── pnpm-lock.yaml                                    # 已提交，保证可复现安装
├── tsconfig.base.json                                # 共享 TS 严格配置
├── eslint.config.ts / prettier.config.ts / commitlint.config.ts
├── .husky/                                           # pre-commit、commit-msg hooks
├── .editorconfig / .nvmrc / .npmrc / .env.example / .gitignore
├── LOCAL-GUIDE.md                                    # 本机最简交付全流程指引（先看这个）
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
│   └── docker-compose.yml                            # postgres + api + web 本地开发栈（源码构建）
├── .forgejo/workflows/
│   ├── ci.yml                                        # lint → typecheck → web/api 测试 → build
│   └── cd.yml                                        # 本机构建双镜像 → docker compose 部署到 :8080
└── local/                                            # 本机 GitOps 栈（唯一需要的基础设施）
    ├── docker-compose.yml                            # Forgejo + Runner（一条命令起）
    ├── runner-config.yml                             # Runner 注册信息 + host-mode label
    ├── runner-image/Dockerfile                       # 自带 Node/pnpm/docker 的 Runner 镜像
    ├── deploy.images.yml                             # CD 部署用的运行时拓扑（镜像版）
    └── .env.example                                  # 本地环境变量样例
```

## 快速开始

分两种场景：

### A. 只想本地跑起应用（不配 CI/CD）

```bash
nvm use                       # Node 22
corepack enable               # 启用 pnpm（pnpm-lock.yaml 已提交）
pnpm install --frozen-lockfile

# 用 Docker 起完整栈（Postgres + API + Web，含自动迁移）
docker compose -f deploy/docker-compose.yml up -d --build
# 打开 http://localhost:8080，任务看板可直接增删改查，API 经 nginx 的 /api 代理转发
```

### B. 想跑通完整交付链路（CI/CD）

按 **[LOCAL-GUIDE.md](./LOCAL-GUIDE.md)** 一步步来：装 Docker Desktop → 起 Forgejo → 建仓 → 配 Runner → push 触发流水线 → 浏览器验收。

常用脚本（根 `package.json`，经 Turbo 编排）：`dev` · `build` · `lint` · `lint:fix` · `format` · `format:check` · `typecheck` · `test` · `test:e2e` · `db:migrate` · `check`。

## 应用与测试要点

- **任务看板 API**：`GET /api/tasks` 列表、`POST /api/tasks` 新建、`PATCH /api/tasks/:id` 切换完成/改名、`DELETE /api/tasks/:id` 删除；Zod 校验输入，缺失资源返回 404。
- **探针分层**：`/health`（liveness）只回答进程存活，绝不查依赖；`/ready`（readiness）检查数据库，不可达返回 503。
- **可测试性**：`buildApp({ env, tasks, checkReady })` 返回 Fastify 实例但不监听端口；测试通过 `app.inject()` 注入假仓储，无需真实数据库。
- **配置校验**：`parseEnv()` 用 Zod 在启动时校验 `DATABASE_URL` 等，配置错误立即失败。
- **迁移**：`apps/api/migrations/*.sql` 按顺序执行并记录到 `schema_migrations`，支持重入；Compose 启动 API 前会先跑迁移。

## 交付链路（本机最简，Forgejo Actions）

```
git push 代码仓 main（本机 Forgejo:3000）
  └─ Forgejo Actions CI: lint → typecheck → web/api 单测 → build
  └─ Forgejo Actions CD: docker build web + api 双镜像
         → docker compose -f local/deploy.images.yml up -d
         → 健康检查通过 → http://localhost:8080 可访问
```

- **单仓**：代码与工作流在一个仓库，无需独立部署仓。
- **Git 驱动**：Git 是唯一事实来源，push 驱动部署；调和由 CD 任务完成（非集群控制器）。
- **镜像**：默认只留在本机 Docker daemon（tag `template-web-fullstack-{web,api}:latest`），不依赖公网 registry；Forgejo 内置 Registry 已开启，可按需启用远程推送。
- **回滚**：`git revert` 触发重新构建并部署旧版本；或用 `docker compose` 切换到保留的旧镜像 tag。
- **升级路径**：想升级到真正的 pull 式 GitOps（K3s + Flux + 独立部署仓 + 镜像 tag 自动回写），见 LOCAL-GUIDE.md 末节。

## 拷入项目前必须替换的占位符

| 位置 | 占位符 | 说明 |
|---|---|---|
| `local/runner-config.yml` | `REPLACE_ME_RUNNER_UUID` / `REPLACE_ME_RUNNER_TOKEN` | 从 Forgejo 网页 Runner 注册信息复制 |
| `local/docker-compose.yml` | `ROOT_URL=http://localhost:3000/`、`DISABLE_REGISTRATION` | 如需改域名/开放注册 |
| `apps/api/src/env.ts` | `DATABASE_URL` 校验 | 按你的数据库地址调整 |
| `local/deploy.images.yml` | `postgres` / `postgres`、`CORS_ORIGIN` | 本机默认值，生产务必改强密码与真实域名 |

## 前置条件与注意事项

- **锁文件**：`pnpm-lock.yaml` 已提交，CI 与 Docker 构建用 `--frozen-lockfile`；改动依赖后须更新并提交锁文件。
- **CI 中的 Husky**：工作流已设 `HUSKY=0`，避免 `prepare` 在 CI 里安装 hooks。
- **本机基础设施**：需 Docker Desktop（WSL2 后端）；8GB 内存可跑，构建时建议关停其他重程序，详见 LOCAL-GUIDE.md。
- **Runner 镜像**：`local/runner-image/Dockerfile` 从官方 runner 镜像取二进制放到 node:22-bookworm，内置 Node/pnpm/git/Docker CLI/Compose；`host` 模式执行 job，避免每个 job 另拉镜像。
- **安全**：本机方案为可信环境优化——runner 容器以 root 运行并挂载宿主 docker.sock，等价于拿到宿主机 root；仅在个人本机使用，勿在生产这样做。真实 secret 不要写进镜像或 Git。
