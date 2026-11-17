# Gitea GitOps 配置指引

这份文档记录在 `gitea.meos.center`（Gitea 1.22）上跑通本模板 CI/CD 所需的全部配置。代码已推送到 `https://github.com/hesetiema/template-web-fullstack`，你需要把它迁到 Gitea 并完成下面的配置。

## 0. 前置条件（先找 Gitea 管理员确认）

在动手前，请向 `gitea.meos.center` 管理员确认三件事——它们是硬门槛：

1. **Actions 是否启用**：Site Administration → 左侧 `Actions`。若未启用，需在 `app.ini` 设置 `[actions] ENABLED = true` 并重启 Gitea。
2. **Container Registry 是否启用**：Site Administration → `Package Registry` / 配置文件 `[packages]`。CI 要把镜像推到这里。
3. **runner 配额与注册权限**：是否允许你注册个人/组织 runner，实例是否已有共享 runner 可直接用。

> 说明：Gitea Actions 的 job 跑在 **act runner** 里，而 runner 需要 Docker 才能执行 `docker build`。你本机没有 Docker，所以 **runner 必须部署在一台有 Docker 的服务器上**（可以是 Gitea 所在主机，但建议分开，避免构建负载影响 Gitea）。这是整个方案唯一的外部基础设施依赖。

## 1. 迁移代码仓到 Gitea

Simplest：用 Gitea 的迁移功能保留历史。

```
Gitea 网页 → 右上角 + → Migrate Repository
  - Source: GitHub
  - URL: https://github.com/hesetiema/template-web-fullstack
  - 若为私有库，填 GitHub PAT
  - 勾选 "Migrate Issues / Releases"（可选）
  - 目标 owner / 名称：你的组织（如 Persagy-AI）/ template-web-fullstack
```

或手动镜像推送（保留全部 git 历史）：

```bash
git clone --mirror https://github.com/hesetiema/template-web-fullstack.git
cd template-web-fullstack.git
git remote add gitea https://gitea.meos.center/<your-org>/template-web-fullstack.git
git push gitea --all
git push gitea --tags
```

同时新建**部署仓** `template-web-fullstack-deploy`（详见 `deploy-repo/README.md`）。

## 2. 创建 Personal Access Token（PAT）

CD 需要一个 PAT 来推镜像和回写部署仓。**不要用 Gitea 内置的 job token（GITEA_TOKEN）**——Gitea 明确禁止它推送 OCI 镜像。

```
Gitea 网页 → 右上角头像 → Settings → Applications → Generate New Token
  - Token name: giteops-bot
  - 勾选权限：
      ✓ read:repository, write:repository   （回写部署仓 manifest）
      ✓ read:package,    write:package      （推送容器镜像）
      ✓ read:user
  - 生成后立即复制保存（只显示一次）
```

注意：token 的 owner 必须对**代码仓和部署仓都有写权限**（可以用组织级 token，或把两个仓都放在你有权限的组织下）。

## 3. 配置代码仓的 Secrets 与 Variables

在代码仓 `template-web-fullstack`：

```
Settings → Actions → Secrets（或 Variables）
```

| 类型 | 名称 | 值 | 用途 |
|---|---|---|---|
| Secret | `GITEA_TOKEN` | 上一步生成的 PAT | 推镜像 + 回写部署仓 |
| Variable | `DEPLOY_REPO` | `<your-org>/template-web-fullstack-deploy` | CD 克隆部署仓用 |

> `DEPLOY_REPO` 用 Variable 而非 Secret，因为它不是敏感信息，便于在日志里排查。

## 4. 注册 act runner

在一台**有 Docker** 的 Linux 服务器上执行（Gitea 1.22 对应 runner 5.x）：

### 4.1 获取注册 token

```
方式 A（实例级，管理员）：Site Administration → Actions → Runners → Create new runner
方式 B（组织级）：组织 Settings → Actions → Runners → Add Runner
方式 C（仓库级）：代码仓 Settings → Actions → Runners → Add Runner
```

复制生成的 registration token。

### 4.2 用 Docker 启动 runner

```bash
mkdir -p /srv/gitea-runner && cd /srv/gitea-runner

cat > docker-compose.yml <<'EOF'
services:
  runner:
    image: docker.gitea.com/gitea-runner:latest
    restart: unless-stopped
    environment:
      GITEA_INSTANCE_URL: https://gitea.meos.center
      GITEA_RUNNER_REGISTRATION_TOKEN: ${RUNNER_TOKEN}
      GITEA_RUNNER_NAME: giteops-runner-1
      GITEA_RUNNER_LABELS: "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock
EOF

# 把 token 放进 .env（勿提交）
echo "RUNNER_TOKEN=<上一步复制的 token>" > .env
chmod 600 .env

docker compose up -d
docker compose logs -f runner
```

看到 runner 在 Gitea 网页显示为 **Idle** 即注册成功。

> **安全提示**：挂载 `docker.sock` 等于把宿主机 root 权限交给 runner 里的 job。仅限你信任的私有 Gitea 实例（本例符合）。不要在公共实例这么做。

### 4.3 验证标签匹配

workflow 里用的是 `runs-on: ubuntu-latest`，必须与 runner 的 label 一致。上面 `GITEA_RUNNER_LABELS` 已包含 `ubuntu-latest` 映射，无需改 workflow。

## 5. 触发并验证 CI

> **先决条件（最容易踩）**：CI 用 `pnpm install --frozen-lockfile`，仓库必须已有 `pnpm-lock.yaml`。
> 当前仓库尚无锁文件——请在**网络正常**的机器上先执行 `pnpm install` 生成它并提交，否则 CI 会在 install 阶段直接失败：
>
> ```bash
> cd template-web-fullstack
> pnpm install            # 生成 pnpm-lock.yaml
> git add pnpm-lock.yaml && git commit -m "chore: add pnpm lockfile"
> git push gitea main
> ```

在代码仓的 Gitea 副本上做一个小改动（如改 README），push 触发：

- **CI**：checkout → setup-node → corepack 启用 pnpm → install → lint → typecheck → web/api 测试 → build
- **CD**（push 到 main 触发）：构建两个镜像 → 推到 `gitea.meos.center/<owner>/...` → 回写部署仓 `newTag`

常见问题：

- `pnpm: command not found` → CI 里已用 `corepack enable` + `corepack prepare pnpm@10`，确认 runner 镜像的 Node ≥ 22（`.nvmrc` 指定 22）。
- 拉不到 `actions/checkout@v4` → 默认从 github.com 拉；若内网不通，让管理员设置 `[actions] DEFAULT_ACTIONS_URL = self` 或在 Gitea 上镜像这些 action。
- 推镜像 401/403 → PAT 缺 `write:package`，或用了内置 job token。

## 6. 接入集群（后续步骤，当前未做）

CI/CD 半条链路跑通后，接入集群只剩三步：

1. 在目标集群安装 Argo CD（`deploy-repo/README.md` 有命令）。
2. 把 `deploy-repo/` 内容推到部署仓，按该 README 替换占位符。
3. 在 Argo CD 注册 Gitea 部署仓凭证（只读 PAT），apply `argocd/application.yaml`。

之后每次 CD 回写部署仓 tag，Argo CD 会自动同步，无需人工 `kubectl`。

## 速查：谁依赖谁

```
开发者 ──push──> 代码仓(Gitea)
                    │ Actions
                    ├─ CI: 校验 + 测试 + 构建
                    └─ CD: 推镜像 ──> Gitea Registry
                              └──回写──> 部署仓(Gitea) ──Argo CD 拉取──> K8s
```

前置依赖：Gitea(Actions+Registry) + 一台有 Docker 的 runner 服务器。集群按需后续接入。
