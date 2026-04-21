import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every route is `force-dynamic`, so there's no ISR output to cache.
// Skipping the kv-incremental-cache override drops the NEXT_INC_CACHE_KV
// binding requirement from wrangler.toml.
export default defineCloudflareConfig({});
