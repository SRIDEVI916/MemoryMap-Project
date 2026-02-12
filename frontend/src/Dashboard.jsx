import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

function Dashboard({ username, onOpenEditor, onLogout }) {
  const [photos, setPhotos] = useState({ clusters: {}, extras: [], extras_info: [] });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: "" });

  const MAX_PHOTOS = 20;

  // Fetch photos on mount
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/photos/${username}`);
        setPhotos(res.data);
      } catch (e) { 
        console.log("New user - no photos yet."); 
      }
    };
    fetchPhotos();
  }, [username]);

  // Handle upload
  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    if (files.length > MAX_PHOTOS) {
      alert(`Please upload maximum ${MAX_PHOTOS} photos at a time.`);
      return;
    }

    setLoading(true);
    setUploadProgress({ current: 0, total: files.length, status: "Uploading & Analyzing..." });

    const formData = new FormData();
    formData.append('username', username);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await axios.post('http://127.0.0.1:8000/upload-photos/', formData);
      setPhotos(res.data.data);
      setUploadProgress({ current: 0, total: 0, status: "Success! Photos organized." });
      
      setTimeout(() => {
        setUploadProgress({ current: 0, total: 0, status: "" });
      }, 3000);
    } catch (err) {
      console.error("Upload error:", err);
      const errorMsg = err.response?.data?.detail || "Error processing photos. Check console.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header with Logout */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0 }}>Welcome, {username}</h1>
        <button 
          onClick={onLogout}
          style={{
            padding: '8px 20px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* Upload Section */}
      <div className="step-box">
        <h3>📸 Upload Your Memories</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>
          Upload up to {MAX_PHOTOS} photos. Our AI will organize them by events and outfits.
        </p>
        <input 
          type="file" 
          multiple 
          accept="image/*,.heic"
          onChange={handleUpload} 
          disabled={loading} 
        />
        
        {loading && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f0f0f7', 
            borderRadius: '8px', 
            textAlign: 'center' 
          }}>
            <div className="spinner">⚙️</div>
            <p><strong>{uploadProgress.status}</strong></p>
            <div style={{ 
              width: '100%', 
              height: '10px', 
              background: '#ddd', 
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                background: '#6c5ce7', 
                borderRadius: '5px', 
                transition: '1s' 
              }}></div>
            </div>
            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
              Processing {uploadProgress.total} photos with AI clustering...
            </p>
          </div>
        )}

        {uploadProgress.status === "Success! Photos organized." && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#d4edda', 
            color: '#155724',
            borderRadius: '6px',
            border: '1px solid #c3e6cb'
          }}>
            ✓ Photos successfully organized into events!
          </div>
        )}
      </div>

      {/* Collection Summary */}
      {(Object.keys(photos.clusters).length > 0 || photos.extras.length > 0) && (
        <div className="collection-summary">
          <h4>📊 Your Collection:</h4>
          <p>🎭 Events: {Object.keys(photos.clusters).length}</p>
          <p>🌄 Scenery/Extras: {photos.extras.length}</p>
          <p>📷 Total Photos: {
            Object.values(photos.clusters).reduce((sum, cluster) => sum + cluster.length, 0) + 
            photos.extras.length
          }</p>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '15px',
        marginTop: '20px'
      }}>
        <button 
          className="action-btn"
          onClick={onOpenEditor}
          disabled={Object.keys(photos.clusters).length === 0 && photos.extras.length === 0}
          style={{
            padding: '20px',
            background: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? '#cccccc' 
              : 'linear-gradient(135deg, #6c5ce7 0%, #5849c7 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? 'not-allowed' 
              : 'pointer',
            boxShadow: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? 'none' 
              : '0 4px 15px rgba(108, 92, 231, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            if (Object.keys(photos.clusters).length > 0 || photos.extras.length > 0) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(108, 92, 231, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(108, 92, 231, 0.3)';
          }}
        >
          🎨 Create Photo Book
        </button>

        <button 
          className="action-btn"
          onClick={() => {
            // View photos in simple gallery
            alert("Simple gallery view - coming soon! Use Photo Book Editor for now.");
          }}
          disabled={Object.keys(photos.clusters).length === 0 && photos.extras.length === 0}
          style={{
            padding: '20px',
            background: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? '#cccccc' 
              : 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? 'not-allowed' 
              : 'pointer',
            boxShadow: Object.keys(photos.clusters).length === 0 && photos.extras.length === 0 
              ? 'none' 
              : '0 4px 15px rgba(46, 204, 113, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            if (Object.keys(photos.clusters).length > 0 || photos.extras.length > 0) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(46, 204, 113, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(46, 204, 113, 0.3)';
          }}
        >
          🖼️ View Gallery
        </button>
      </div>

      {/* Photo Preview Section */}
      {Object.keys(photos.clusters).length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>📂 Your Organized Events</h3>
          
          {Object.keys(photos.clusters).map(key => (
            <div key={key} style={{ 
              marginBottom: '25px',
              background: 'white',
              padding: '15px',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <h4 style={{ 
                background: '#6c5ce7',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                {key} ({photos.clusters[key].length} photos)
              </h4>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px'
              }}>
                {photos.clusters[key].slice(0, 6).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img 
                      src={url}
                      alt={`Event photo ${i+1}`}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    />
                  </div>
                ))}
                {photos.clusters[key].length > 6 && (
                  <div style={{
                    width: '100%',
                    height: '150px',
                    background: '#f0f0f0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    color: '#666'
                  }}>
                    +{photos.clusters[key].length - 6} more
                  </div>
                )}
              </div>
            </div>
          ))}

          {photos.extras && photos.extras.length > 0 && (
            <div style={{ 
              marginBottom: '25px',
              background: 'white',
              padding: '15px',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <h4 style={{ 
                background: '#95a5a6',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                🌄 Scenery/Extras ({photos.extras.length} photos)
              </h4>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px'
              }}>
                {photos.extras.slice(0, 6).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img 
                      src={url}
                      alt={`Extra photo ${i+1}`}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    />
                  </div>
                ))}
                {photos.extras.length > 6 && (
                  <div style={{
                    width: '100%',
                    height: '150px',
                    background: '#f0f0f0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    color: '#666'
                  }}>
                    +{photos.extras.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;