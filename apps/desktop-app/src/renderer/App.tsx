import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

function AnimatedRoutes({ handleLoginGitHub, handleLoginGoogle }: any) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleGitHubAndRedirect = React.useCallback(() => {
    (async () => {
      const result = await handleLoginGitHub();
      if (result?.success) {
        navigate("/dashboard");
      }
    })().catch((err) => {
      console.error("GitHub redirect error:", err);
    });
  }, [handleLoginGitHub, navigate]);

  const handleGoogleAndRedirect = React.useCallback(() => {
    (async () => {
      const result = await handleLoginGoogle();
      if (result?.success) {
        navigate("/dashboard");
      }
    })().catch((err) => {
      console.error("Google redirect error:", err);
    });
  }, [handleLoginGoogle, navigate]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <AnimatePresence mode="sync">
        <Routes location={location} key={location.pathname}>
          {/* Landing Page */}
          <Route
            path="/"
            element={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  background: "#0c0c0c", // ✅ keep background consistent
                }}
              >
                <LandingPage />
              </motion.div>
            }
          />
          {/* Auth Page */}
          <Route
            path="/auth"
            element={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  background: "#0c0c0c", // ✅ prevents white flash
                }}
              >
                <AuthPage
                  onLoginGitHub={handleGitHubAndRedirect}
                  onLoginGoogle={handleGoogleAndRedirect}
                />
              </motion.div>
            }
          />
          <Route
            path="/dashboard"
            element={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  background: "#f5f7fb",
                }}
              >
                <Dashboard />
              </motion.div>
            }
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

function App() {
  const handleLoginGitHub = async () => {
    try {
      const result = await window.electron.login();
      console.log("GitHub result:", result);

      if (result.success) {
        alert("✅ GitHub login successful!");
      } else {
        alert("❌ GitHub login failed: " + result.error);
      }
      return result;
    } catch (err) {
      console.error("GitHub login error:", err);
      alert("Unexpected GitHub login error");
      return { success: false, error: "Unexpected GitHub login error" };
    }
  };

  const handleLoginGoogle = async () => {
    try {
      if (!window.electron.loginGoogle) {
        alert("Google login is not available yet.");
        return { success: false, error: "Google login unavailable" };
      }

      const result = await window.electron.loginGoogle();
      console.log("Google result:", result);

      if (result.success) {
        alert("✅ Google login successful!");
      } else {
        alert("❌ Google login failed: " + result.error);
      }
      return result;
    } catch (err) {
      console.error("Google login error:", err);
      alert("Unexpected Google login error");
      return { success: false, error: "Unexpected Google login error" };
    }
  };

  return (
    <BrowserRouter>
      <AnimatedRoutes
        handleLoginGitHub={handleLoginGitHub}
        handleLoginGoogle={handleLoginGoogle}
      />
    </BrowserRouter>
  );
}

export default App;
