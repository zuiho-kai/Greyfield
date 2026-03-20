export default async function globalTeardown() {
  if (globalThis.__MOCK_SERVER__) {
    globalThis.__MOCK_SERVER__.kill("SIGTERM");
    globalThis.__MOCK_SERVER__ = undefined;
  }
}
