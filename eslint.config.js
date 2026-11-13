import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  sonarjs.configs.recommended,
  {
    plugins: { unicorn },
    rules: {
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-string-raw': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-regexp-test': 'error',
      'sonarjs/reduce-initial-value': 'error',
      'sonarjs/prefer-regexp-exec': 'error',
      'sonarjs/no-empty-collection': 'error',
      'default-param-last': 'error',
      'no-await-in-loop': 'error',
      'vuejs-accessibility/aria-role': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-undef': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
);
