// HumanStudy edition: baseline configuration that sits UNDER every other config source.
// Config loading starts from this object, so global config, project config, OPENCODE_CONFIG,
// OPENCODE_CONFIG_CONTENT and managed config all override it. See HUMANSTUDY.md.
import type { Effect } from "effect"
import type { Interface } from "./config"

type Info = Effect.Success<ReturnType<Interface["get"]>>

export const HUMANSTUDY_PROVIDER_ID = "humanstudy"
export const HUMANSTUDY_DEFAULT_BASE_URL = "https://humanstudy-hub.com/api/desktop/v1"

const models = {
  "anthropic/claude-sonnet-5.5": {
    name: "Claude Sonnet 5.5",
    attachment: true,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    limit: { context: 200000, output: 64000 },
  },
  "anthropic/claude-haiku-5.5": {
    name: "Claude Haiku 5.5",
    attachment: true,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    limit: { context: 200000, output: 64000 },
  },
  "deepseek/deepseek-v4.1-flash": {
    name: "DeepSeek V4.1 Flash",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
    limit: { context: 128000, output: 32000 },
  },
} as const

/** Hosted HumanStudy provider (OpenAI-compatible gateway). Present only when HUMANSTUDY_DESKTOP_KEY is set. */
export function humanstudyProvider(env: Record<string, string | undefined> = process.env): Info["provider"] {
  const key = env.HUMANSTUDY_DESKTOP_KEY
  if (!key) return undefined
  const bypass = env.HUMANSTUDY_SERVER_BYPASS
  return {
    [HUMANSTUDY_PROVIDER_ID]: {
      name: "HumanStudy",
      npm: "@ai-sdk/openai-compatible",
      options: {
        baseURL: env.HUMANSTUDY_HOSTED_BASEURL || HUMANSTUDY_DEFAULT_BASE_URL,
        apiKey: key,
        ...(bypass ? { headers: { "x-vercel-protection-bypass": bypass } } : {}),
      },
      models: JSON.parse(JSON.stringify(models)),
    },
  }
}

export function humanstudyDefaults(env: Record<string, string | undefined> = process.env): Info {
  const provider = humanstudyProvider(env)
  return {
    autoupdate: false,
    share: "disabled",
    experimental: { openTelemetry: false },
    // Ask before editing files, running shell commands, or touching paths outside the project.
    // The desktop app records complete transcripts: tool parts carry full input/output up to 64 KB
    // (upstream: 50 KB). Larger output is still saved in full to the truncation dir (metadata.outputPath).
    tool_output: { max_bytes: 65536 },
    permission: { edit: "ask", bash: "ask", external_directory: "ask" },
    ...(provider
      ? {
          provider,
          model: `${HUMANSTUDY_PROVIDER_ID}/anthropic/claude-sonnet-5.5`,
          small_model: `${HUMANSTUDY_PROVIDER_ID}/anthropic/claude-haiku-5.5`,
        }
      : {}),
  } as Info
}
