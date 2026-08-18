import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAdmin, RequireAuth, RequireLicense, RequireOnboarding } from "./auth/AuthContext";
import { AppShell } from "./layout/AppShell";
import { ToastStack } from "./components/ui";
import { useToast } from "./hooks/useToast";
import { ToastContext } from "./hooks/useToastContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PendingPage from "./pages/PendingPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import TrainingPage from "./pages/TrainingPage";
import NutritionPage from "./pages/NutritionPage";
import ProgressPage from "./pages/ProgressPage";
import AchievementsPage from "./pages/AchievementsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import ExportPage from "./pages/ExportPage";
import GuidePage from "./pages/GuidePage";
import TrainingSessionPage from "./pages/TrainingSessionPage";
import InsightsPage from "./pages/InsightsPage";

import "./styles/tokens.css";
import "./styles/app.css";

function AppContent() {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      <ToastStack toasts={toast.toasts} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/pending"
          element={
            <RequireAuth>
              <PendingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <RequireLicense>
                <OnboardingPage />
              </RequireLicense>
            </RequireAuth>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <RequireLicense>
                <RequireOnboarding>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/today" element={<Navigate to="/training" replace />} />
                      <Route path="/training" element={<TrainingPage />} />
                      <Route path="/training/session" element={<TrainingSessionPage />} />
                      <Route path="/nutrition" element={<NutritionPage />} />
                      <Route path="/guide" element={<GuidePage />} />
                      <Route path="/progress" element={<ProgressPage />} />
                      <Route path="/insights" element={<InsightsPage />} />
                      <Route path="/achievements" element={<AchievementsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/export" element={<ExportPage />} />
                      <Route
                        path="/admin"
                        element={
                          <RequireAdmin>
                            <AdminPage />
                          </RequireAdmin>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </AppShell>
                </RequireOnboarding>
              </RequireLicense>
            </RequireAuth>
          }
        />
      </Routes>
    </ToastContext.Provider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
