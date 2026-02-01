import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import './App.css'; 

// NEW: Accept 'username' as a prop
function Dashboard({ userRole, username }) { 
  const [view, setView] = useState('dashboard'); 
  const [photos, setPhotos] = useState([]);
  const [sortBy, setSortBy] = useState('date');
  const [groupedPhotos, setGroupedPhotos] = useState({});
  const [draggedUrl, setDraggedUrl] = useState(null);
  
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);

  // --- 1. FETCH PHOTOS (Specific to User) ---
  const fetchPhotos = async () => {
    if (!username) return;
    try {
      // NEW: Send username as query param
      const response = await axios.get(`http://127.0.0.1:8000/photos/?username=${username}`);
      setPhotos(response.data);
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [username]); // Re-run if user changes

  // ... (Keep Canvas Initialization useEffect same) ...
  useEffect(() => {
    if (view === 'editor' && canvasRef.current && !fabricCanvas) {
      const newCanvas = new fabric.Canvas(canvasRef.current, {
        height: 842, width: 595, backgroundColor: 'white', selection: true,
      });
      setFabricCanvas(newCanvas);
      return () => {
        newCanvas.dispose();
        setFabricCanvas(null);
      };
    }
  }, [view]);

  // --- 2. UPLOAD PHOTOS (Tagged with User) ---
  const handleUpload = async (event) => {
    const files = event.target.files; 
    if (!files || files.length === 0) return;
    if (files.length > 10) {
      alert("Please select max 10 photos.");
      return;
    }

    const formData = new FormData();
    // NEW: Add username to the form
    formData.append('username', username);
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      await axios.post('http://127.0.0.1:8000/upload-photos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchPhotos();
      alert(`Success! ${files.length} photos uploaded.`);
    } catch (error) {
      console.error(error);
      alert("Upload failed.");
    }
  };

  // ... (Keep applySorting, handleAutoLayout, addText, downloadPDF, Drag&Drop logic EXACTLY the same) ...
  
  // (For brevity, I'm hiding the unchanged helper functions. 
  //  Copy your existing helper functions: applySorting, handleAutoLayout, addText, downloadPDF, handleDragStart, etc. here)
  const applySorting = () => {
    const groups = {};
    photos.forEach(photo => {
      let key = (sortBy === 'date') ? photo.bucket_date : photo.bucket_color;
      if (!key) key = "Unsorted";
      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    });
    setGroupedPhotos(groups);
    setView('editor');
  };

  const addText = () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('Double click to edit', {
      left: 150, top: 150, fontFamily: 'Arial', fill: '#333', fontSize: 20,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  const handleAutoLayout = async (bucketPhotos) => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = 'white';
    fabricCanvas.renderAll();

    try {
      const response = await axios.post('http://127.0.0.1:8000/auto-layout/', bucketPhotos);
      const layoutData = response.data;
      layoutData.forEach(item => {
        fabric.FabricImage.fromURL(item.url, { crossOrigin: 'anonymous' }).then((img) => {
          img.set({
            left: item.left, top: item.top,
            scaleX: item.width / img.width, scaleY: item.height / img.height
          });
          fabricCanvas.add(img);
        });
      });
    } catch (error) { console.error(error); }
  };

  const downloadPDF = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    const pdf = new jsPDF('p', 'pt', 'a4');
    pdf.addImage(dataURL, 'PNG', 0, 0, 595, 842);
    pdf.save('MemoryMap_Page.pdf');
  };

  const handleDragStart = (e, url) => setDraggedUrl(url);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedUrl || !fabricCanvas) return;
    const canvasContainer = canvasRef.current.getBoundingClientRect();
    fabric.FabricImage.fromURL(draggedUrl, { crossOrigin: 'anonymous' }).then((img) => {
      img.scaleToWidth(200);
      img.set({ 
        left: e.clientX - canvasContainer.left - 100, 
        top: e.clientY - canvasContainer.top - 100 
      });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      setDraggedUrl(null);
    });
  };

  if (view === 'dashboard') {
    return (
      <div className="dashboard-container">
        {/* NEW: Show who is logged in */}
        <div style={{position:'absolute', top:20, right:20}}>
            Logged in as: <strong>{username}</strong> ({userRole})
        </div>
        
        <h1>MemoryMap Dashboard</h1>
        <div className="step-box">
          <h3>1. Upload Memories (Max 10)</h3>
          <input type="file" multiple onChange={handleUpload} />
          <p>{photos.length} photos in library</p>
        </div>
        <div className="step-box">
          <h3>2. Sort By</h3>
          <div className="toggle-group">
            <button className={sortBy === 'date' ? 'active' : ''} onClick={() => setSortBy('date')}>📅 Date</button>
            <button className={sortBy === 'color' ? 'active' : ''} onClick={() => setSortBy('color')}>🎨 Color</button>
          </div>
        </div>
        <button className="start-btn" onClick={applySorting}>Open Editor &rarr;</button>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <button onClick={() => setView('dashboard')}>&larr; Back</button>
        <h2>The Bucket ({sortBy})</h2>
        <div className="tool-panel">
            <button onClick={addText} className="tool-btn">+ Add Text</button>
        </div>
        {Object.keys(groupedPhotos).map((groupName) => (
          <div key={groupName} className="bucket-group">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h4 className="bucket-title">{groupName}</h4>
                <button 
                    onClick={() => handleAutoLayout(groupedPhotos[groupName])}
                    style={{fontSize:'10px', cursor:'pointer', padding:'2px 5px', background:'#6c5ce7', color:'white', border:'none', borderRadius:4}}
                >
                    ✨ Auto-Fill
                </button>
            </div>
            <div className="photo-grid">
              {groupedPhotos[groupName].map((photo, index) => (
                <img 
                  key={index} src={photo.image_url} alt="thumb" className="sidebar-thumb"
                  draggable="true" onDragStart={(e) => handleDragStart(e, photo.image_url)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="workspace" onDrop={handleDrop} onDragOver={handleDragOver}>
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
            <button onClick={downloadPDF} style={{padding:'10px 20px', background:'#e74c3c', color:'white', border:'none', borderRadius:5, cursor:'pointer'}}>
                ⬇ Download PDF
            </button>
        </div>
        <div className="canvas-wrapper">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;