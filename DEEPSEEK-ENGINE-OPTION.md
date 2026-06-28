# ScriptON · DeepSeek as a Fallback Engine — Status & Enablement

**TL;DR: there is almost nothing to build.** DeepSeek is already wired into the Unified Engine Switchboard as a general fallback. Making it actually engage is two operational steps, not a Claude Code task. One optional code tweak (JSON mode) is described at the end.

## What already exists (verified in code)
- **Provider adapter** — `backend/src/ai/providers.ts`: `'deepseek'` is a first-class `LlmProvider`, OpenAI-compatible, base `https://api.deepseek.com`. `callProvider()` already handles it (chat-completions shape, streaming, error classification → `ProviderError`).
- **Catalog entry** — `backend/src/ai/llm-routing.service.ts` (`LLM_PROVIDER_DEFAULTS`): key `DEEPSEEK`, `defaultModel: 'deepseek-v4-flash'`, `priority: 20`, models include `deepseek-v4-flash` (cheap drafting, 1M ctx) and `deepseek-v4-pro` (reasoning). `credentialRef: 'DEEPSEEK_API_KEY'`.
- **Fallback chain** — `seedDefaults()` seeds the `LLM_DEFAULT` policy with `fallbackChain = all engines by priority`, i.e. **Anthropic (10) → DeepSeek (20) → Gemini (30) → OpenRouter (40) → Local (50)**. `resolveChain()` returns that ordered plan; `AiService` walks it and fails over to the next **usable** provider on a classified `ProviderError` (CREDIT / RATE / AUTH / TIMEOUT). So if Claude hits a rate-limit/credit/timeout mid-draft or mid-shot-list, DeepSeek is already next in line.
- **Live balance** — `providerBalance()` already polls `https://api.deepseek.com/user/balance` for the admin telemetry.

This is exactly the multi-provider switchboard philosophy the user chose to preserve — no hard-routing, DeepSeek as a safety net.

## To make it actually engage (operational, no build)
DeepSeek is seeded **present but disabled** (only Anthropic + Local are enabled by default), and a plan is only `usable` when `enabled && hasCredential`. So:

1. **Set the key** — add `DEEPSEEK_API_KEY=...` to the backend env (matches the catalog's `credentialRef`).
2. **Enable the engine** — flip the `DEEPSEEK` engine to `enabled` in the **Engines & Routing** admin UI (or set `enabled: true` on the `llmEngine` row). It then becomes `usable` and joins the live failover chain.

Verify via the routing health view (`LlmRoutingService.health()`): the `DEEPSEEK` row should show `enabled: true, usable: true, hasCredential: true`. Model in use: **`deepseek-v4-flash`** (note: `deepseek-chat` / `deepseek-reasoner` are legacy aliases that retire Jul 24 2026 → both route to V4 Flash).

## Optional — guaranteed JSON for the `VIDEO_PROMPT` shot-list
The `VIDEO_PROMPT` stage's `shape` already instructs "Return ONLY JSON…", which is the **portable** approach (works across all five providers, incl. Anthropic, which has no `response_format`). If you additionally want DeepSeek's hard **JSON Output** guarantee when it's the active engine, it's a small, additive switchboard tweak:

- In `providers.ts`, add to `ProviderCall`: `responseFormat?: { type: 'json_object' | 'text' }`.
- In `callProvider()` OpenAI-compatible branch (deepseek/gemini/openrouter/local), before the request: `if (call.responseFormat) body.response_format = call.responseFormat;`
- Thread a `responseFormat: { type: 'json_object' }` option through `AiService.run` for `kind === 'VIDEO_PROMPT'` only.

DeepSeek's JSON mode requires the word "json" **and** an example in the prompt and a sane `max_tokens` — the existing `shape` block already supplies the word + the example, so it's compatible as-is. Anthropic stays prompt-enforced (no `response_format`), which is why the `shape` instruction remains the primary guarantee.

## Sources
- [DeepSeek — JSON Output mode](https://api-docs.deepseek.com/guides/json_mode)
- [DeepSeek — Models & Pricing (V4 Flash / V4 Pro; chat/reasoner retirement)](https://api-docs.deepseek.com/quick_start/pricing)
