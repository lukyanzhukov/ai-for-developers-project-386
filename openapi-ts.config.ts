import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "generated/openapi/openapi.json",
  output: { path: "generated/api", importFileExtension: ".ts" },
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    { name: "@hey-api/client-fetch", baseUrl: false },
    "fastify",
    { name: "@hey-api/schemas", type: "json" },
  ],
});
