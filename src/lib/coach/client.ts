import "server-only";
import { Portkey } from "portkey-ai";

/**
 * Portkey client routed to Claude. The org blocks inline providers, so the
 * model is referenced through a saved integration as `@<integration>/<model>`
 * (e.g. `@david-stahl/claude-sonnet-4-6`). No virtual-key header is needed.
 */
let _client: Portkey | null = null;

export function portkey(): Portkey {
  if (!process.env.PORTKEY_API_KEY) {
    throw new Error(
      "PORTKEY_API_KEY is not set. Add it to .env.local to enable the coach.",
    );
  }
  if (!_client) {
    const opts: ConstructorParameters<typeof Portkey>[0] = {
      apiKey: process.env.PORTKEY_API_KEY,
    };
    // optional: only if explicitly configured (most setups use @slug/model)
    if (process.env.PORTKEY_VIRTUAL_KEY)
      opts.virtualKey = process.env.PORTKEY_VIRTUAL_KEY;
    _client = new Portkey(opts);
  }
  return _client;
}

export function coachConfigured(): boolean {
  return Boolean(process.env.PORTKEY_API_KEY);
}

/** Portkey integration slug used to reference saved providers. */
export function portkeyIntegration(): string {
  return process.env.PORTKEY_INTEGRATION || "david-stahl";
}

/**
 * Resolve the model string Portkey expects. Stored/profile model is the bare
 * id (e.g. `claude-sonnet-4-6`); we prefix it with the integration unless it
 * already carries an `@slug/` prefix. COACH_MODEL env overrides everything.
 */
export function coachModel(profileModel?: string): string {
  const base = process.env.COACH_MODEL || profileModel || "claude-sonnet-4-6";
  if (base.startsWith("@")) return base;
  return `@${portkeyIntegration()}/${base}`;
}
