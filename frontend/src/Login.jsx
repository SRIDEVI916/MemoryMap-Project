import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:8000/login/', {
        username,
        password
      });
      
      // Save user info to App state
      setAuth({
        isAuthenticated: true,
        user: response.data.username,
        role: response.data.role
      });
      
      alert("Welcome back!");
      navigate('/dashboard'); // Redirect to Dashboard
      
    } catch (error) {
      alert("Invalid credentials!");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2>Login to MemoryMap</h2>
        <form onSubmit={handleLogin} style={styles.form}>
          <input 
            type="text" placeholder="Username" 
            value={username} onChange={(e) => setUsername(e.target.value)} 
            style={styles.input} required
          />
          <input 
            type="password" placeholder="Password" 
            value={password} onChange={(e) => setPassword(e.target.value)} 
            style={styles.input} required
          />
          <button type="submit" style={styles.button}>Login</button>
        </form>
        <p>New here? <Link to="/signup">Create an account</Link></p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  box: { background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', width: '300px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' },
  input: { padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { padding: '10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }
};

export default Login;