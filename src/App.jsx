import { useCallback, useEffect, useState } from 'react'
import { ChatPage } from './components/ChatPage.jsx'
import { WelcomePage } from './components/WelcomePage.jsx'
import { useChat } from './hooks/useChat.js'
import { useCollection } from './hooks/useCollection.js'
import { usePreferences } from './hooks/usePreferences.js'
import { useTracking } from './hooks/useTracking.js'
import './App.css'

export default function App() {
  const { track, nextMsgIndex } = useTracking()
  const { preferences, setCategories } = usePreferences()
  const { addItem } = useCollection()
  const [page, setPage] = useState('welcome')

  const onUsage = useCallback(
    (usage) => {
      track('ai_response', {
        token_count: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
      })
    },
    [track],
  )

  const { messages, isLoading, sendMessage, resetChat } = useChat({
    preferences,
    onUsage,
    onError: (err) => {
      track('error_occurred', {
        error_type: err?.code || 'client_stream',
        retry_count: 0,
      })
    },
  })

  const goWelcome = useCallback(() => {
    resetChat()
    setPage('welcome')
  }, [resetChat])

  const handleStart = useCallback(
    ({ text }) => {
      const idx = nextMsgIndex()
      track('message_sent', { msg_index: idx, char_count: text.length })
      setPage('chat')
      sendMessage(text)
    },
    [nextMsgIndex, sendMessage, track],
  )

  const handleCollect = useCallback(
    async (item) => {
      track('collection_action', { action: 'add', item_name: item.title })
      await addItem(item)
    },
    [addItem, track],
  )

  useEffect(() => {
    const onUnload = () => {
      const payload = JSON.stringify({
        event: 'session_end',
        data: { session_id: sessionStorage.getItem('pathfinder-sid') || '' },
        timestamp: new Date().toISOString(),
      })
      navigator.sendBeacon(
        '/api/track',
        new Blob([payload], { type: 'application/json' }),
      )
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  if (page === 'welcome') {
    return (
      <WelcomePage
        categories={preferences.categories}
        setCategories={setCategories}
        onStart={handleStart}
        track={track}
      />
    )
  }

  return (
    <ChatPage
      messages={messages}
      isLoading={isLoading}
      sendMessage={sendMessage}
      onBack={goWelcome}
      track={track}
      nextMsgIndex={nextMsgIndex}
      onCollect={handleCollect}
    />
  )
}
