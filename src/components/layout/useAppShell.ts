import { useOutletContext } from 'react-router-dom'

export function useAppShell() {
  return useOutletContext<{ openNav: () => void }>()
}
