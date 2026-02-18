import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/transfer': 'New Transfer',
}

export function Topbar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? "Mike's Bank"

  return (
    <header className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
