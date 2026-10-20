module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'security/detect-eval-with-expression': 'error',
    'no-restricted-properties': [
      'error',
      {
        property: '$queryRawUnsafe',
        message: 'Unsafe raw SQL is strictly banned. Use Prisma.sql tagged templates only (AG-MASTER-1.0 §13.6).',
      },
      {
        property: '$executeRawUnsafe',
        message: 'Unsafe raw SQL is strictly banned. Use Prisma.sql tagged templates only (AG-MASTER-1.0 §13.6).',
      },
      {
        property: 'dangerouslySetInnerHTML',
        message: 'dangerouslySetInnerHTML is banned to prevent XSS (AG-MASTER-1.0 §13.5).',
      },
      {
        property: 'innerHTML',
        message: 'Direct innerHTML manipulation is banned (AG-MASTER-1.0 §13.5).',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/tests/fixtures/**', '**/tools/simulator/**'],
            message: 'Application code must NEVER import synthetic data or simulator code (R-M2).',
          },
        ],
      },
    ],
  },
  ignorePatterns: ['node_modules', 'dist', 'build', '.expo', 'coverage'],
};
