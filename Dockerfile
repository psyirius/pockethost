ARG DENO_VERSION=1.28.2
ARG BIN_IMAGE=denoland/deno:bin-${DENO_VERSION}

FROM --platform=linux/amd64 alpine as alpine-glibc
ENV LANG=C.UTF-8
# NOTE: Glibc 2.35 package is broken: https://github.com/sgerrand/alpine-pkg-glibc/issues/176, so we stick to 2.34 for now
RUN ALPINE_GLIBC_BASE_URL="https://github.com/sgerrand/alpine-pkg-glibc/releases/download" && \
    ALPINE_GLIBC_PACKAGE_VERSION="2.34-r0" && \
    ALPINE_GLIBC_BASE_PACKAGE_FILENAME="glibc-$ALPINE_GLIBC_PACKAGE_VERSION.apk" && \
    ALPINE_GLIBC_BIN_PACKAGE_FILENAME="glibc-bin-$ALPINE_GLIBC_PACKAGE_VERSION.apk" && \
    ALPINE_GLIBC_I18N_PACKAGE_FILENAME="glibc-i18n-$ALPINE_GLIBC_PACKAGE_VERSION.apk" && \
    apk add --no-cache --virtual=.build-dependencies wget ca-certificates && \
    echo \
        "-----BEGIN PUBLIC KEY-----\
        MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZ2u1KJKUu/fW4A25y9m\
        y70AGEa/J3Wi5ibNVGNn1gT1r0VfgeWd0pUybS4UmcHdiNzxJPgoWQhV2SSW1JYu\
        tOqKZF5QSN6X937PTUpNBjUvLtTQ1ve1fp39uf/lEXPpFpOPL88LKnDBgbh7wkCp\
        m2KzLVGChf83MS0ShL6G9EQIAUxLm99VpgRjwqTQ/KfzGtpke1wqws4au0Ab4qPY\
        KXvMLSPLUp7cfulWvhmZSegr5AdhNw5KNizPqCJT8ZrGvgHypXyiFvvAH5YRtSsc\
        Zvo9GI2e2MaZyo9/lvb+LbLEJZKEQckqRj4P26gmASrZEPStwc+yqy1ShHLA0j6m\
        1QIDAQAB\
        -----END PUBLIC KEY-----" | sed 's/   */\n/g' > "/etc/apk/keys/sgerrand.rsa.pub" && \
    wget \
        "$ALPINE_GLIBC_BASE_URL/$ALPINE_GLIBC_PACKAGE_VERSION/$ALPINE_GLIBC_BASE_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_BASE_URL/$ALPINE_GLIBC_PACKAGE_VERSION/$ALPINE_GLIBC_BIN_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_BASE_URL/$ALPINE_GLIBC_PACKAGE_VERSION/$ALPINE_GLIBC_I18N_PACKAGE_FILENAME" && \
    mv /etc/nsswitch.conf /etc/nsswitch.conf.bak && \
    apk add --no-cache --force-overwrite \
        "$ALPINE_GLIBC_BASE_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_BIN_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_I18N_PACKAGE_FILENAME" && \
    \
    mv /etc/nsswitch.conf.bak /etc/nsswitch.conf && \
    rm "/etc/apk/keys/sgerrand.rsa.pub" && \
    (/usr/glibc-compat/bin/localedef --force --inputfile POSIX --charmap UTF-8 "$LANG" || true) && \
    echo "export LANG=$LANG" > /etc/profile.d/locale.sh && \
    \
    apk del glibc-i18n && \
    \
    rm "/root/.wget-hsts" && \
    apk del .build-dependencies && \
    rm \
        "$ALPINE_GLIBC_BASE_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_BIN_PACKAGE_FILENAME" \
        "$ALPINE_GLIBC_I18N_PACKAGE_FILENAME"

# Alpine 3.17.0
# Node v18.12.1
FROM --platform=linux/amd64 alpine-glibc as node
RUN apk --no-cache add nodejs npm yarn bash
CMD echo "Alpine" `cat /etc/alpine-release` && echo "Node" `node --version`

# Alpine 3.17.0
# Node v18.12.1
# Deno deno 1.28.2 (release, x86_64-unknown-linux-gnu) v8 10.9.194.1 typescript 4.8.3
FROM --platform=linux/amd64 node as deno
RUN apk --no-cache add curl 
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
CMD echo "Alpine" `cat /etc/alpine-release`  && echo "Node" `node --version` && echo "Deno" `/root/.deno/bin/deno --version`

FROM --platform=linux/amd64 alpine as deno-cargo-alpine
RUN apk --no-cache add cargo
RUN --mount=type=cache,target=/deno-build --mount=type=cache,target=/cargo cargo install deno -v -v --root=/cargo --target-dir=/deno-build --locked && ls -R /cargo && ls -R /deno-build
CMD echo "Alpine" `cat /etc/alpine-release` && echo "Deno" `deno --version`

# Alpine 3.13.10
# Deno deno 1.28.2 (release, x86_64-unknown-linux-gnu) v8 10.9.194.1 typescript 4.8.3
FROM --platform=linux/amd64 denoland/deno:alpine AS deno-alpine
CMD echo "Alpine" `cat /etc/alpine-release` && echo "Deno" `deno --version`

# Alpine 3.16.3
# Node v16.17.1
# Deno deno 1.28.2 (release, x86_64-unknown-linux-gnu) v8 10.9.194.1 typescript 4.8.3
FROM --platform=linux/amd64 frolvlad/alpine-glibc as deno-alpine-glibc
RUN apk --no-cache add nodejs npm yarn bash
COPY --from=deno /bin/deno /usr/local/bin/deno
CMD echo "Alpine" `cat /etc/alpine-release` && echo "Node" `node --version` && echo "Deno" `deno --version`

FROM --platform=linux/amd64 node as buildbox
RUN apk --no-cache add python3 py3-pip make gcc musl-dev g++ go

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
RUN --mount=type=cache,target=/root/.yarn NODE_ENV=production YARN_CACHE_FOLDER=/root/.yarn yarn install
CMD ls -R packages

FROM --platform=linux/amd64 deno as pockethost
WORKDIR /pocketbase
COPY --from=pocketbase-build /src/packages/pocketbase/dist pocketbase
COPY --from=www-build /src/packages/pockethost.io/dist-server www
COPY --from=daemon-build /src daemon
CMD ls -R

