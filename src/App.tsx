import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ThemeProvider } from './components/ThemeProvider';
import { ScrollToTop } from './components/ScrollToTop';
import { AppLayout, ProtectedRoute, AdminRoute } from './components/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Reset from './pages/Reset';
import Verify from './pages/Verify';
import Dashboard from './pages/Dashboard';


import SearchPage from './pages/SearchPage';

import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import VoiceChat from './pages/VoiceChat';
import Admin from './pages/Admin';
import SharedChatView from './pages/SharedChatView';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <ScrollToTop>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/share/:shareData" element={<SharedChatView />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>}>
            </Route>
            <Route path="/app/voice-chat" element={<ProtectedRoute><AppLayout><VoiceChat /></AppLayout></ProtectedRoute>} />
            <Route path="/app/voice-chat/:chatId" element={<ProtectedRoute><AppLayout><VoiceChat /></AppLayout></ProtectedRoute>} />


            <Route path="/app/search" element={<ProtectedRoute><AppLayout><SearchPage /></AppLayout></ProtectedRoute>} />

            <Route path="/app/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="/app/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ScrollToTop>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
