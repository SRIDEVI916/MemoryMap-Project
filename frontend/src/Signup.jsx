import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); // Default to 'user'
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:8000/signup/', {
        username,
        password,
        role
      });
      
      alert("Account created! Please login.");
      navigate('/'); // Redirect to Login
      
    } catch (error) {
      alert("Error: Username might already exist.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2>Create Account</h2>
        <form onSubmit={handleSignup} style={styles.form}>
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
          
          <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.input}>
            <option value="user">Regular User</option>
            <option value="admin">Administrator</option>
          </select>
          
          <button type="submit" style={styles.button}>Sign Up</button>
        </form>
        <p>Already have an account? <Link to="/">Login here</Link></p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'},
  box: { background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', width: '300px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' },
  input: { padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { padding: '10px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }
};

export default Signup;