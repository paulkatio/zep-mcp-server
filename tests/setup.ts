// Runs before any test module is imported (vitest setupFiles).
// Provides the env that src/config.ts requires, so importing it does not exit.
process.env.ZEP_API_TOKEN ||= 'test-token';
process.env.ZEP_TENANT ||= 'testtenant';
process.env.LOG_LEVEL ||= 'error';
// Fast retry timings so transport tests run with real timers (no fake-timer/undici clash).
process.env.ZEP_RATE_LIMIT_COOLDOWN_MS ||= '150';
process.env.ZEP_RETRY_BASE_MS ||= '5';
