import { forEach, omit } from '@s-libs/micro-dash'
import { writeFileSync } from 'fs'
import { stringify } from 'yaml'

const req = (name: string) => `$\{${name}:?${name} required}`
const def = (name: string, _d: string) => `$\{${name}:-${_d}}`

const environment = {
  NODE_ENV: def('NODE_ENV', 'development'),
  DEBUG: def('DEBUG', 'true'),
  PUBLIC_APP_PROTOCOL: 'https',
  PUBLIC_APP_DOMAIN: def(`PUBLIC_APP_DOMAIN`, `pockethost.test`),
  PUBLIC_PB_PROTOCOL: 'https',
  PUBLIC_PB_DOMAIN: def('PUBLIC_PB_DOMAIN', 'pockethost.test'),
  PUBLIC_PB_SUBDOMAIN: 'pockethost-central',
  DAEMON_PB_BIN_DIR: '/pockethost/pocketbase',
  DAEMON_PB_DATA_DIR: '/data',
  DAEMON_PB_USERNAME: req(`DAEMON_PB_USERNAME`),
  DAEMON_PB_PASSWORD: req(`DAEMON_PB_PASSWORD`),
  DAEMON_PB_PORT: 8090,
  DAEMON_IDLE_TTL: 5000,
  DAEMON_PB_BACKUP_SLEEP: 100,
  DAEMON_PB_BACKUP_PAGE_COUNT: 5,
  GOPATH: '/go-mod',
  GOCACHE: '/go-cache',
  YARN_CACHE: '/yarn-cache',
  SHELL: '/bin/bash',
}

const PH_SRC = req('PH_SRC')
const PH_CACHE = req('PH_CACHE')
const PH_DATA = req('PH_DATA')
const PH_PB_BIN = req('PH_PB_BIN')
const PH_NGINX_LOGS = req('PH_NGINX_LOGS')
const PH_NGINX_SSL = req('PH_NGINX_SSL')
const PH_NGINX_TEMPLATES = req('PH_NGINX_TEMPLATES')

const volumes = {
  src: [`${PH_SRC}:/src`],
  data: [`${PH_DATA}:/data`],
  cache: [
    `${PH_CACHE}/yarn:/yarn-cache`,
    `${PH_CACHE}/go-mod:/go-mod`,
    `${PH_CACHE}/go-cache:/go-cache`,
    `${PH_CACHE}/node_modules:/src/node_modules`,
  ],
  pocketbaseBin: [`${PH_PB_BIN}:/pocketbase`],
  nginx: [
    `${PH_NGINX_TEMPLATES}:/etc/nginx/templates`,
    `${PH_NGINX_LOGS}:/mount/nginx/logs`,
    `${PH_NGINX_SSL}:/mount/nginx/ssl`,
    `${PH_NGINX_LOGS}/../conf.d:/etc/nginx/conf.d`,
  ],
}

const base = {
  environment,
  image: 'benallfree/pockethost',
  platform: 'linux/amd64',
  networks: ['app-network'],
}

const www = {
  ...base,
  container_name: 'www',
  volumes: [...volumes.src, ...volumes.cache],
  restart: 'unless-stopped',
  working_dir: '/src/packages/pockethost.io',
  command: 'yarn dev --host=www',
  ports: ['9000:3000'],
  healthcheck: {
    test: ['CMD', 'curl', '-f', 'http://www:3000'],
    interval: `5s`,
    timeout: `2s`,
    retries: 300,
    start_period: `10s`,
  },
}

const daemon = {
  ...base,
  volumes: [
    ...volumes.src,
    ...volumes.cache,
    ...volumes.data,
    ...volumes.pocketbaseBin,
  ],
  container_name: 'daemon',
  working_dir: '/src/packages/daemon',
  command: 'yarn dev',
  restart: 'unless-stopped',
  ports: ['9001:3000'],
  healthcheck: {
    test: ['CMD', 'curl', '-f', 'http://daemon:3000/ping'],
    interval: `5s`,
    timeout: `2s`,
    retries: 300,
    start_period: `10s`,
  },
}

const nginx = {
  image: 'nginx:mainline-alpine',
  container_name: 'nginx',
  environment,
  volumes: [...volumes.nginx],
  restart: 'unless-stopped',
  depends_on: {
    daemon: {
      condition: 'service_healthy',
    },
    www: {
      condition: 'service_healthy',
    },
  },
  ports: ['80:80', '443:443'],
  networks: ['app-network'],
}

const networks = {
  'app-network': {
    driver: 'bridge',
  },
}

const files = {
  dev: {
    version: '3',
    networks,
    services: {
      www,
      daemon,
      nginx,
    },
  },
  prod: {
    version: '3',
    networks,
    services: {
      www: {
        ...omit(www, 'volumes'),
        working_dir: '/pockethost/www',
        command: 'node index.js --host=www',
      },
      daemon: {
        ...daemon,
        volumes: [...volumes.data, ...volumes.pocketbaseBin],
        working_dir: '/pockethost/daemon/packages/daemon',
        command: 'yarn start',
      },
      nginx,
    },
  },
}

forEach(files, (out, pfx) => {
  const yaml = `
#############################
# cd packages/docker
# npx tsx src/compose.ts
#############################
  
${stringify(out)
  .split(/\n/)
  .map((line) => {
    return line.replace(/(\${.*?}.*$)/, `"$1"`)
  })
  .join('\n')}`

  console.log(yaml)

  writeFileSync(`./docker-compose.${pfx}.yaml`, yaml)
})
