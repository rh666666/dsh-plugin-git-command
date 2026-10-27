/**
 * 插件配置的默认值与规范化。
 *
 * 配置来自 Loader 行的 `config`；缺失字段一律回退默认值，非法枚举值回退并告警，
 * 让插件在配置写错时仍然可用。
 */

/** 有效的提交范围。 */
export const SCOPES = Object.freeze(['session', 'repository'])

/** 有效的推送偏好。 */
export const PUSH_STRATEGIES = Object.freeze(['rebase', 'merge'])

/** 配置缺省值。 */
export const DEFAULT_CONFIG = Object.freeze({
  messageExample: 'feat(scope): 说明这处改动为什么必要',
  note: '',
  scope: 'session',
  pushStrategy: 'rebase',
})

function text(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function enumValue(value, allowed, fallback, field, warn) {
  if (value === undefined) return fallback
  if (typeof value === 'string' && allowed.includes(value)) return value
  warn?.(`git-command: 配置项 ${field} 的值 ${JSON.stringify(value)} 无效，回退为 ${fallback}`)
  return fallback
}

/**
 * 把原始配置规范化成插件内部使用的完整配置。
 * @param {Record<string, unknown>} [raw] Loader 行传入的 config
 * @param {(message: string) => void} [warn] 非法值告警
 * @returns {{ messageExample: string, note: string, scope: 'session'|'repository', pushStrategy: 'rebase'|'merge' }}
 */
export function normalizeConfig(raw, warn) {
  const source = raw ?? {}
  return {
    messageExample: text(source.messageExample) || DEFAULT_CONFIG.messageExample,
    note: text(source.note),
    scope: enumValue(source.scope, SCOPES, DEFAULT_CONFIG.scope, 'scope', warn),
    pushStrategy: enumValue(source.pushStrategy, PUSH_STRATEGIES, DEFAULT_CONFIG.pushStrategy, 'pushStrategy', warn),
  }
}
