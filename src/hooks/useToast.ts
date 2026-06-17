import * as React from 'react'

interface ToastState {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error'
  open: boolean
}

let toastCount = 0

type ToastListener = (toasts: ToastState[]) => void

const listeners: ToastListener[] = []
let memoryState: ToastState[] = []

function dispatch(toasts: ToastState[]) {
  memoryState = toasts
  listeners.forEach((l) => l(toasts))
}

export function toast(props: Omit<ToastState, 'id' | 'open'>) {
  const id = String(++toastCount)
  const newToast: ToastState = { ...props, id, open: true }
  dispatch([...memoryState, newToast])
  setTimeout(() => {
    dispatch(memoryState.map((t) => (t.id === id ? { ...t, open: false } : t)))
    setTimeout(() => {
      dispatch(memoryState.filter((t) => t.id !== id))
    }, 300)
  }, 3000)
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastState[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setToasts)
    return () => {
      const index = listeners.indexOf(setToasts)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return { toasts, toast }
}
