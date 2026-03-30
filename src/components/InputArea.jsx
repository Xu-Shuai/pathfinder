import { useState } from 'react'
import { QuickSuggestions } from './QuickSuggestions.jsx'

export function InputArea({
  placeholder = '说说你想看什么…',
  suggestions = [],
  onSend,
  disabled,
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    const t = value.trim()
    if (!t || disabled) return
    onSend?.(t)
    setValue('')
  }

  return (
    <div className="input-area">
      <QuickSuggestions
        items={suggestions}
        disabled={disabled}
        onPick={(t) => {
          if (disabled) return
          onSend?.(t)
        }}
      />
      <div className="input-bar">
        <textarea
          className="input-field"
          rows={1}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          className="send-btn"
          disabled={disabled || !value.trim()}
          onClick={submit}
        >
          发送
        </button>
      </div>
    </div>
  )
}
