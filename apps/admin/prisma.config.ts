import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Placeholder used only for `prisma generate` when DATABASE_URL is unset (e.g. CI/Vercel build). */
const BUILD_DATABASE_URL =
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? BUILD_DATABASE_URL,
  },
});
