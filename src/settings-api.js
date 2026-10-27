/**
 * 设置页的配置读写通道。
 *
 * 浏览器半没有 `host.call`，设置页与宿主之间只有同源 `fetch`：GET 读当前配置，
 * POST 校验后写回 Loader 行，由 `configEditor` 持久化到 profile patch 并立即生效。
 */

import { PUSH_STRATEGIES, SCOPES } from './config.js'

/** 设置页使用的路由。 */
const CONFIG_PATH = '/dsh-git-command/config'

/** Loader 行的 id，与 cordis.patch.yml 中插入的行一致。 */
const ENTRY_ID = 'git-command'

/** 请求体上限：设置页只发四个字段。 */
const MAX_BODY_BYTES = 16 * 1024

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0
    let overflow = false
    const chunks = []
    req.on('data', (chunk) => {
      if (overflow) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        overflow = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (overflow) {
        resolve({ ok: false, reason: '请求体过大' })
        return
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolve({ ok: false, reason: '请求体为空' })
        return
      }
      try {
        resolve({ ok: true, value: JSON.parse(raw) })
      } catch {
        resolve({ ok: false, reason: '请求体不是合法 JSON' })
      }
    })
    req.on('error', () => resolve({ ok: false, reason: '读取请求体失败' }))
  })
}

/** 逐项校验设置页提交的值，非法输入不落盘。 */
function parseConfigInput(value) {
  if (!value || typeof value !== 'object') return { ok: false, reason: '请求体必须是配置对象' }
  const messageExample = String(value.messageExample ?? '').trim()
  if (!messageExample) return { ok: false, reason: '提交信息示例不能为空' }
  const note = String(value.note ?? '').trim()
  if (!SCOPES.includes(value.scope)) return { ok: false, reason: '提交范围只能是 session 或 repository' }
  if (!PUSH_STRATEGIES.includes(value.pushStrategy)) return { ok: false, reason: '推送偏好只能是 rebase 或 merge' }
  return {
    ok: true,
    value: { messageExample, note, scope: value.scope, pushStrategy: value.pushStrategy },
  }
}

async function persist(ctx, next) {
  const editor = ctx.get('configEditor')
  if (!editor) {
    return { ok: false, reason: '当前 profile 没有配置编辑器，请直接在 cordis.patch.yml 中修改配置' }
  }
  const entry = editor.entries().find((item) => item.options.id === ENTRY_ID)
  if (!entry) return { ok: false, reason: '找不到 git-command 配置行' }
  try {
    await editor.edit(entry, (current) => ({ ...current, ...next }))
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) }
  }
  return { ok: true }
}

async function handle(ctx, req, res, read, commit) {
  try {
    const method = String(req.method ?? 'GET').toUpperCase()
    if (method === 'GET' || method === 'HEAD') {
      sendJson(res, 200, { ok: true, value: read() })
      return
    }
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, reason: '这个路由只接受 GET 与 POST' })
      return
    }
    const body = await readBody(req)
    if (!body.ok) {
      sendJson(res, 400, { ok: false, reason: body.reason })
      return
    }
    const parsed = parseConfigInput(body.value)
    if (!parsed.ok) {
      sendJson(res, 400, parsed)
      return
    }
    const saved = await persist(ctx, parsed.value)
    if (!saved.ok) {
      sendJson(res, 500, saved)
      return
    }
    commit(parsed.value)
    sendJson(res, 200, { ok: true, value: parsed.value })
  } catch (error) {
    sendJson(res, 500, { ok: false, reason: String(error?.message ?? error) })
  }
}

/**
 * 注册设置页的配置路由。
 * @param {import('@deepseek-ai/cordis').Context} ctx 注入了 `webServer` 的上下文
 * @param {() => object} read 当前生效的配置
 * @param {(next: object) => void} commit 写入生效的配置
 * @returns {() => void} disposer
 */
export function registerSettingsApi(ctx, read, commit) {
  return ctx.webServer.register({
    kind: 'exact',
    path: CONFIG_PATH,
    handler: (req, res) => {
      void handle(ctx, req, res, read, commit)
    },
  })
}
