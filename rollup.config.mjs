import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { builtinModules } from "node:module";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.edvinlandvik.totalmix-ufx.sdPlugin/bin/plugin.js",
    format: "esm",
    sourcemap: true,
  },
  external: [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      declarationMap: false,
      sourceMap: true,
    }),
    resolve({ preferBuiltins: true }),
    commonjs(),
  ],
};
