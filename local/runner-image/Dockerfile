# Self-contained Forgejo Runner for a LOCAL machine.
# The official runner image is Alpine/musl, which cannot run the official
# glibc Node binary. So: take the forgejo-runner binary from the official
# image (stage 1) and drop it onto node:22-bookworm (Debian/glibc), adding
# git + Docker CLI + Compose plugin. Workflow jobs run in host mode inside
# this container with every tool preinstalled — no per-job image pulls.
FROM data.forgejo.org/forgejo/runner:13 AS runner-bin

FROM node:22-bookworm

# Docker CLI + Compose plugin from Docker's official apt repo. Debian's
# `docker.io` package does NOT include the `docker compose` plugin, which CD
# needs, so use docker-ce-cli + docker-compose-plugin instead.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

COPY --from=runner-bin /bin/forgejo-runner /usr/local/bin/forgejo-runner

# pnpm 10 via corepack (bundled with Node 22), matching .nvmrc / packageManager.
RUN corepack enable && corepack prepare pnpm@10 --activate

ENV HOME=/data
WORKDIR /data
VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/forgejo-runner"]
CMD ["daemon", "--config", "/data/config.yml"]
