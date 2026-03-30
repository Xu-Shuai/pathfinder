import { useState } from 'react'
import { APP_NAME, CATEGORIES } from '../config/constants.js'
import { CategorySelector } from './CategorySelector.jsx'
import { QuickTags } from './QuickTags.jsx'
import { InputArea } from './InputArea.jsx'

function categoriesLabel(ids) {
  const map = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))
  return ids.map((id) => map[id] || id).join('、')
}

export function WelcomePage({ categories, setCategories, onStart, track }) {
  const [text, setText] = useState('')

  const startWith = (method, rawText) => {
    const trimmed = (rawText ?? text).trim()
    let message = trimmed
    if (!message && categories.length) {
      message = `我想根据已选类型获得推荐：${categoriesLabel(categories)}。请你先问我一个问题，帮我缩小范围。`
    }
    if (!message) return
    track('first_input_method', { method })
    onStart({ text: message, method })
    setText('')
  }

  return (
    <div className="page welcome">
      <header className="welcome-header">
        <span className="logo-mark" aria-hidden>
          🧭
        </span>
        <h1>{APP_NAME}</h1>
        <p className="welcome-sub">用对话发现下一本书、下一部剧、下一部番</p>
      </header>

      <section className="welcome-card">
        <h2 className="section-title">先选类型（可多选）</h2>
        <CategorySelector value={categories} onChange={setCategories} />
      </section>

      <section className="welcome-card">
        <h2 className="section-title">快捷标签</h2>
        <QuickTags
          onPick={(tag) => {
            setText(tag)
            startWith('quick_tag', tag)
          }}
        />
      </section>

      <section className="welcome-card grow">
        <h2 className="section-title">或直接输入</h2>
        <textarea
          className="welcome-input"
          placeholder="例如：最近想看点治愈系的动漫…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <button
          type="button"
          className="primary-btn"
          onClick={() =>
            startWith(categories.length ? 'category_start' : 'free_input', text)
          }
        >
          开始对话
        </button>
      </section>
    </div>
  )
}
