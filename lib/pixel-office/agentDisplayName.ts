/**
 * 专家展示名：去掉末尾与 id 重复的括注，如「选题脚本策划专家(agent-script)」→「选题脚本策划专家」
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function formatAgentDisplayName(name: string | undefined, agentId: string): string {
  const id = agentId.trim()
  let s = (name ?? '').trim()
  if (!s) return id || 'agent'
  // 去掉尾部括注，支持「专家 (agent-script)」或「专家(agent-script)」
  const reParen = new RegExp(`\\s*\\(${escapeRegExp(id)}\\)\\s*$`)
  s = s.replace(reParen, '').trim()
  if (!s) return id || 'agent'
  return s
}
