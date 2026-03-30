import { useCallback } from 'react'
import { compressHistory } from '../utils/historyCompressor.js'
import { estimateTokens } from '../utils/tokenEstimator.js'

export function useTokenManager() {
  const compress = useCallback((messages, maxTokens) => compressHistory(messages, maxTokens), [])
  const estimate = useCallback((messages) => estimateTokens(messages), [])
  return { compressHistory: compress, estimateTokens: estimate }
}
