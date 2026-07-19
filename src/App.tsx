import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ScrollToTop } from './components/ScrollToTop';
import { AppLayout, ProtectedRoute, AdminRoute } from './components/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Reset from './pages/Reset';
import Verify from './pages/Verify';
import ChatWorkspace from './pages/ChatWorkspace';
import Dashboard from './pages/Dashboard';
import Tools from './pages/Tools';
import SearchPage from './pages/SearchPage';
import Favorites from './pages/Favorites';
import Files from './pages/Files';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>}>
            </Route>
            <Route path="/app/chat/:chatId" element={<ProtectedRoute><AppLayout><ChatWorkspace /></AppLayout></ProtectedRoute>} />
            <Route path="/app/tools" element={<ProtectedRoute><AppLayout><Tools /></AppLayout></ProtectedRoute>} />
            <Route path="/app/tools/:toolId" element={<ProtectedRoute><AppLayout><Tools /></AppLayout></ProtectedRoute>} />
            <Route path="/app/search" element={<ProtectedRoute><AppLayout><SearchPage /></AppLayout></ProtectedRoute>} />
            <Route path="/app/favorites" element={<ProtectedRoute><AppLayout><Favorites /></AppLayout></ProtectedRoute>} />
            <Route path="/app/files" element={<ProtectedRoute><AppLayout><Files /></AppLayout></ProtectedRoute>} />
            <Route path="/app/history" element={<ProtectedRoute><AppLayout><History /></AppLayout></ProtectedRoute>} />
            <Route path="/app/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="/app/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ScrollToTop>
      </AuthProvider>
    </BrowserRouter>
  );
}
