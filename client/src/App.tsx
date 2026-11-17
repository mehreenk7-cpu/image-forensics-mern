
import { useState } from "react";
import type { FormEvent } from "react";
import api from "./api/client";
import "./App.css";

import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import Evidence from "./pages/Evidence";
import ImageAnalysis from "./pages/ImageAnalysis";
import Logs from "./pages/Logs";
import Correlations from "./pages/Correlations";
import Findings from "./pages/Findings";
import Reports from "./pages/Reports";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Page =
  | "dashboard"
  | "cases"
  | "evidence"
  | "analysis"
  | "logs"
  | "correlations"
  | "findings"
  | "reports";

function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem("forensics_user");
      const token = localStorage.getItem("forensics_token");

      return savedUser && token ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // LOGIN AND REGISTER
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const payload =
        mode === "register"
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };

      const response = await api.post(endpoint, payload);

      const { token, user: loggedInUser } = response.data;

      if (!token || !loggedInUser) {
        throw new Error("The server did not return a user and token.");
      }

      localStorage.setItem("forensics_token", token);
      localStorage.setItem("forensics_user", JSON.stringify(loggedInUser));

      setUser(loggedInUser);
      setActivePage("dashboard");
      setMessage("");
      setPassword("");
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      setMessage(
        err.response?.data?.message ||
          err.message ||
          "Unable to connect. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("forensics_token");
    localStorage.removeItem("forensics_user");

    setUser(null);
    setPassword("");
    setMessage("");
    setMode("login");
    setActivePage("dashboard");
  };

  // SIDEBAR NAVIGATION
  const navigation: { id: Page; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⌂" },
    { id: "cases", label: "Investigation Cases", icon: "▣" },
    { id: "evidence", label: "Evidence Files", icon: "▤" },
    { id: "analysis", label: "Image Analysis", icon: "⌕" },
    { id: "logs", label: "Log Explorer", icon: "≡" },
    { id: "reports", label: "Reports", icon: "▧" },
  ];

  // PAGE RENDERING
  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            onNavigate={(page) => setActivePage(page)}
          />
        );

      case "cases":
        return <Cases />;

      case "evidence":
        return <Evidence />;

      case "analysis":
        return <ImageAnalysis />;

      case "logs":
        return <Logs />;

      case "correlations":
        return <Correlations />;

      case "findings":
        return <Findings />;

      case "reports":
        return <Reports />;

      default:
        return (
          <Dashboard
            onNavigate={(page) => setActivePage(page)}
          />
        );
    }
  };

  // MAIN APPLICATION
  if (user) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <h2 className="logo">🛡 Image Forensics</h2>

          <nav>
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  activePage === item.id ? "nav-link active" : "nav-link"
                }
                onClick={() => setActivePage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <p className="sidebar-footer">
            Digital Forensics Platform
          </p>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <h1>
                {activePage === "dashboard"
                  ? "Investigation Dashboard"
                  : navigation.find((item) => item.id === activePage)?.label}
              </h1>

              <p>Welcome, {user.name}!</p>
            </div>

            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </header>

          <div className="page-content">
            {renderPage()}
          </div>
        </main>
      </div>
    );
  }

  // LOGIN / REGISTER SCREEN
  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">🛡</div>

        <h1>Image Forensics</h1>

        <p className="auth-subtitle">
          Sign in to your investigation workspace
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "register" ? "selected" : ""}
            onClick={() => {
              setMode("register");
              setMessage("");
            }}
          >
            Register
          </button>
        </div>

        {mode === "register" && (
          <label>
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />
        </label>

        {message && (
          <p className="auth-message" role="alert">
            {message}
          </p>
        )}

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "register"
              ? "Create Account"
              : "Login"}
        </button>

        <p className="auth-footer">
          Secure digital investigation workspace
        </p>
      </form>
    </main>
  );
}

export default App;
