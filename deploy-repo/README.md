# template-web-fullstack-deploy

这是 **GitOps 部署仓**（独立于代码仓 `template-web-fullstack`）。它只包含集群期望状态，不含应用源码。

## 职责边界

| 仓库 | 内容 | 谁写入 |
|---|---|---|
| 代码仓 `template-web-fullstack` | 源码、Dockerfile、`.gitea/workflows/` | 开发者 |
| **本仓（部署仓）** | `k8s/` manifests、Argo CD Application | 开发者手工改配置 + CD 自动回写镜像 tag |

**数据流**：开发者 push 代码仓 → Gitea Actions 构建镜像并推到 Gitea Registry → CD 回写本仓 `k8s/kustomization.yaml` 的两个 `newTag` → Argo CD 检测到本仓变化 → 自动同步到 K8s。

CD 从不直接 `kubectl` 操作集群——集群状态完全由本仓声明，这就是 GitOps 的核心。

## 目录结构

```
k8s/                     Kustomize base，Argo CD 的 source.path 指向这里
  kustomization.yaml     两个镜像的 newTag 由 CD 自动回写（web + api）
  *.yaml                 namespace / deployment / service / ingress / hpa / pdb 等
argocd/
  application.yaml       Argo CD Application CR，部署到 argocd namespace
```

## 初始化步骤

### 1. 在 Gitea 上建仓

在 `gitea.meos.center` 新建一个仓库，例如 `<your-org>/template-web-fullstack-deploy`，把本目录内容作为该仓库的根目录推送：

```bash
cd deploy-repo
git init
git remote add origin https://gitea.meos.center/<your-org>/template-web-fullstack-deploy.git
git add -A && git commit -m "chore: init deploy repo"
git push -u origin main
```

### 2. 替换占位符

推送前先替换以下占位符（详见主仓 README 的占位符清单）：

- `k8s/kustomization.yaml` 与两个 deployment 里的 `gitea.meos.center/your-org/...` → 你的真实 owner/repo
  - 必须与代码仓的 `gitea.repository`（`owner/repo`）一致，否则 CD 推的镜像名与 manifest 对不上
- `k8s/ingress.yaml` 的域名与 TLS secret
- `k8s/api-secret.yaml` 的数据库凭证（生产建议接 Sealed Secrets / ESO）
- `argocd/application.yaml` 的 `repoURL` → 本仓真实地址

### 3. 安装 Argo CD 并注册本仓

在目标集群安装 Argo CD，然后应用 Application CR：

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/application.yaml
```

若 Argo CD 拉取私有 Gitea 仓，需在 Argo CD 中配置仓库凭证（Repository credentials，用只读 PAT）。

### 4. 在代码仓配置 CD

在代码仓 `template-web-fullstack` 的 Settings → Actions → Variables 中设置：

- `DEPLOY_REPO` = `<your-org>/template-web-fullstack-deploy`（本仓的 owner/repo）

并在 Secrets 中设置 PAT（见主仓 README 的 Gitea 配置指引）。

## 回滚

Argo CD 模式下回滚 = 把 `kustomization.yaml` 的 `newTag` 改回旧 SHA：

```bash
git revert <部署仓里那次 tag 回写 commit>
# Argo CD 自动同步回旧镜像
```

或在 Argo CD UI 中手动同步到历史 revision。旧镜像仍保留在 Gitea Registry（CD 每次部署都会打 immutable SHA tag），因此可安全回滚。
