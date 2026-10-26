import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProjectSelectPage from './pages/ProjectSelectPage'
import HomePage from './pages/HomePage'
import TasksPage from './pages/TasksPage'
import AdminPage from './pages/AdminPage'
import DocumentsPage from './pages/DocumentsPage'
import OrganisationPage from './pages/OrganisationPage'
import TimesheetPage from './pages/TimesheetPage'

export default function App() {
  return (
    <BrowserRouter>
      {/* Full-screen white app */}
      <div className="h-screen w-screen bg-white overflow-hidden relative">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/select-project" element={<ProjectSelectPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/organisation" element={<OrganisationPage />} />
        <Route path="/timesheet" element={<TimesheetPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </BrowserRouter>
  )
}
