/**
 * 根据模型 ID 字符串猜测 OpenClaw / LiteLLM 列表里常用的 contextWindow、maxTokens。
 * 官方数值会随厂商更新，此处为「合理默认」便于填表；以各模型文档为准。
 */
export type ModelCapacityHint = {
  contextWindow: number
  maxTokens: number
  /** 简短说明，可展示在 UI */
  label: string
  /** 无法从 ID 匹配已知系列时仅为保守猜测，不应当作准确规格 */
  isGeneric?: boolean
}

function norm(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, "-")
}

/**
 * 根据已输入的模型 ID 返回推荐上下文与最大输出。
 * **未输入 ID 时返回 null**（避免展示误导性的全局默认）。
 * 无法识别系列时返回保守参考值并带 `isGeneric: true`。
 */
export function suggestModelCapacity(modelId: string): ModelCapacityHint | null {
  const id = norm(modelId)
  if (!id) {
    return null
  }

  // Google Gemini（与你当前 openclaw.json 中 gemini-* 一致）
  if (id.includes("gemini") && (id.includes("flash") || id.includes("2.0-flash"))) {
    return { contextWindow: 1_048_576, maxTokens: 8192, label: "Gemini Flash 系列（约 1M）" }
  }
  if (id.includes("gemini") && (id.includes("pro") || id.includes("2.5") || id.includes("1.5"))) {
    return { contextWindow: 2_097_152, maxTokens: 8192, label: "Gemini Pro 系列（约 2M）" }
  }
  if (id.includes("gemini")) {
    return { contextWindow: 1_048_576, maxTokens: 8192, label: "Gemini（默认按 Flash 量级）" }
  }

  // OpenAI o / GPT-5 系（你配置中 gpt-5.2 为 128k）
  if (/^o[134](-|$)/.test(id) || id.startsWith("o1") || id.startsWith("o3")) {
    return { contextWindow: 200_000, maxTokens: 8192, label: "OpenAI o 系列（约 200k）" }
  }
  if (id.includes("gpt-5") || id.includes("gpt5")) {
    return { contextWindow: 128_000, maxTokens: 8192, label: "GPT-5 系（与 gpt-5.2 同档 128k）" }
  }
  if (id.includes("gpt-4o") || id.includes("gpt-4-turbo") || id.includes("gpt-4.1")) {
    return { contextWindow: 128_000, maxTokens: 16384, label: "GPT-4o / 4-turbo（128k）" }
  }
  if (id.includes("gpt-4")) {
    return { contextWindow: 128_000, maxTokens: 8192, label: "GPT-4（128k）" }
  }
  if (id.includes("gpt-3.5")) {
    return { contextWindow: 16_385, maxTokens: 4096, label: "GPT-3.5" }
  }

  // Anthropic
  if (id.includes("claude")) {
    if (id.includes("opus") || id.includes("sonnet-4") || id.includes("4-")) {
      return { contextWindow: 200_000, maxTokens: 8192, label: "Claude 4 / Opus 档（200k）" }
    }
    return { contextWindow: 200_000, maxTokens: 8192, label: "Claude（默认 200k）" }
  }

  // DeepSeek / 国产常见
  if (id.includes("deepseek")) {
    return { contextWindow: 128_000, maxTokens: 8192, label: "DeepSeek（常见 128k）" }
  }

  // 通义千问（内网 joymaas / 兼容 messages 的网关常见）
  if (id.includes("qwen")) {
    return { contextWindow: 128_000, maxTokens: 8192, label: "Qwen 系（常见 128k，以官方为准）" }
  }

  return {
    contextWindow: 128_000,
    maxTokens: 8192,
    label: "未识别系列 · 保守参考",
    isGeneric: true,
  }
}
