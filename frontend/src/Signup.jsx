import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function Signup({ onSignupSuccess, onGoToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      const res = await axios.post('http://127.0.0.1:8000/signup/', {
        username,
        password
      });
      
      if (res.data.status === 'success') {
        onSignupSuccess(username); // Use the prop instead of navigate
      }
    } catch (err) {
      setError('Username already exists');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Sign Up for MemoryMap</h2>
        
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
        
        <form onSubmit={handleSignup}>
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
          
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          
          <button type="submit">Sign Up</button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          Already have an account?{' '}
          <span 
            onClick={onGoToLogin}
            style={{ 
              color: '#6c5ce7', 
              cursor: 'pointer', 
              textDecoration: 'underline' 
            }}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

export default Signup;