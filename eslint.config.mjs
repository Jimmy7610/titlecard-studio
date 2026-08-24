import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore is how this codebase says "destructured only to
      // leave it behind" — `const { id: _id, ...rest }` is the idiom that keeps
      // a session-only field out of a serialised file.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated export artifacts and test output. They are the *output* of this
    // codebase, and linting them reports on code the linter cannot fix.
    "public/__samples/**",
    ".react-check/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
