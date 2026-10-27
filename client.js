/**
 * 浏览器半：在设置面板里提供「Git 提交命令」分区。
 *
 * 与宿主的通信只有同源 fetch（浏览器半没有 host.call）：GET 读取当前配置，
 * POST 保存后由宿主写入 profile 的 Loader 配置并立即生效。
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-git-command',
  factory: (require) => {
    const React = require('react')
    const { createElement: h, useEffect, useState } = React

    /** 与宿主半约定的路由，改它必须同时改 src/settings-api.js。 */
    const CONFIG_URL = '/dsh-git-command/config'

    /** 设置分区座位：一个分区就是设置面板里的一页。 */
    const SLOT_KEY = 'settings.section'

    /** 本页在设置导航里的位置。 */
    const SLOT_ORDER = 30

    const inject = ['slots']

    /**
     * 样式全部走宿主主题令牌，令牌改名时最坏是外观退化而不是不可读。
     * 作用域限定在 `.dgc-page` 下，不碰其它插件或宿主元素。
     */
    const CSS = [
      '.dgc-page{display:flex;flex-direction:column;gap:16px;max-width:720px;',
      'color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.6}',
      '.dgc-head{display:flex;flex-direction:column;gap:4px}',
      '.dgc-title{margin:0;font-size:16px;font-weight:600}',
      '.dgc-intro{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.dgc-card{display:flex;flex-direction:column;gap:8px;padding:14px 16px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:12px;',
      'background:var(--dsw-alias-bg-layer-1)}',
      '.dgc-label{font-size:14px;font-weight:500}',
      '.dgc-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px}',
      '.dgc-input,.dgc-select{box-sizing:border-box;width:100%;padding:8px 10px;',
      'border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
      'background:var(--dsw-alias-bg-base);color:inherit;font:inherit;resize:vertical}',
      '.dgc-input:focus,.dgc-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.dgc-actions{display:flex;align-items:center;gap:12px}',
      '.dgc-save{padding:6px 14px;border:0;border-radius:8px;cursor:pointer;font:inherit;',
      // 前景取主题底色：浅色主题下是白字，深色主题下是深字，始终与品牌色按钮形成反差。
      'background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}',
      '.dgc-save:disabled{opacity:.6;cursor:default}',
      '.dgc-status{font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
      '.dgc-status.is-success{color:var(--dsw-alias-state-success-primary)}',
      '.dgc-status.is-error{color:var(--dsw-alias-state-error-primary)}',
      '.dgc-muted{color:var(--dsw-alias-label-secondary)}',
    ].join('')

    /**
     * 读写宿主配置。
     * @param {RequestInit} [init] 缺省为 GET
     * @returns {Promise<{ok: true, value: object} | {ok: false, reason: string}>}
     */
    async function request(init) {
      try {
        const response = await fetch(CONFIG_URL, { cache: 'no-store', ...init })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload.ok !== true) {
          return { ok: false, reason: String(payload.reason ?? `HTTP ${response.status}`) }
        }
        return { ok: true, value: payload.value }
      } catch (error) {
        return { ok: false, reason: String(error?.message ?? error) }
      }
    }

    /** 一张设置卡片：标题、说明、控件。 */
    function card(key, label, description, control) {
      return h('div', { key, className: 'dgc-card' }, [
        h('div', { key: 'label', className: 'dgc-label' }, label),
        h('p', { key: 'desc', className: 'dgc-desc' }, description),
        control,
      ])
    }

    function SettingsSection() {
      const [form, setForm] = useState(null)
      const [loadError, setLoadError] = useState('')
      const [saving, setSaving] = useState(false)
      const [status, setStatus] = useState(null)

      useEffect(() => {
        let alive = true
        request().then((result) => {
          if (!alive) return
          if (result.ok) setForm(result.value)
          else setLoadError(result.reason)
        })
        return () => {
          alive = false
        }
      }, [])

      /** 改一个字段并清掉上一次的保存结果。 */
      const update = (key, value) => {
        setForm((current) => (current ? { ...current, [key]: value } : current))
        setStatus(null)
      }

      async function save() {
        if (!form || saving) return
        setSaving(true)
        setStatus(null)
        const result = await request({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        })
        setSaving(false)
        if (result.ok) {
          setForm(result.value)
          setStatus({ tone: 'success', text: '已保存。' })
        } else {
          setStatus({ tone: 'error', text: result.reason })
        }
      }

      const style = h('style', { key: 'css' }, CSS)

      if (loadError) {
        return h('div', { className: 'dgc-page' }, [
          style,
          h('p', { key: 'error', className: 'dgc-status is-error' }, loadError),
        ])
      }

      if (!form) {
        return h('div', { className: 'dgc-page' }, [
          style,
          h('p', { key: 'loading', className: 'dgc-muted' }, '正在读取配置…'),
        ])
      }

      return h('div', { className: 'dgc-page' }, [
        style,
        h('header', { key: 'head', className: 'dgc-head' }, [
          h('h3', { key: 'title', className: 'dgc-title' }, 'Git 提交命令'),
          h('p', { key: 'intro', className: 'dgc-intro' },
            '/commit、/push、/commit-push 只把指令注入系统提示，不执行任何 git 操作。'),
        ]),
        card(
          'example',
          '提交信息示例',
          'Agent 只参照这个示例的格式，不照抄里面的内容。',
          h('textarea', {
            key: 'control',
            className: 'dgc-input',
            rows: 5,
            value: form.messageExample,
            onChange: (event) => update('messageExample', event.target.value),
          }),
        ),
        card(
          'note',
          '用户备注',
          '追加进注入内容的额外要求，留空则不加。',
          h('textarea', {
            key: 'control',
            className: 'dgc-input',
            rows: 3,
            value: form.note,
            onChange: (event) => update('note', event.target.value),
          }),
        ),
        card(
          'scope',
          '提交范围',
          'session 只提交本次会话修改过的文件；repository 提交仓库内全部改动。',
          h('select', {
            key: 'control',
            className: 'dgc-select',
            value: form.scope,
            onChange: (event) => update('scope', event.target.value),
          }, [
            h('option', { key: 'session', value: 'session' }, '本次会话修改'),
            h('option', { key: 'repository', value: 'repository' }, '仓库内修改'),
          ]),
        ),
        card(
          'pushStrategy',
          '推送偏好',
          '推送前拉取远程更新时优先使用的方式。',
          h('select', {
            key: 'control',
            className: 'dgc-select',
            value: form.pushStrategy,
            onChange: (event) => update('pushStrategy', event.target.value),
          }, [
            h('option', { key: 'rebase', value: 'rebase' }, '优先 rebase'),
            h('option', { key: 'merge', value: 'merge' }, '优先 merge'),
          ]),
        ),
        h('div', { key: 'actions', className: 'dgc-actions' }, [
          h('button', { key: 'save', type: 'button', className: 'dgc-save', disabled: saving, onClick: save },
            saving ? '保存中…' : '保存'),
          status
            ? h('span', { key: 'status', className: `dgc-status is-${status.tone}` }, status.text)
            : null,
        ]),
      ])
    }

    function apply(ctx) {
      // 座位可能稍后才声明：用 inject 让注册随座位塌陷释放、回来时重装。
      ctx.slots.inject(SLOT_KEY, () => ctx.slots.register({
        name: SLOT_KEY,
        id: 'git-command',
        order: SLOT_ORDER,
        label: () => 'Git 提交命令',
      }, SettingsSection))
    }

    return { inject, apply }
  },
})
