import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';

function App() {
  // Global State for User Authentication
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    role: null
  });

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }) => {
    if (!auth.isAuthenticated) {
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Login is the Default Page */}
        <Route path="/" element={<Login setAuth={setAuth} />} />
        
        {/* Signup Page */}
        <Route path="/signup" element={<Signup />} />
        
        {/* Dashboard (Protected!) */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              {/* We pass the role to the Dashboard so it can decide what to show */}
              <Dashboard userRole={auth.role} username={auth.user} />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;