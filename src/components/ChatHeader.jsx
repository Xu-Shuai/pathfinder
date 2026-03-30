import { APP_NAME } from '../config/constants.js'

export function ChatHeader({ onBack, status }) {
  return (
    <header className="chat-header">
      <button type="button" className="icon-btn" onClick={onBack} aria-label="返回">
        ←
      </button>
      <div className="chat-header-center">
        <span className="logo-mark" aria-hidden>
          🧭
        </span>
        <h1 className="chat-title">{APP_NAME}</h1>
      </div>
      <span className="chat-status" aria-hidden={!status}>
        {status || ''}
      </span>
    </header>
  )
}
