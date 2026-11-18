// @ts-check
const eslint = require('@eslint/js');
const stylistic = require('@stylistic/eslint-plugin');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Prettier wraps code; this reports the lines it leaves long, mostly comments.
const width = (options) => ({
  plugins: { '@stylistic': stylistic },
  rules: {
    '@stylistic/max-len': [
      'error',
      { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreRegExpLiterals: true, ...options },
    ],
  },
});

module.exports = defineConfig([
  // Generated from the content folder, and spartan/ui's components as they are copied in.
  { ignores: ['src/content/generated/', 'src/ui/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      // Inline templates are template literals: their class lists are the lines Prettier keeps long.
      width({ ignorePattern: String.raw`^\s*class="` }),
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  { files: ['scripts/*.mjs'], ...width({ ignoreTemplateLiterals: true }) },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
