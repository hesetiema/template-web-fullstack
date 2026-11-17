# 本机最简交付指南（Forgejo + Runner + Docker Compose）

目标：**零额外花钱、零云服务器**，在你这台 Windows 笔记本上跑通一条完整的 Git 驱动交付链路：

```
git push（本机 Forgejo）
  → Forgejo Actions 自动触发
  → CI：lint / typecheck / 单测 / 构建
  → CD：构建 web + api 镜像 → 本机 docker compose 重启应用
  → 浏览器打开 http://localhost:8080 看到任务看板更新
```

这是一条**精简版 GitOps 链路**：Git 仍是唯一事实来源、push 驱动部署，但"调和（reconcile）"由 CD 任务本身完成，而不是 K3s + Argo CD / Flux 那种常驻控制器。它刻意砍掉了集群，以适应 8GB 内存的本机。文末给了将来升级到真正 pull 式 GitOps 的路径。

---

## 与旧方案（Gitea / K8s / 双仓）相比砍掉了什么

| 项 | 旧方案 | 本机最简方案 |
|---|---|---|
| Git 服务 | 公司 Gitea（已不可用） | 本机 Forgejo 容器 |
| CI/CD | `.gitea/workflows` + 公司 runner | `.forgejo/workflows` + 本机 runner |
| 镜像仓库 | `gitea.meos.center` | 可选；默认镜像只留在本机 Docker |
| 部署目标 | K3s + Argo CD + 独立部署仓 | 本机 `docker compose`（无 K8s） |
| 仓库数 | 代码仓 + 部署仓（双仓） | 单仓 |
| 内存占用 | 4G+ | 约 1.5–2G |

---

## 前置条件（只需做一次）

### 1. 安装 Docker Desktop

本机目前没装 Docker，这一步**必须你手动完成**（命令需管理员权限）：

1. 下载 Docker Desktop for Windows（官网 `docker.com/products/docker-desktop`）。
2. 安装时勾选 **Use WSL 2 instead of Hyper-V**；若提示安装 WSL2，按提示完成并**重启电脑**。
3. 启动 Docker Desktop，确认右下角鲸鱼图标是绿色（engine running）。
4. 打开 PowerShell 验证：

```powershell
docker --version
docker compose version
docker run hello-world   # 能打印 Hello from Docker 即成功
```

> 你的机器约 6.9GB 可用内存。Docker Desktop（WSL2 后端）本身会占 2–3GB。构建时建议关闭 IDE 里不需要的标签页和其他重程序。也可在 Docker Desktop 设置里把 WSL2 内存上限设为 3GB，避免它吃满。

### 2. 确认端口空闲

本机 `3000`（Forgejo）和 `8080`（应用）不能被占用：

```powershell
netstat -ano | findstr ":3000 :8080"
```

有输出说明被占用，先关掉对应程序或改 `local/docker-compose.yml` 与 `local/deploy.images.yml` 里的端口映射。

---

## 部署步骤

### 第 1 步：启动 Forgejo

```powershell
cd C:\Data\200 - Work\220 - Now\template-web-fullstack
copy local\.env.example local\.env
docker compose -f local/docker-compose.yml up -d --build forgejo
```

等约 30 秒，浏览器打开 **http://localhost:3000**。

### 第 2 步：初始化 Forgejo（网页）

1. 首次打开是安装向导：数据库已由环境变量预设为 SQLite，**直接确认**即可。
2. 管理员账号：第一个注册的用户自动成为管理员，按提示创建（例如 `admin`）。
3. 完成后进入主界面。Actions 与包仓库已默认开启，无需手动打开。

### 第 3 步：创建代码仓并把代码推上去

1. 网页右上角 `+` → `New repository`，例如名字填 `template-web-fullstack`，选择 **Private**。
2. 创建后页面会显示 clone 地址（HTTP，形如 `http://localhost:3000/<你的用户名>/template-web-fullstack.git`）。
3. 在本机给现有仓库加一个 remote 并推送：

```powershell
git remote add local http://localhost:3000/<你的用户名>/template-web-fullstack.git
git push -u local main
```

> HTTP 推送需要凭证：用户名用你的 Forgejo 用户名，密码用 Personal Access Token（见下一步）。若想省事，也可在 Forgejo 网页用 ` repository → Settings → 同步镜像` 从 GitHub 导入。

### 第 4 步：创建 Runner 并填写注册信息

1. 网页进入 **Settings → Actions → Runners**（用户级即可，或仓库 `Settings → Actions → Runners`）。
2. 点 **Create new runner**，填名字如 `local-runner`，创建后会显示一段包含 `uuid` 和 `token` 的配置。
3. 把 `local/runner-config.yml` 里这两行替换成实际值：

```yaml
server:
  connections:
    forgejo:
      url: http://forgejo:3000/     # 容器网络内地址，保持不变
      uuid: 粘贴这里                  # 来自网页
      token: 粘贴这里                 # 来自网页
```

### 第 5 步：配置 Actions Secrets

进入仓库 `Settings → Actions → Secrets`，新增（CI 不需要外网 token，CD 也不需要远程 registry；但若第 6 步 CI 里 `actions/checkout` 从公网拉取动作失败，可配置代理，见排障）：

- 通常**无需任何 secret**。Forgejo 内置 job token 足够 checkout 和推送镜像到本地 daemon。

### 第 6 步：启动 Runner，触发流水线

```powershell
docker compose -f local/docker-compose.yml up -d --build
docker logs -f twf-runner
```

看到 `Starting runner daemon` 且网页 Runners 页面显示 runner 为**在线（idle）**即成功。

现在做一次空提交触发流水线：

```powershell
git commit --allow-empty -m "ci: trigger local forgejo pipeline"
git push local main
```

到仓库网页 `Actions` 标签，观察两个工作流依次运行：

- **CI**：lint → typecheck → web/api 单测 → build
- **CD**：构建双镜像 → `docker compose up -d` → 等待健康检查

CI + CD 全部绿色后，浏览器打开 **http://localhost:8080**，任务看板可直接增删改查。

---

## 常用操作

| 目的 | 命令（在仓库根目录的 PowerShell 执行） |
|---|---|
| 看 Forgejo 日志 | `docker logs -f twf-forgejo` |
| 看 Runner 日志 | `docker logs -f twf-runner` |
| 看应用栈状态 | `docker compose -f local/deploy.images.yml ps` |
| 看应用日志 | `docker compose -f local/deploy.images.yml logs -f` |
| 手动重启应用栈 | `docker compose -f local/deploy.images.yml down && docker compose -f local/deploy.images.yml up -d` |
| 完全停机 | `docker compose -f local/docker-compose.yml down`（应用栈单独 down） |
| 本地直连跑（不经过 CI） | `docker compose -f deploy/docker-compose.yml up -d --build` |

---

## 排障

**Q：CI 卡在 `actions/checkout` 下载失败**
A：Forgejo 默认从 `data.forgejo.org` 拉取通用动作，需要外网。若失败，在 Forgejo 服务器的 `app.ini`（容器内 `/data/gitea/conf/app.ini`）确认：
```
[actions]
ENABLED = true
DEFAULT_ACTIONS_URL = https://data.forgejo.org
```
改后 `docker restart twf-forgejo`。若网络不通，可把动作地址换成可访问的镜像源（例如自建缓存），或把 workflow 的 `uses: actions/checkout@v4` 改成直接用 `git clone` 步骤（本机场景下代码已在 runner 容器内也能手动 clone）。

**Q：Runner 一直离线**
A：检查 `local/runner-config.yml` 的 `uuid`/`token` 是否填对、`url` 是否为 `http://forgejo:3000/`；再看 `docker logs twf-runner`。改配置后 `docker restart twf-runner`。

**Q：CD 里 `docker: command not found` 或 socket 权限错误**
A：确认 runner 容器挂了 `/var/run/docker.sock` 且以 `user: root` 运行（见 `local/docker-compose.yml`），并已 `docker compose up -d --build` 重建过 runner 镜像。

**Q：CD 健康检查超时，但容器都起来了**
A：手动 `curl http://localhost:8080/health`，应返回 JSON。若 nginx 返回 502，说明 api 未就绪，看 `docker compose -f local/deploy.images.yml logs api`。

**Q：内存吃紧、构建很慢**
A：这是 8GB 机器的正常现象。CD 用 host 模式复用 runner 容器里的 Node/pnpm/Docker，已避免每个 job 另拉镜像。可在 Docker Desktop 设置里给 WSL2 限内存、关闭其他程序。

---

## 将来想升级到真正的 GitOps（可选）

当前链路的"部署"由 CD 任务主动执行，属于 push 式自动化。若要升级为标准的**pull 式 GitOps**（控制器常驻、自动纠偏、漂移修复），最小增量路径是：

1. 本机 K3s 单节点 + **Flux CD**（比 Argo CD 省一半内存，约 180–300MB）。
2. 把 `local/deploy.images.yml` 的部署声明迁到独立 Git 仓，用 Flux 的 `GitRepository` + `Kustomization` CRD 监视。
3. CD 只负责构建镜像 + 回写镜像 tag；Flux 负责拉取并对账。
4. 镜像仓库可启用 Forgejo 内置 Registry（`FORGEJO__packages__ENABLED=true` 已开），地址形如 `localhost:3000/<owner>/<repo>`。

这一步需要更多内存（建议至少 4GB 可用给集群），等你愿意加机器或加内存再做。当前方案已经能完整验证「push → 自动构建 → 自动部署 → 可观测」的核心闭环。
