'use client'

import { useEffect } from 'react'
import { installQuizFetchPatch } from '@/lib/quiz-session-client'

// Instala no root layout o fallback de sessão sem cookie (ver
// src/lib/quiz-session-client.ts). Precisa cobrir quiz, preview e checkout,
// por isso vive no layout raiz e não dentro do quiz.
export function QuizSessionPatch() {
  useEffect(() => { installQuizFetchPatch() }, [])
  return null
}
