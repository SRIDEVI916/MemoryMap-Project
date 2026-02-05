import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import './App.css';

function Dashboard({ username }) {
  const [view, setView] = useState('dashboard');
  const [photos, setPhotos] = useState({ clusters: {}, extras: [], extras_info: [] });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: "" });
  
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);

  const MAX_PHOTOS = 20; // Maximum photos allowed

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

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    // Validate file count
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
      
      // Show success message briefly
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

  // Canvas Setup Logic
  useEffect(() => {
    if (view === 'editor' && canvasRef.current && !fabricCanvas) {
      const c = new fabric.Canvas(canvasRef.current, { 
        height: 800, 
        width: 600, 
        backgroundColor: 'white' 
      });
      setFabricCanvas(c);
      return () => c.dispose();
    }
  }, [view, fabricCanvas]);

  // Helper to add image to canvas
  const addToCanvas = (url) => {
    if (!fabricCanvas) return;
    
    fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then(img => {
      img.scaleToWidth(150);
      fabricCanvas.add(img);
    });
  };

  if (view === 'dashboard') {
    return (
      <div className="dashboard-container">
        <h1>Welcome, {username}</h1>
        
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
            <div className="progress-container" style={{ 
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

        {/* Show summary if photos exist */}
        {(Object.keys(photos.clusters).length > 0 || photos.extras.length > 0) && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#e8f5e9', 
            borderRadius: '8px' 
          }}>
            <h4 style={{ marginBottom: '10px' }}>📊 Your Collection:</h4>
            <p>🎭 Events: {Object.keys(photos.clusters).length}</p>
            <p>🌄 Scenery/Extras: {photos.extras.length}</p>
          </div>
        )}

        <button className="start-btn" onClick={() => setView('editor')}>
          Open Photo Editor
        </button>
      </div>
    );
  }

  // ========================================================================
  // EDITOR VIEW
  // ========================================================================
  
  return (
    <div className="editor-container">
      <div className="sidebar">
        <button onClick={() => setView('dashboard')} style={{ marginBottom: '15px' }}>
          ← Back to Dashboard
        </button>
        
        {/* Event Clusters */}
        {Object.keys(photos.clusters).map(key => (
          <div key={key} style={{ marginBottom: '20px' }}>
            <h4 style={{ 
              background: '#6c5ce7', 
              color: 'white', 
              padding: '8px 12px', 
              borderRadius: '6px',
              marginBottom: '10px'
            }}>
              🎭 {key} ({photos.clusters[key].length} photos)
            </h4>
            <div className="photo-grid">
              {photos.clusters[key].map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  className="sidebar-thumb" 
                  alt={`Event photo ${i+1}`}
                  draggable 
                  onClick={() => addToCanvas(url)}
                  onDragStart={() => addToCanvas(url)}
                  style={{ cursor: 'pointer' }}
                  title="Click or drag to add to canvas"
                />
              ))}
            </div>
          </div>
        ))}

        {/* Extras/Scenery Bucket */}
        {photos.extras && photos.extras.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ 
              background: '#95a5a6', 
              color: 'white', 
              padding: '8px 12px', 
              borderRadius: '6px',
              marginBottom: '10px'
            }}>
              🌄 Scenery/Extras ({photos.extras.length} photos)
            </h4>
            <p style={{ 
              fontSize: '0.85rem', 
              color: '#666', 
              marginBottom: '10px',
              padding: '0 5px'
            }}>
              Photos without the primary person or unmatched group photos
            </p>
            <div className="photo-grid">
              {photos.extras.map((url, i) => {
                // Try to get extra info if available
                const info = photos.extras_info ? photos.extras_info[i] : null;
                
                return (
                  <div key={i} style={{ position: 'relative' }}>
                    <img 
                      src={url} 
                      className="sidebar-thumb" 
                      alt={`Extra photo ${i+1}`}
                      draggable 
                      onClick={() => addToCanvas(url)}
                      onDragStart={() => addToCanvas(url)}
                      style={{ cursor: 'pointer' }}
                      title={info ? `${info.filename} (${info.face_count} faces)` : "Click or drag to add"}
                    />
                    {info && info.face_count > 0 && (
                      <span style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '5px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.7rem'
                      }}>
                        👤 {info.face_count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Object.keys(photos.clusters).length === 0 && (!photos.extras || photos.extras.length === 0) && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#999' 
          }}>
            <p>No photos yet.</p>
            <p style={{ fontSize: '0.9rem' }}>Upload photos to get started!</p>
          </div>
        )}
      </div>

      <div className="workspace">
        <div style={{ marginBottom: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>✨ Canvas Editor</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0' }}>
            Click or drag photos from the sidebar to create your collage
          </p>
        </div>
        <canvas ref={canvasRef} style={{ border: '2px solid #ddd', borderRadius: '8px' }} />
      </div>
    </div>
  );
}

export default Dashboard;