import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "com.edvinlandvik.totalmix-ufx.sdPlugin/bin/", "node_modules/"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
