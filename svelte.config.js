import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Serverless (Node) — default Vercel. L'edge runtime è deprecato in
    // adapter-vercel; il node runtime default ha costi zero su piano Hobby,
    // cold-start accettabili (<300ms) e accesso pieno alle Node API.
    adapter: adapter({ runtime: 'nodejs20.x' })
  }
};

export default config;
