import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";

export default tseslint.config({
  files: ["**/*.ts", "**/*.tsx"],
  ignores: ["node_modules", "dist", "build"],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    react: reactPlugin
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    semi: ["error", "always"],
    quotes: ["error", "double"],
    "@typescript-eslint/no-unused-vars": "warn",
    "react/react-in-jsx-scope": "off"
  }
});
