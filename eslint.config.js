import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
    rules: {
      'no-undef': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // a rest pattern is how a field is left out of a copy
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
);
