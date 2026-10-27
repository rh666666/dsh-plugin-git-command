/**
 * 三个命令注入系统提示的指令文本。
 *
 * 指令只描述提交与推送的约定，具体改动由 Agent 依据会话上下文和 git 状态确定。
 */

/** 每个命令的开头，让模型知道这段指令来自用户刚执行的命令。 */
const COMMAND_HEADERS = Object.freeze({
  commit: '用户执行了 /commit 命令，要求提交代码改动。',
  push: '用户执行了 /push 命令，要求推送当前分支。',
  'commit-push': '用户执行了 /commit-push 命令，要求提交并推送。',
})

/** 提交范围决定的第一条指令。 */
const SCOPE_RULES = Object.freeze({
  session: {
    range: '仅本次会话中你修改过的文件。',
    inspect: '依据本次会话的操作记录列出你修改过的文件，再用 git status 逐项核对；',
    stage: '只暂存这些文件，仓库里不属于本次会话的改动保持原样；',
  },
  repository: {
    range: '仓库内当前的全部改动，包含未跟踪文件。',
    inspect: '用 git status 查看仓库内全部改动；',
    stage: '用 git add -A 暂存全部改动；',
  },
})

function commitBlock(settings) {
  const rules = SCOPE_RULES[settings.scope]
  const lines = [
    `提交范围：${rules.range}`,
    '',
    '提交信息示例（只示范格式，不要照抄示例里的内容）：',
    '```',
    settings.messageExample,
    '```',
  ]
  if (settings.note) lines.push('', '用户备注：', settings.note)
  lines.push(
    '',
    '执行要求：',
    `1. ${rules.inspect}`,
    `2. ${rules.stage}`,
    '3. 按提交信息示例的格式执行 git commit，提交信息使用简体中文；',
    '4. 报告提交哈希与提交信息。',
  )
  return lines
}

function pushBlock(settings) {
  const strategy = settings.pushStrategy === 'merge'
    ? '优先 merge：先执行 git pull --no-rebase，成功后再执行 git push。'
    : '优先 rebase：先执行 git pull --rebase，成功后再执行 git push。'
  return [
    `推送偏好：${strategy}`,
    '',
    '执行要求：',
    '1. 确认当前分支与它的上游分支；',
    '2. 拉取远程更新时按上面的偏好执行；',
    '3. 拉取或推送失败（含冲突）时停下来说明情况，不要强制推送；',
    '4. 报告推送结果。',
  ]
}

/**
 * 按命令种类生成要注入系统提示的指令。
 * @param {'commit'|'push'|'commit-push'} kind
 * @param {{ messageExample: string, note: string, scope: 'session'|'repository', pushStrategy: 'rebase'|'merge' }} settings
 * @returns {string}
 */
export function buildPrompt(kind, settings) {
  if (kind === 'push') return [COMMAND_HEADERS.push, '', ...pushBlock(settings), '', '不要创建新的提交。'].join('\n')
  if (kind === 'commit') return [COMMAND_HEADERS.commit, '', ...commitBlock(settings), '', '不要执行推送。'].join('\n')
  return [COMMAND_HEADERS['commit-push'], '', ...commitBlock(settings), '', ...pushBlock(settings)].join('\n')
}
