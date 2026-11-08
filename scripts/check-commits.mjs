import { execFileSync } from "node:child_process";

// Existing history predates Conventional Commits; validate only commits after adoption.
const adoption = "29298e057b7997605d247504b2bef94beabcaabb";
const to = process.env.COMMIT_TO || "HEAD";
const requestedFrom = process.env.COMMIT_FROM;
const from = requestedFrom && !/^0+$/.test(requestedFrom) ? requestedFrom : adoption;
const base = execFileSync("git", ["merge-base", from, to], { encoding: "utf8" }).trim();
execFileSync("pnpm", ["exec", "commitlint", "--from", base, "--to", to, "--strict"], {
  stdio: "inherit",
});
