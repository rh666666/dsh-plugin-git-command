# dsh-plugin-git-command

[![npm version](https://img.shields.io/npm/v/dsh-plugin-git-command.svg)](https://www.npmjs.com/package/dsh-plugin-git-command)
[![npm downloads](https://img.shields.io/npm/dm/dsh-plugin-git-command.svg)](https://www.npmjs.com/package/dsh-plugin-git-command)

把 `/commit`、`/push`、`/commit-push` 注册进 DSH。

命令不执行 git，只给当前会话登记一段指令，带进下一轮模型请求，由 Agent 动手。

## 安装

```bash
dsh plugin --profile <profile> add dsh-plugin-git-command
```

`<profile>` 换成要装的 profile（例如 `desktop`）；锁版本就写 `dsh-plugin-git-command@0.1.0`。

也可以在 **设置 → 插件 → 添加插件** 里直接填包名；同一个输入框接受 Git 地址、压缩包和本地绝对路径。或者直接把代码仓库给dsh让它自己安装

装完在 **设置 → 插件** 里启用，再重启 DSH 才会加载新模块。

## 命令

| 命令 | 作用 |
| --- | --- |
| `/commit` | 提交，不推送 |
| `/push` | 推送，不创建提交 |
| `/commit-push` | 先提交，再推送 |

三个命令都接受 `[<备注>]`，备注会作为开启这一轮的消息。

## 配置

设置里的「Git 提交命令」页可直接改，保存即生效。

| 配置项 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `messageExample` | 多行文本 | `feat(scope): 说明这处改动为什么必要` | 只学格式，不抄内容 |
| `note` | 多行文本 | 空 | 追加的要求 |
| `scope` | `session` / `repository` | `session` | 只提交本次会话改过的文件 / 提交全部改动（`git add -A`） |
| `pushStrategy` | `rebase` / `merge` | `rebase` | 推送前用 `git pull --rebase` 还是 `--no-rebase` |

不想用面板，也可以直接在 profile 的 `cordis.patch.yml` 追加：

```yaml
- id: git-command
  config:
    messageExample: |-
      feat(scope): 说明这处改动为什么必要
    note: 只提交源码，不要提交构建产物。
```

缺失的字段用默认值补齐，非法枚举回退默认值并告警。

## 行为

- 指令只走系统提示，对话历史里看不到。
- 命令后立即开始一轮，不会留到下一条无关消息。
- 插件不调用 git，Agent 自己用 `git status` 核对改动。
- 拉取或推送失败（含冲突）就停下说明情况，不强制推送。
