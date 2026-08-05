import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'
import { Fab } from './Fab'
import { AddExpenseModal } from '../modals/AddExpenseModal'

export function AppShell() {
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <Fab onClick={() => setAddExpenseOpen(true)} />
      <AddExpenseModal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} />
    </div>
  )
}
