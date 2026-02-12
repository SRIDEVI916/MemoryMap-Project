import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
// No separate CSS import needed - everything is in App.css under .editor-container

let FC, FRect, FText, FIText, FImage;

async function loadFabric() {
  const mod = await import('fabric');
  const f = mod.fabric ?? mod;
  FC     = f.Canvas;
  FRect  = f.Rect;
  FText  = f.Text;
  FIText = f.IText;
  FImage = f.Image;
  console.log('Fabric loaded:', !!FC);
}

const LAYOUTS = {
  blank:         { name: "Blank",         icon: "📄", zones: [] },
  heroFull:      { name: "Hero Full",      icon: "🖼️", zones: [{ x:20,  y:20,  w:560, h:760 }] },
  twoVertical:   { name: "Two Vertical",   icon: "▯▯", zones: [{ x:20,  y:20,  w:270, h:760 }, { x:310, y:20,  w:270, h:760 }] },
  twoHorizontal: { name: "Two Horizontal", icon: "▬▬", zones: [{ x:20,  y:20,  w:560, h:370 }, { x:20,  y:410, w:560, h:370 }] },
  threeVertical: { name: "Three Vertical", icon: "▯▯▯",zones: [{ x:20,  y:20,  w:173, h:760 }, { x:213, y:20,  w:173, h:760 }, { x:407, y:20,  w:173, h:760 }] },
  fourGrid:      { name: "Four Grid",      icon: "⊞",  zones: [{ x:20,  y:20,  w:270, h:370 }, { x:310, y:20,  w:270, h:370 }, { x:20,  y:410, w:270, h:370 }, { x:310, y:410, w:270, h:370 }] },
  sixGrid:       { name: "Six Grid",       icon: "⊟",  zones: [{ x:20,  y:20,  w:173, h:240 }, { x:213, y:20,  w:173, h:240 }, { x:407, y:20,  w:173, h:240 }, { x:20,  y:280, w:173, h:240 }, { x:213, y:280, w:173, h:240 }, { x:407, y:280, w:173, h:240 }] },
  magazine:      { name: "Magazine",       icon: "📰", zones: [{ x:20,  y:20,  w:370, h:500 }, { x:410, y:20,  w:170, h:240 }, { x:410, y:280, w:170, h:240 }] },
  scrapbook:     { name: "Scrapbook",      icon: "✂️", zones: [{ x:30,  y:30,  w:240, h:320 }, { x:330, y:50,  w:220, h:280 }, { x:50,  y:380, w:200, h:260 }, { x:310, y:400, w:250, h:330 }] },
  travel:        { name: "Travel Story",   icon: "✈️", zones: [{ x:20,  y:20,  w:560, h:300 }, { x:20,  y:340, w:175, h:200 }, { x:212, y:340, w:175, h:200 }, { x:405, y:340, w:175, h:200 }] },
  instagram:     { name: "Insta Grid",     icon: "📱", zones: [{ x:20,  y:20,  w:560, h:560 }, { x:20,  y:600, w:173, h:180 }, { x:213, y:600, w:173, h:180 }, { x:407, y:600, w:173, h:180 }] },
  yearbook:      { name: "Yearbook",       icon: "🎓", zones: [{ x:20,  y:20,  w:270, h:350 }, { x:310, y:20,  w:270, h:350 }, { x:20,  y:390, w:180, h:180 }, { x:220, y:390, w:180, h:180 }, { x:420, y:390, w:160, h:180 }] },
};

export default function PhotoEditor({ username, onBackToDashboard }) {
  const canvasElRef  = useRef(null);
  const fcRef        = useRef(null);
  const containerRef = useRef(null);
  const initRef      = useRef(false);
  const zoneRef      = useRef(0);
  const dragUrl      = useRef(null);
  const layoutRef    = useRef('blank');
  const isPanningRef = useRef(false);
  const panStartRef  = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const [photos,  setPhotos]  = useState({ clusters: {}, extras: [] });
  const [layout,  setLayout]  = useState('blank');
  const [picker,  setPicker]  = useState(false);
  const [status,  setStatus]  = useState('loading'); // 'loading' | 'ready' | 'error'

  const centerCanvasViewport = useCallback(() => {
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const left = Math.max((el.scrollWidth - el.clientWidth) / 2, 0);
      const top = Math.max((el.scrollHeight - el.clientHeight) / 2, 0);
      el.scrollTo({ left, top, behavior: 'auto' });
    });
  }, []);

  // Fetch photos
  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/photos/${username}`)
      .then(r => setPhotos(r.data))
      .catch(() => {});
  }, [username]);

  // Init canvas once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    loadFabric().then(() => {
      if (!canvasElRef.current) {
        setStatus('error');
        return;
      }

      try {
        // Set raw HTML canvas size first
        canvasElRef.current.width  = 600;
        canvasElRef.current.height = 800;

        const c = new FC(canvasElRef.current, {
          width: 600,
          height: 800,
          backgroundColor: '#ffffff',
          preserveObjectStacking: true,
          renderOnAddRemove: true,
        });

        fcRef.current = c;

        // Draw page border to confirm canvas is working
        c.add(new FRect({
          left: 1, top: 1, width: 596, height: 796,
          fill: 'transparent',
          stroke: '#dddddd',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        }));
        c.renderAll();

        setStatus('ready');
        console.log('✅ Canvas ready');
      } catch (e) {
        console.error('Canvas init failed:', e);
        setStatus('error: ' + e.message);
        initRef.current = false;
      }
    });

    return () => {
      if (fcRef.current) {
        try { fcRef.current.dispose(); } catch (_) {}
        fcRef.current = null;
        initRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    centerCanvasViewport();
    const onResize = () => centerCanvasViewport();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [status, centerCanvasViewport]);

  useEffect(() => {
    const move = (e) => {
      if (!isPanningRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      el.scrollLeft = panStartRef.current.left - dx;
      el.scrollTop = panStartRef.current.top - dy;
    };
    const up = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      const el = containerRef.current;
      if (el) el.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  // Drag & drop
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    const over = e => e.preventDefault();
    const drop = e => {
      e.preventDefault();
      const url = e.dataTransfer.getData('text/plain') || dragUrl.current;
      if (!url || !fcRef.current) return;
      const rect = canvasElRef.current.getBoundingClientRect();
      addPhoto(url, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('dragover', over);
    el.addEventListener('drop', drop);
    return () => { el.removeEventListener('dragover', over); el.removeEventListener('drop', drop); };
  }, []);

  const startPan = useCallback((e) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest('.canvas-wrap')) return;
    const el = containerRef.current;
    if (!el) return;
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
    };
    el.style.cursor = 'grabbing';
    e.preventDefault();
  }, []);

  // Apply layout
  const applyLayout = useCallback((key) => {
    const c = fcRef.current;
    if (!c) { alert('Canvas loading... try again in 1 second.'); return; }

    layoutRef.current = key;
    setLayout(key);
    zoneRef.current = 0;

    // Clear canvas safely
    c.getObjects().slice().forEach(o => c.remove(o));
    c.backgroundColor = '#ffffff';

    // Page border
    c.add(new FRect({
      left: 1, top: 1, width: 596, height: 796,
      fill: 'transparent', stroke: '#dddddd', strokeWidth: 2,
      selectable: false, evented: false,
    }));

    LAYOUTS[key].zones.forEach((z, i) => {
      c.add(new FRect({
        left: z.x, top: z.y, width: z.w, height: z.h,
        fill: '#f5f5f5',
        stroke: '#aaaaaa',
        strokeWidth: 2,
        strokeDashArray: [8, 5],
        selectable: false,
        evented: false,
      }));
      c.add(new FText(`📷  Photo ${i + 1}`, {
        left: z.x + z.w / 2,
        top:  z.y + z.h / 2,
        originX: 'center',
        originY: 'center',
        fontSize: Math.min(18, Math.max(12, z.h / 8)),
        fill: '#aaaaaa',
        fontFamily: 'Arial',
        selectable: false,
        evented: false,
      }));
    });

    c.renderAll();
    setTimeout(centerCanvasViewport, 0);
    setTimeout(() => fcRef.current?.renderAll(), 30);
    setPicker(false);
    console.log('Layout applied:', key, '| objects:', c.getObjects().length);
  }, [centerCanvasViewport]);

  // Add photo
  const addPhoto = useCallback((url, dropX = null, dropY = null) => {
    const c = fcRef.current;
    if (!c) { alert('Canvas not ready!'); return; }

    const zones = LAYOUTS[layoutRef.current].zones;

    const place = (img) => {
      if (!img) { console.error('Failed to load image'); return; }

      if (zones.length > 0) {
        const zi = zoneRef.current % zones.length;
        const z  = zones[zi];
        zoneRef.current++;

        const sx = z.w / img.width;
        const sy = z.h / img.height;
        const sc = Math.max(sx, sy);
        const sw = img.width  * sc;
        const sh = img.height * sc;

        img.set({
          scaleX: sc, scaleY: sc,
          left: z.x - (sw - z.w) / 2,
          top:  z.y - (sh - z.h) / 2,
          clipPath: new FRect({
            left: z.x, top: z.y,
            width: z.w, height: z.h,
            absolutePositioned: true,
          }),
        });
      } else {
        img.scaleToWidth(250);
        img.set({
          left: dropX != null ? dropX - 125 : 175,
          top:  dropY != null ? dropY - img.getScaledHeight() / 2 : 275,
        });
      }

      img.set({
        cornerStyle: 'circle', cornerColor: '#6c5ce7',
        borderColor: '#6c5ce7', cornerSize: 10,
        transparentCorners: false,
      });

      c.add(img);
      c.setActiveObject(img);
      c.renderAll();
      console.log('Photo added | total objects:', c.getObjects().length);
    };

    // Handle both v5 (callback) and v6 (Promise)
    const corsUrl = url.includes('cloudinary.com')
      ? url.replace('/upload/', '/upload/f_auto,q_auto/')
      : url;

    try {
      const result = FImage.fromURL(corsUrl, place, { crossOrigin: 'anonymous' });
      if (result && typeof result.then === 'function') {
        result.then(img => { if (img) place(img); }).catch(() => FImage.fromURL(url, place));
      }
    } catch (e) {
      console.error('addPhoto error:', e);
    }
  }, []);

  // Text
  const addText = useCallback(() => {
    const c = fcRef.current;
    if (!c) return;
    const t = new FIText('Double-click to edit', {
      left: 150, top: 380,
      fontSize: 28, fill: '#222222',
      fontFamily: 'Arial', fontWeight: 'bold',
      cornerStyle: 'circle', cornerColor: '#6c5ce7', borderColor: '#6c5ce7',
    });
    c.add(t);
    c.setActiveObject(t);
    c.renderAll();
  }, []);

  const setProp = useCallback((prop, val) => {
    const c = fcRef.current;
    const o = c?.getActiveObject();
    if (!o) return;
    o.set(prop, val);
    c.renderAll();
  }, []);

  const deleteObj = useCallback(() => {
    const c = fcRef.current;
    const o = c?.getActiveObject();
    if (o) { c.remove(o); c.renderAll(); }
  }, []);

  const bringFront = useCallback(() => {
    const c = fcRef.current;
    const o = c?.getActiveObject();
    if (!o) return;
    try { c.bringObjectToFront(o); } catch (_) { try { c.bringToFront(o); } catch (_) {} }
    c.renderAll();
  }, []);

  const sendBack = useCallback(() => {
    const c = fcRef.current;
    const o = c?.getActiveObject();
    if (!o) return;
    try { c.sendObjectToBack(o); } catch (_) { try { c.sendToBack(o); } catch (_) {} }
    c.renderAll();
  }, []);

  const clearAll = useCallback(() => {
    const c = fcRef.current;
    if (!c || !window.confirm('Clear everything?')) return;
    c.getObjects().slice().forEach(o => c.remove(o));
    c.backgroundColor = '#ffffff';
    c.renderAll();
    zoneRef.current = 0;
  }, []);

  const savePNG = useCallback(async () => {
    const c = fcRef.current;
    if (!c) return;
    try {
      const url = c.toDataURL({ format: 'png', multiplier: 2 });
      Object.assign(document.createElement('a'), { href: url, download: `photobook_${Date.now()}.png` }).click();
    } catch (e) {
      alert('Export blocked by CORS. Go to Cloudinary Dashboard → Settings → Security → Enable CORS.');
    }
  }, []);

  const savePDF = useCallback(async () => {
    const c = fcRef.current;
    if (!c) return;
    try {
      const url = c.toDataURL({ format: 'png', multiplier: 2 });
      const pdf = new jsPDF({ unit: 'px', format: [600, 800] });
      pdf.addImage(url, 'PNG', 0, 0, 600, 800);
      pdf.save(`photobook_${Date.now()}.pdf`);
    } catch (e) {
      alert('Export blocked by CORS. Go to Cloudinary Dashboard → Settings → Security → Enable CORS.');
    }
  }, []);

  const total = Object.values(photos.clusters || {}).reduce((s, a) => s + a.length, 0) + (photos.extras?.length || 0);

  return (
    <div className="editor-container">

      {/* ── SIDEBAR ── */}
      <div className="editor-sidebar">
        <button className="btn-dark" onClick={onBackToDashboard}
          style={{ width: '100%', marginBottom: '12px' }}>
          ← Back
        </button>

        <div style={{ background: '#f0ebff', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', border: '2px solid #6c5ce7' }}>
          <strong style={{ fontSize: '0.9rem', color: '#2c3e50' }}>📸 Photos ({total})</strong>
          <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#666' }}>Click or drag to canvas</p>
        </div>

        {status === 'loading' && <p style={{ color: '#e67e22', fontSize: '0.82rem' }}>⏳ Loading canvas...</p>}
        {status.startsWith('error') && <p style={{ color: 'red', fontSize: '0.82rem' }}>❌ {status}</p>}

        {Object.keys(photos.clusters || {}).map(k => (
          <div key={k} style={{ marginBottom: '18px' }}>
            <div style={{ background: '#6c5ce7', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '6px', fontWeight: '600', fontSize: '0.82rem', fontFamily: 'Arial' }}>
              {k} ({photos.clusters[k].length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {photos.clusters[k].map((url, i) => (
                <img key={i} src={url} alt="" className="editor-thumb"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', url); dragUrl.current = url; }}
                  onClick={() => addPhoto(url)}
                />
              ))}
            </div>
          </div>
        ))}

        {photos.extras?.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ background: '#95a5a6', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '6px', fontWeight: '600', fontSize: '0.82rem', fontFamily: 'Arial' }}>
              Extras ({photos.extras.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {photos.extras.map((url, i) => (
                <img key={i} src={url} alt="" className="editor-thumb"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', url); dragUrl.current = url; }}
                  onClick={() => addPhoto(url)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN ── */}
      <div className="editor-main">

        {/* Toolbar */}
        <div className="editor-toolbar">
          <button className="btn-purple" onClick={() => setPicker(true)}>📐 Layouts</button>
          <button className="btn-green"  onClick={addText}>➕ Text</button>
          <button className="btn-red"    onClick={deleteObj}>🗑 Delete</button>
          <button className="btn-blue"   onClick={bringFront}>⬆ Front</button>
          <button className="btn-violet" onClick={sendBack}>⬇ Back</button>
          <button className="btn-grey"   onClick={clearAll}>🧹 Clear</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '7px' }}>
            <button className="btn-dkgreen" onClick={savePNG}>💾 PNG</button>
            <button className="btn-orange"  onClick={savePDF}>📄 PDF</button>
          </div>
        </div>

        {/* Text controls */}
        <div className="editor-textbar">
          <strong>Font:</strong>
          <select onChange={e => setProp('fontFamily', e.target.value)}>
            {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact'].map(f => <option key={f}>{f}</option>)}
          </select>
          <strong>Size:</strong>
          <select onChange={e => setProp('fontSize', +e.target.value)}>
            {[14, 18, 22, 26, 30, 36, 42, 52, 64, 72].map(s => <option key={s}>{s}</option>)}
          </select>
          <strong>Color:</strong>
          <input type="color" defaultValue="#222222" onChange={e => setProp('fill', e.target.value)} />
        </div>

        {/* Layout modal */}
        {picker && (
          <div className="editor-modal-overlay" onClick={() => setPicker(false)}>
            <div className="editor-modal" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginTop: 0 }}>Choose Layout</h2>
              <div className="editor-layout-grid">
                {Object.entries(LAYOUTS).map(([k, l]) => (
                  <div key={k}
                    className={`editor-layout-card${layout === k ? ' active' : ''}`}
                    onClick={() => applyLayout(k)}>
                    <div style={{ fontSize: '2rem', marginBottom: '6px' }}>{l.icon}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.82rem', color: '#2c3e50' }}>{l.name}</div>
                  </div>
                ))}
              </div>
              <button className="btn-grey" style={{ width: '100%', padding: '12px' }} onClick={() => setPicker(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="editor-canvas-area" ref={containerRef} onMouseDown={startPan}>
          <div className="editor-canvas-center">
            <div className="canvas-wrap">
              <canvas ref={canvasElRef} />
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="editor-tips">
          <span>💡 Pick a layout first</span>
          <span>📸 Click photos from sidebar</span>
          <span>✏️ Double-click text to edit</span>
          <span>🖱️ Drag to reposition</span>
        </div>
      </div>
    </div>
  );
}
