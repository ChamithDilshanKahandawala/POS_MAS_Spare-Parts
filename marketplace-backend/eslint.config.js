const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules', 'coverage'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    // k6 scripts: ES modules run by k6, not Node.
    files: ['loadtest/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
];
