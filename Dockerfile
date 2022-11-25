
FROM denoland/deno:alpine AS deno

FROM --platform=linux/amd64 frolvlad/alpine-glibc as node
RUN --mount=type=cache,target=/var/cache/apk apk add nodejs npm yarn bash
COPY --from=deno /bin/deno /usr/local/bin/deno
CMD echo "Alpine" `cat /etc/alpine-release` && echo "Node" `node --version` && echo "Deno" `deno --version`

FROM --platform=linux/amd64 node as buildbox
RUN --mount=type=cache,target=/var/cache/apk apk add python3 py3-pip make gcc musl-dev g++ go

FROM --platform=linux/amd64 buildbox as sourcebase
WORKDIR /src
COPY package.json package.json 
COPY yarn.lock yarn.lock
COPY packages/client/package.json packages/client/package.json
COPY packages/daemon/package.json packages/daemon/package.json
COPY packages/pocketbase/package.json packages/pocketbase/package.json
COPY packages/pockethost.io/package.json packages/pockethost.io/package.json
COPY packages/releases/package.json packages/releases/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/tools/package.json packages/tools/package.json
COPY patches patches
RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn install
COPY packages/releases packages/releases
COPY packages/tools packages/tools
COPY packages/schema packages/schema

FROM --platform=linux/amd64 sourcebase as pocketbase-build
WORKDIR /src
COPY packages/pocketbase packages/pocketbase
WORKDIR /src/packages/pocketbase
RUN --mount=type=cache,target=/go-mod --mount=type=cache,target=/go-cache GOPATH=/go-mod GOCACHE=/go-cache yarn build

FROM --platform=linux/amd64 sourcebase as www-build
WORKDIR /src
COPY packages/client packages/client
COPY packages/pockethost.io packages/pockethost.io
WORKDIR /src/packages/pockethost.io
RUN yarn build

FROM --platform=linux/amd64 sourcebase as daemon-build
WORKDIR /src
COPY packages/daemon packages/daemon
CMD ls -R packages

FROM --platform=linux/amd64 node as pockethost
WORKDIR /pocketbase
COPY --from=pocketbase-build /src/packages/pocketbase/dist pocketbase
COPY --from=www-build /src/packages/pockethost.io/dist-server www
COPY --from=daemon-build /src daemon
CMD ls -R

