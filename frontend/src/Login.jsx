import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function Login({ onLoginSuccess, onGoToSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      const res = await axios.post('http://127.0.0.1:8000/login/', {
        username,
        password
      });
      
      if (res.data.status === 'success') {
        onLoginSuccess(res.data.user); // Use the prop instead of navigate
      }
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login to MemoryMap</h2>
        
        {error && (
          <div style={{ 
            padding: '10px', 
            background: '#fee', 
            color: '#c00', 
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button type="submit">Login</button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          Don't have an account?{' '}
          <span 
            onClick={onGoToSignup}
            style={{ 
              color: '#6c5ce7', 
              cursor: 'pointer', 
              textDecoration: 'underline' 
            }}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;