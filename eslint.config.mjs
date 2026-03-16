// ESLint 9 flat config. Next 16 CLI has no "lint" command (next lint was parsed as dev with dir "lint").
// Use this config so "eslint ." works; pre-commit runs eslint instead of next lint.
import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [...nextConfig];
export default config;
