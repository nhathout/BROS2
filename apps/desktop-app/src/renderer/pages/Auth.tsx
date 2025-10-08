// src/renderer/pages/AuthPage.tsx
import React, { useState } from "react";
import { FaGoogle, FaGithub } from "react-icons/fa";
import { useNavigate } from "react-router-dom";  // 👈 import navigate
import "../styles/Auth.css";

type Props = {
  onLoginGitHub: () => void;
  onLoginGoogle: () => void;
};

const AuthPage: React.FC<Props> = ({ onLoginGitHub, onLoginGoogle }) => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  const navigate = useNavigate(); // 👈 hook to navigate

  return (
    <div className="auth-page slide-in-right">
      <header className="app-header">
        <span 
          className="brand" 
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/")}  // 👈 navigate back to landing page
        >
          BROS
        </span>
      </header>

      <div className="auth-backdrop">
        <div className="auth-card glass">
          <h2 className="login-title">Welcome</h2>

          <label>Email</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />

          <button className="login-btn">Log In</button>

          <div className="divider"><span>Or login with</span></div>

          <div className="social-buttons">
            <button type="button" className="social-icon google" onClick={onLoginGoogle}>
              <FaGoogle size={20} />
            </button>
            <button type="button" className="social-icon github" onClick={onLoginGitHub}>
              <FaGithub size={20} />
            </button>
          </div>

          <p className="register-text">
            Don’t Have An Account? <a href="#">Register Now.</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;