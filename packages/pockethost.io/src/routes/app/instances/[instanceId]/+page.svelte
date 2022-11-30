<script lang="ts">
  import { PUBLIC_PB_PROTOCOL } from '$env/static/public'
  import { PUBLIC_PB_DOMAIN } from '$src/env'
  import { assertExists } from '@pockethost/tools'
  import Backup from './Backup.svelte'
  import Code from './Code.svelte'
  import Logging from './Logging.svelte'
  import Overview from './Overview.svelte'
  import Restore from './Restore.svelte'
  import Secrets from './Secrets/Secrets.svelte'
  import { instance } from './store'

  assertExists($instance, `Expected instance here`)
  const { subdomain, status, platform, version } = $instance
  const url = `${PUBLIC_PB_PROTOCOL}://${subdomain}.${PUBLIC_PB_DOMAIN}`
  const code = `const url = '${url}'\nconst client = new PocketBase(url)`
</script>

<svelte:head>
  <title>{subdomain} details - PocketHost</title>
</svelte:head>
{#if $instance}
  <Overview instance={$instance} />
  <Code instance={$instance} />
  <Secrets instance={$instance} />
  <Logging instance={$instance} />
  <Backup instance={$instance} />
  <Restore instance={$instance} />
{/if}
