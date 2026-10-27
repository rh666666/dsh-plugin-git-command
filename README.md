# dsh-plugin-git-command

把 `/commit`、`/push`、`/commit-push` 三个命令注册到 DSH。命令本身不执行任何 git 操作，也不往对话里塞提示词：只为当前会话登记一段待执行的指令，由系统提示带进下一轮模型请求，由 Agent 完成实际操作。

## 命令

| 命令 | 指令内容 |
| --- | --- |
| `/commit [<备注>]` | 按配置的提交范围与提交信息格式提交，不推送 |
| `/push [<备注>]` | 按配置的推送偏好推送当前分支，不创建提交 |
| `/commit-push [<备注>]` | 先提交，再推送 |

## 设置面板

装好后打开 DSH 设置，左侧出现「Git 提交命令」页，可直接编辑四项配置。保存写入当前 profile 的 `cordis.patch.yml`（由 `configEditor` 持久化），立即生效。

| 配置项 | 取值 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `messageExample` | 多行文本 | `feat(scope): 说明这处改动为什么必要` | 提交信息示例，Agent 只参照它的格式，不照抄内容 |
| `note` | 多行文本 | 空 | 追加进指令的用户备注 |
| `scope` | `session` / `repository` | `session` | `session`：只提交本次会话修改过的文件，仓库内其他改动保持原样；`repository`：提交仓库内全部改动（`git add -A`） |
| `pushStrategy` | `rebase` / `merge` | `rebase` | 推送前拉取远程更新的方式：`git pull --rebase` 或 `git pull --no-rebase` |

也可以不使用设置面板，直接在 profile 的 `cordis.patch.yml` 末尾追加覆盖行：

```yaml
- id: git-command
  config:
    messageExample: |-
      feat(scope): 说明这处改动为什么必要
      （此处可写多行正文示例）
    note: 只提交源码，不要提交构建产物。
    scope: session
    pushStrategy: rebase
```

覆盖行会替换该行的完整 `config`，未写的字段由插件默认值补齐。非法的枚举值会回退为默认值并在日志中告警。

## 安装

在 DSH 里用插件管理安装本目录的 bundle：

```
plugin_manager action=install_bundle target=<本目录绝对路径>
```

更新已安装的 Host 或 Client 模块后，需要重启 DSH 才会加载新的 JavaScript 模块。

## 行为说明

- 指令走系统提示：命令只为当前会话登记待执行指令，由 `git-command:directive` 段落带进下一轮模型请求，该轮结束时清除；对话历史里不会出现这段指令。
- 命令执行后立即开始一轮：投递的触发消息是你附带的备注，不带备注时用命令原文（如 `/commit`）；指令本身只存在于系统提示中，这一轮结束即清除，不会留到后续消息。
- 插件不调用 git，也不读取仓库状态；指令要求 Agent 自己用 `git status` 核对改动。
- `/commit` 的 `session` 范围由 Agent 依据本次会话的操作记录列出改动文件。
- 拉取或推送失败（含冲突）时，指令要求 Agent 停下来说明情况，不强制推送。
# dsh-plugin-git-command
