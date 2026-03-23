# OpenClaw 模型相关 JSON 结构说明（仪表盘对齐用）

本文描述 **OpenClaw 实际使用的配置形状**，便于理解「模型页」读写逻辑。示例中的域名、密钥均为占位，请勿提交真实机密。

## 严格 JSON（OpenClaw 规则）

**磁盘上的 `openclaw.json` 必须是标准 JSON**，OpenClaw 用 `JSON.parse` 读取：

- **不要**写 `//` 或 `/* */` 注释。  
- **不要**写尾随逗号（trailing comma）。  
- 下文中的示例仅作 Markdown 高亮展示；复制到真文件时请保证整份文件可被标准 `JSON.parse` 解析。

仪表盘「写入配置」经 Gateway 补丁落盘时，使用 **`JSON.stringify`**，**不会**往文件里写入注释。

## 配置文件路径（是否搞错文件？）

- 仪表盘 **读取**「模型列表」时，使用的文件是：  
  **`OPENCLAW_HOME/openclaw.json`**  
  未设置环境变量时，`OPENCLAW_HOME` 默认为当前系统用户的 **`~/.openclaw`**。  
  在 Windows 上通常即：  
  **`C:\Users\<用户名>\.openclaw\openclaw.json`**（与你的路径一致，只要没改 `OPENCLAW_HOME`）。
- **写入**「添加模型」时，不直接 `fs.writeFile`；而是调用本机 **OpenClaw Gateway** 的 **`config.patch`**，由网关把修改落盘到 **它所加载的那份** `openclaw.json`。  
  正常情况下网关与仪表盘使用同一用户目录下的配置；若网关以**其他用户**或**自定义配置根目录**运行，才会出现「列表读 A 文件、写入落到 B」的不一致。此时请统一两边的 `OPENCLAW_HOME` / OpenClaw 启动方式。
- 调用「写入配置」接口后，成功/失败响应里会带 **`configPath`**、**`openclawHome`**（以及 **`configPathPosix`** 正斜杠形式），便于在浏览器开发者工具 Network 里核对是否指向你期望的 `openclaw.json`。

## 1. `openclaw.json` → `models`

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "litellm": {
        "api": "openai-completions",
        "baseUrl": "https://your-litellm.example.com",
        "apiKey": "YOUR_KEY_OR_ENV_REF",
        "headers": { "x-openclaw-timeout-ms": "25000" },
        "models": [
          {
            "id": "model-id-on-upstream",
            "name": "Human readable name",
            "api": "openai-completions",
            "contextWindow": 128000,
            "maxTokens": 8192,
            "reasoning": true,
            "input": ["text", "image"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            }
          }
        ]
      }
    }
  }
}
```

要点：

- **`models.mode`**：常见为 `"merge"`，表示与各 Agent 目录下的 `models.json` 等层做合并（以 OpenClaw 运行时规则为准）。
- **Provider 级**：`api`、`baseUrl`、`apiKey`、`headers` 对整站生效；仪表盘「添加模型」只往对应 provider 的 **`models[]`** 里追加条目，不会删掉你手写字段。
- **每条 model**：除 `id` / `name` 外，你当前配置里每条都带有 **`api`（通常与 provider 相同）** 与 **`cost` 四元组**；仪表盘写入时会 **自动补全** 这两项以与现有文件风格一致。
- **Agent 选用模型**：在 `agents.list[].model` 或 `agents.defaults.model` 里使用 **`providerId/modelId`** 字符串，例如 `litellm/gemini-3-flash`。

### 注册 vs 实际调用（容易混淆）

- 在 **`models.providers.<id>.models[]`** 里增加一条，只是让 OpenClaw **知道**该 provider 上存在这个模型 id（路由、上下文元数据等），**不会**自动让任何 Agent 改用它。
- 要让 **1ONE 总指挥**（或任一 Agent）对话时真的走到 **`litellm/qwen3-max`**，还需要在 **`agents.list`** 里把对应项的 **`model`** 写成该字符串，或依赖 **`agents.defaults.model`** 的 `primary` / `fallbacks` 链里出现该引用。
- **`agents.defaults.models`** 里的键（如 `litellm/qwen3-max`）配 **`alias`** 主要是**展示别名**；是否启用该模型仍取决于上述 **`model` / 默认模型** 是否引用到它。仪表盘在「添加模型」并选择绑定 Agent 时，会向该对象 **合并** 一条 `{ "alias": "…" }`（若该键已存在且已有非空 `alias` 则保留原值）。

## 2. `agents/<agentId>/agent/models.json`

与主配置 **合并** 使用，常见写法与主文件里 `models.providers` 片段类似（可只写 `baseUrl`、占位 `apiKey` 等）。**`agents/.../agent/models.json` 同样须为严格 JSON（无注释）**。探测时仪表盘会按所选 Agent **合并** 该层与 `openclaw.json`，避免只读到 `models.json` 导致 Key 未解析。

## 3. `agents.defaults.models`（别名）

```json
"agents": {
  "defaults": {
    "models": {
      "litellm/some-model": { "alias": "显示用别名" }
    }
  }
}
```

此项为 **别名/展示** 用途；**模型是否存在于网关**仍由 `models.providers.*.models` 决定。若新增模型后要在默认映射里显示别名，需自行编辑 `openclaw.json` 或通过其他工具写入该段（当前「添加模型」API 只改 `models.providers`）。

## 4. 与仪表盘功能的对应关系

| 能力 | 读/写位置 |
|------|-----------|
| 添加模型（测试通过后「写入配置」） | **写** `models.providers.<id>.models[]`；**默认** 将 `provider/modelId` **追加** 到 `agents.defaults.model.fallbacks`（与 `primary` 相同则跳过）。页首 Agent 选 **「无」** 时仅上述两项。选 **具体 Agent** 且请求带 `targetAgentId` 时，另：**更新** `agents.list` 中对应 `id` 条目的 **`model`** 为 `provider/modelId`（字符串），并在 **`agents.defaults.models`** 下合并 `{ "provider/modelId": { "alias": "显示名" } }`（与常见 `openclaw.json` 一致，由 `JSON.stringify` 落盘）。**不会**改 `agents/<id>/agent/models.json`。API：`skipFallbackAppend: true` 跳过 fallbacks 但仍可单独绑定 Agent。 |
| 列表展示 | **读** `openclaw.json`，并合并 auth / agent 引用推断 |
| 单条/批量测试 | **只读** 合并 `openclaw.json` + 选中 Agent 的 `models.json` 再发 HTTP 探测 |

更多探测预设见仓库内 `model-probe-presets.example.json`（与 `modelProbePresets` 内嵌配置同源）。
