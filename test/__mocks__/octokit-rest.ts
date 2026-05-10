// Stub used by Jest. Production code loads the real Octokit; in tests we mock
// GithubService entirely, so this stub never runs — it exists only because
// @octokit/rest is ESM-only since v20 and ts-jest compiles to CommonJS.
export class Octokit {
  constructor(_options?: unknown) {}
}
