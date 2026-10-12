import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

// Released algorithm copies are hash-protected by legacy-source-manifest.json.
// Apply the same correctness rules to every mutable TS module, including tests.
export default [
  { ignores: ["dist/**", "node_modules/**", "src/*_v1_0_1.ts"] },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      // TypeScript's strict compiler checks identifiers and declarations.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "react-hooks/rules-of-hooks": "error",
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" },
      ],
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/label-has-associated-control": "error",
      // Native fields use wrapping labels checked by label-has-associated-control
      // and runtime axe; this rule cannot resolve their parent label text.
      "jsx-a11y/control-has-associated-label": [
        "error",
        { ignoreElements: ["input", "select", "textarea"] },
      ],
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/autocomplete-valid": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/iframe-has-title": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-aria-hidden-on-focusable": "error",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },
];
