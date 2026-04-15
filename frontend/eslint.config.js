import { tanstackRouterPlugin } from '@tanstack/eslint-plugin-router'

export default [
  {
    plugins: {
      '@tanstack/router': tanstackRouterPlugin,
    },
    rules: {
      '@tanstack/router/create-route-property-order': 'warn',
    },
  },
]
