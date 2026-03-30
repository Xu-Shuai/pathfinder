import { CHAT_QUICK_SUGGESTIONS } from '../config/constants.js'
import { ChatHeader } from './ChatHeader.jsx'
import { InputArea } from './InputArea.jsx'
import { MessageList } from './MessageList.jsx'

export function ChatPage({
  messages,
  isLoading,
  sendMessage,
  onBack,
  track,
  nextMsgIndex,
  onCollect,
}) {
  const handleSend = (text) => {
    const idx = nextMsgIndex()
    track('message_sent', { msg_index: idx, char_count: text.length })
    sendMessage(text)
  }

  return (
    <div className="page chat">
      <ChatHeader onBack={onBack} status={isLoading ? '正在回复…' : ''} />
      <MessageList
        messages={messages}
        isLoading={isLoading}
        track={track}
        onCollect={onCollect}
      />
      <InputArea
        suggestions={CHAT_QUICK_SUGGESTIONS}
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  )
}
