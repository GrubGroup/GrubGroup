import { useCallback } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

// Thin wrapper over react-speech-recognition so components depend on our API,
// not the library directly. `supported` lets the UI fall back to text input.
export function useVoiceInput() {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition()

  const start = useCallback(() => {
    void SpeechRecognition.startListening({ continuous: true })
  }, [])

  const stop = useCallback(() => {
    void SpeechRecognition.stopListening()
  }, [])

  return {
    transcript,
    listening,
    resetTranscript,
    supported: browserSupportsSpeechRecognition,
    start,
    stop,
  }
}
