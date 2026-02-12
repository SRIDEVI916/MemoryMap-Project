import React, { useState } from 'react';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';
import PhotoEditor from './Editor';
import './App.css';

function App() {
  const [view, setView] = useState('login'); 
  const [username, setUsername] = useState('');
  
  // 1. ADDED THIS STATE: This keeps your photos alive when switching views
  const [photos, setPhotos] = useState({ clusters: {}, extras: [] });

  // ========================================================================
  // LOGIN VIEW
  // ========================================================================
  if (view === 'login') {
    return (
      <Login 
        onLoginSuccess={(user) => {
          setUsername(user);
          setView('dashboard');
        }}
        onGoToSignup={() => setView('signup')}
      />
    );
  }

  // ========================================================================
  // SIGNUP VIEW
  // ========================================================================
  if (view === 'signup') {
    return (
      <Signup 
        onSignupSuccess={(user) => {
          setUsername(user);
          setView('dashboard');
        }}
        onGoToLogin={() => setView('login')}
      />
    );
  }

  // ========================================================================
  // DASHBOARD VIEW
  // ========================================================================
  if (view === 'dashboard') {
    return (
      <Dashboard 
        username={username}
        // 2. Pass setPhotos to Dashboard so it can save the results of the upload
        setGlobalPhotos={setPhotos} 
        onOpenEditor={() => setView('editor')}
        onLogout={() => {
          setUsername('');
          setPhotos({ clusters: {}, extras: [] }); // Clear on logout
          setView('login');
        }}
      />
    );
  }

  // ========================================================================
  // PHOTO EDITOR VIEW
  // ========================================================================
  if (view === 'editor') {
    return (
      <PhotoEditor 
        username={username}
        // 3. Pass the actual photos data to the Editor
        photos={photos} 
        onBackToDashboard={() => setView('dashboard')}
        onLogout={() => {
          setUsername('');
          setPhotos({ clusters: {}, extras: [] });
          setView('login');
        }}
      />
    );
  }

  return null;
}

export default App;