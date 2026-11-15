import React, { useState, useEffect } from "react";
import { getCurrentUser, getToken, setToken, setCurrentUser, getMe } from "./api";
import {
  Calendar,
  CreditCard,
  Trophy,
  Swords,
  Package,
  GraduationCap,
  BarChart3,
  LogOut,
  KeyRound,
  UserCheck,
  CircleDot
} from "lucide-react";

import TablesView from "./components/TablesView";
import LedgerView from "./components/LedgerView";
import TournamentsView from "./components/TournamentsView";
import LeaderboardView from "./components/LeaderboardView";
import InventoryView from "./components/InventoryView";
import CoachingView from "./components/CoachingView";
import AnalyticsView from "./components/AnalyticsView";
import LoginModal from "./components/LoginModal";
import PasswordModal from "./components/PasswordModal";
import MatchScorer from "./components/MatchScorer";

export default function App() {
  const [currentUser, setUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState("tables");
  const [loginModalOpen, setLoginModalOpen] = useState(!currentUser);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [scoringMatch, setScoringMatch] = useState(null);

  useEffect(() => {
    // If token exists on mount, verify and refresh profile
    if (getToken()) {
      getMe()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            setCurrentUser(res.user);
          }
        })
        .catch(() => {
          // If token expired, open login
          setUser(null);
          setToken(null);
          setCurrentUser(null);
          setLoginModalOpen(true);
        });
    }
  }, []);

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setUser(null);
    setLoginModalOpen(true);
  }

  function handleLoginSuccess(user) {
    setUser(user);
    setLoginModalOpen(false);
    setActiveTab("tables");
  }

  const role = currentUser?.app_role || currentUser?.role || "Casual";
  const isAdminOrStaff = role === "Admin" || role === "Staff";

  const isTabAllowed = (tab) => {
    if (tab === "tables" || tab === "tournaments" || tab === "leaderboard") return true;
    if (tab === "ledger" || tab === "coaching") return role !== "Casual";
    if (tab === "inventory" || tab === "analytics") return isAdminOrStaff;
    return false;
  };

  const currentTab = isTabAllowed(activeTab) ? activeTab : "tables";

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <CircleDot size={22} />
          </div>
          <div>
            <div className="brand-title">CueClub</div>
            <div className="brand-subtitle">DBMS Group 18</div>
          </div>
        </div>

        <ul className="nav-list">
          <li>
            <button
              className={`nav-item-btn ${currentTab === "tables" ? "active" : ""}`}
              onClick={() => setActiveTab("tables")}
            >
              <Calendar size={18} />
              <span>Tables & Bookings</span>
            </button>
          </li>

          {role !== "Casual" && (
            <li>
              <button
                className={`nav-item-btn ${currentTab === "ledger" ? "active" : ""}`}
                onClick={() => setActiveTab("ledger")}
              >
                <CreditCard size={18} />
                <span>Credit Ledger & Udhar</span>
              </button>
            </li>
          )}

          <li>
            <button
              className={`nav-item-btn ${currentTab === "tournaments" ? "active" : ""}`}
              onClick={() => setActiveTab("tournaments")}
            >
              <Trophy size={18} />
              <span>Tournaments & Brackets</span>
            </button>
          </li>

          <li>
            <button
              className={`nav-item-btn ${currentTab === "leaderboard" ? "active" : ""}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <Swords size={18} />
              <span>Leaderboard</span>
            </button>
          </li>

          {isAdminOrStaff && (
            <li>
              <button
                className={`nav-item-btn ${currentTab === "inventory" ? "active" : ""}`}
                onClick={() => setActiveTab("inventory")}
              >
                <Package size={18} />
                <span>Equipment & Inventory</span>
              </button>
            </li>
          )}

          {role !== "Casual" && (
            <li>
              <button
                className={`nav-item-btn ${currentTab === "coaching" ? "active" : ""}`}
                onClick={() => setActiveTab("coaching")}
              >
                <GraduationCap size={18} />
                <span>Coaching Academy</span>
              </button>
            </li>
          )}

          {isAdminOrStaff && (
            <li>
              <button
                className={`nav-item-btn ${currentTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                <BarChart3 size={18} />
                <span>Analytics & Audit</span>
              </button>
            </li>
          )}
        </ul>

        {/* User Badge & Self-Service */}
        <div className="sidebar-user">
          {currentUser ? (
            <div>
              <div className="user-badge" style={{ marginBottom: 12 }}>
                <div className="user-info">
                  <div className="user-name">{currentUser.name}</div>
                  <span className={`user-role-pill role-${currentUser.app_role.toLowerCase()}`}>
                    {currentUser.app_role}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setPasswordModalOpen(true)}
                  title="Change Password"
                >
                  <KeyRound size={13} />
                  Password
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLoginModalOpen(true)}
                  title="Switch Account"
                >
                  <UserCheck size={13} />
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleLogout}
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{ width: "100%" }}
              onClick={() => setLoginModalOpen(true)}
            >
              Sign In to CueClub
            </button>
          )}
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-content">
        {currentTab === "tables" && <TablesView currentUser={currentUser} />}
        {currentTab === "ledger" && role !== "Casual" && <LedgerView currentUser={currentUser} />}
        {currentTab === "tournaments" && (
          <TournamentsView
            currentUser={currentUser}
            onOpenScorer={(match) => setScoringMatch(match)}
          />
        )}
        {currentTab === "leaderboard" && <LeaderboardView />}
        {currentTab === "inventory" && isAdminOrStaff && <InventoryView currentUser={currentUser} />}
        {currentTab === "coaching" && role !== "Casual" && <CoachingView currentUser={currentUser} />}
        {currentTab === "analytics" && isAdminOrStaff && <AnalyticsView currentUser={currentUser} />}
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        currentUser={currentUser}
      />

      {scoringMatch && (
        <MatchScorer
          match={scoringMatch}
          onClose={() => setScoringMatch(null)}
          onCompleteSuccess={() => {
            // Trigger refresh
            setActiveTab("tournaments");
          }}
        />
      )}
    </div>
  );
}
