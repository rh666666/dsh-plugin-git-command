/**
 * Host 半入口：注册 `/commit`、`/push`、`/commit-push` 三个命令与设置页的配置通道。
 *
 * 插件不执行任何 git 操作，也不往对话里塞提示词：命令只为当前会话登记一段待执行的
 * 指令，由系统提示段落带进下一轮模型请求；该轮结束时指令即被清除。
 * 用户在命令后附带的文字会作为他自己的消息发送，用来立即开始这一轮。
 */

import { randomUUID } from 'node:crypto'
import { normalizeConfig } from './src/config.js'
import { buildPrompt } from './src/prompts.js'
import { registerSettingsApi } from './src/settings-api.js'

/** Loader 条目标识，与包名一致。 */
export const name = 'git-command'

/** 硬依赖：缺命令注册表、提示词投递通道或系统提示注册表时插件不加载。 */
export const inject = ['commands', 'sessionController', 'systemPrompt']

/** 指令段落的排序位置：紧随工具文档区之后。 */
const SECTION_ORDER = 5050

/** 指令段落的名称。 */
const SECTION_NAME = 'git-command:directive'

/** 投递用户消息的等待上限。 */
const DELIVERY_TIMEOUT_MS = 30_000

/** 三个命令的定义。 */
const COMMANDS = Object.freeze([
  {
    name: 'commit',
    kind: 'commit',
    description: '按配置的提交信息格式提交代码改动',
  },
  {
    name: 'push',
    kind: 'push',
    description: '按配置的推送偏好推送当前分支',
  },
  {
    name: 'commit-push',
    kind: 'commit-push',
    description: '提交代码改动并推送当前分支',
  },
])

/** 会话日志与 Agent 使用同一个 id 来源。 */
function sessionIdOf(session) {
  return session?.header?.id ?? session?.id
}

/**
 * 为一次命令调用登记待执行指令，并立即开始这一轮。
 *
 * 指令本身只进系统提示；这次投递只是触发，用用户附言（没有附言时用命令原文），
 * 因此这一轮会立刻消费掉指令，不会留到下一条无关消息。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {() => object} readSettings 当前配置
 * @param {Map<string, string>} directives 各会话的待执行指令
 * @param {{ name: string, kind: string }} command
 * @param {import('@deepseek-ai/dsh-commands').CommandInvocation} invocation
 */
async function execute(ctx, readSettings, directives, command, invocation) {
  const sessionId = sessionIdOf(invocation?.agent?.session)
  if (!sessionId) {
    return { kind: 'error', text: '这条命令需要一个会话身份，当前调用没有。' }
  }
  directives.set(sessionId, buildPrompt(command.kind, readSettings()))

  const note = String(invocation.rawInput ?? '').trim()
  try {
    await ctx.sessionController.prompt({
      requestId: `git-command-${command.name}-${randomUUID()}`,
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: note || `/${command.name}` }],
    }, AbortSignal.timeout(DELIVERY_TIMEOUT_MS))
  } catch (error) {
    const message = String(error?.message ?? error)
    ctx.logger?.warn?.(`git-command: 注入 /${command.name} 指令后没能开始这一轮：${message}`)
    return {
      kind: 'error',
      text: `指令已注入系统提示，但没能开始这一轮：${message}。发送任意消息即可开始。`,
    }
  }
  return { kind: 'success', text: `已注入 /${command.name} 指令并开始这一轮。` }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ messageExample?: string, note?: string, scope?: 'session'|'repository', pushStrategy?: 'rebase'|'merge' }} [config]
 */
export function apply(ctx, config = {}) {
  let settings = normalizeConfig(config, (message) => ctx.logger?.warn?.(message))

  /** 每个会话待执行的指令；某一轮用完后在该轮结束时清除。 */
  const directives = new Map()

  // 设置页的配置通道：webServer 缺失时插件仍提供命令，只是没有界面入口。
  ctx.inject(['webServer'], (web) => {
    web.effect(() => registerSettingsApi(
      web,
      () => settings,
      (next) => {
        settings = next
      },
    ))
  })

  return ctx.effect(() => {
    const disposers = [
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        // 绑定当前请求所属的会话，其它会话的请求拿到空段落。
        text: (context) => directives.get(sessionIdOf(context?.agent?.session)) ?? '',
      }),
      ctx.on('session/event', (session, event) => {
        if (event?.type !== 'turn/end') return
        const sessionId = sessionIdOf(session)
        if (sessionId) directives.delete(sessionId)
      }),
      ctx.on('session/disposed', (session) => {
        const sessionId = sessionIdOf(session)
        if (sessionId) directives.delete(sessionId)
      }),
      ...COMMANDS.map((command) => ctx.commands.register({
        name: command.name,
        description: command.description,
        input: { hint: '[<备注>]' },
        handler: (invocation) => execute(ctx, () => settings, directives, command, invocation),
      })),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  })
}
