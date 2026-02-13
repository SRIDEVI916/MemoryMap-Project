import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/* ─── LAYOUT DEFINITIONS (% of page) ───────────────────────────────────────── */
const PAD = 3.3, GAP = 1.7;
const IW = 100 - PAD * 2, IH = 100 - PAD * 2;

const col2w = (IW - GAP) / 2;
const col3w = (IW - GAP * 2) / 3;
const row2h = (IH - GAP) / 2;
const row3h = (IH - GAP * 2) / 3;

const LAYOUTS = {
  blank:         { name: 'Blank',         icon: '📄', zones: [] },
  heroFull:      { name: 'Full Page',      icon: '🖼️', zones: [{ x:PAD, y:PAD, w:IW, h:IH }] },
  twoVertical:   { name: 'Side by Side',   icon: '▯▯', zones: [
    { x:PAD,            y:PAD, w:col2w, h:IH },
    { x:PAD+col2w+GAP,  y:PAD, w:col2w, h:IH },
  ]},
  twoHorizontal: { name: 'Top & Bottom',   icon: '▬▬', zones: [
    { x:PAD, y:PAD,            w:IW, h:row2h },
    { x:PAD, y:PAD+row2h+GAP,  w:IW, h:row2h },
  ]},
  threeVertical: { name: 'Three Columns',  icon: '▯▯▯', zones: [
    { x:PAD,               y:PAD, w:col3w, h:IH },
    { x:PAD+col3w+GAP,     y:PAD, w:col3w, h:IH },
    { x:PAD+col3w*2+GAP*2, y:PAD, w:col3w, h:IH },
  ]},
  fourGrid:      { name: 'Four Grid',      icon: '⊞', zones: [
    { x:PAD,           y:PAD,           w:col2w, h:row2h },
    { x:PAD+col2w+GAP, y:PAD,           w:col2w, h:row2h },
    { x:PAD,           y:PAD+row2h+GAP, w:col2w, h:row2h },
    { x:PAD+col2w+GAP, y:PAD+row2h+GAP, w:col2w, h:row2h },
  ]},
  sixGrid:       { name: 'Six Grid',       icon: '⊟', zones: [
    { x:PAD,               y:PAD,           w:col3w, h:row2h },
    { x:PAD+col3w+GAP,     y:PAD,           w:col3w, h:row2h },
    { x:PAD+col3w*2+GAP*2, y:PAD,           w:col3w, h:row2h },
    { x:PAD,               y:PAD+row2h+GAP, w:col3w, h:row2h },
    { x:PAD+col3w+GAP,     y:PAD+row2h+GAP, w:col3w, h:row2h },
    { x:PAD+col3w*2+GAP*2, y:PAD+row2h+GAP, w:col3w, h:row2h },
  ]},
  magazine:      { name: 'Magazine',       icon: '📰', zones: [
    { x:PAD,              y:PAD, w:IW*0.6-GAP/2, h:IH },
    { x:PAD+IW*0.6+GAP/2, y:PAD, w:IW*0.4-GAP/2, h:row2h },
    { x:PAD+IW*0.6+GAP/2, y:PAD+row2h+GAP, w:IW*0.4-GAP/2, h:row2h },
  ]},
  travel:        { name: 'Travel Story',   icon: '✈️', zones: [
    { x:PAD, y:PAD,             w:IW,    h:IH*0.45-GAP/2 },
    { x:PAD,               y:PAD+IH*0.45+GAP/2, w:col3w, h:IH*0.55-GAP/2 },
    { x:PAD+col3w+GAP,     y:PAD+IH*0.45+GAP/2, w:col3w, h:IH*0.55-GAP/2 },
    { x:PAD+col3w*2+GAP*2, y:PAD+IH*0.45+GAP/2, w:col3w, h:IH*0.55-GAP/2 },
  ]},
  instagram:     { name: 'Insta Grid',     icon: '📱', zones: [
    { x:PAD, y:PAD,             w:IW,    h:IH*0.65-GAP/2 },
    { x:PAD,               y:PAD+IH*0.65+GAP/2, w:col3w, h:IH*0.35-GAP/2 },
    { x:PAD+col3w+GAP,     y:PAD+IH*0.65+GAP/2, w:col3w, h:IH*0.35-GAP/2 },
    { x:PAD+col3w*2+GAP*2, y:PAD+IH*0.65+GAP/2, w:col3w, h:IH*0.35-GAP/2 },
  ]},
  scrapbook:     { name: 'Scrapbook',      icon: '✂️', zones: [
    { x:PAD,       y:PAD,   w:44, h:43 },
    { x:53,        y:PAD+2, w:40, h:38 },
    { x:PAD+2,     y:50,    w:38, h:47 },
    { x:54,        y:52,    w:43, h:45 },
  ]},
};

const PAGE_W = 600, PAGE_H = 800;

const newPage = (id) => ({
  id,
  layoutKey: 'blank',
  photos: {},
  texts: [],
  bgColor: '#ffffff',
});

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN EDITOR
══════════════════════════════════════════════════════════════════════════════ */
export default function PhotoEditor({ username, onBackToDashboard }) {
  const [allPhotos,    setAllPhotos]   = useState({ clusters: {}, extras: [] });
  const [pages,        setPages]       = useState([newPage(Date.now())]);
  const [activePage,   setActivePage]  = useState(0);
  const [showLayouts,  setShowLayouts] = useState(false);
  const [selectedText, setSelectedText]= useState(null);
  const [scale,        setScale]       = useState(1);
  const [bgMode,       setBgMode]      = useState('color'); // 'color' | 'pattern'
  const [showBgPanel,  setShowBgPanel] = useState(false);
  const [showStickers, setShowStickers] = useState(false);

  const pageRef        = useRef(null);
  const canvasAreaRef  = useRef(null);
  const nextId         = useRef(1);
  const activePageRef  = useRef(0);
  const FONTS = ['Georgia', 'Playfair Display', 'Arial', 'Courier New', 'Impact', 'Verdana', 'Trebuchet MS', 'Times New Roman'];
  
  // Curated sticker collection - cute decorative elements
  const STICKER_CATEGORIES = {
    hearts: {
      name: '💕 Hearts & Love',
      items: [
        'https://i.pinimg.com/originals/8f/93/30/8f9330e5d0e0e0e7c0e0e0e0e0e0e0e0.png',
        'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200&h=200&fit=crop',
        '❤️', '💕', '💖', '💗', '💓', '💝', '💘', '💞'
      ]
    },
    flowers: {
      name: '🌸 Flowers & Nature',
      items: [
        '🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🏵️', '💐',
        '🌿', '🍃', '🌱', '☘️', '🍀', '🌾', '🌵', '🌴'
      ]
    },
    sparkles: {
      name: '✨ Sparkles & Magic',
      items: [
        '✨', '⭐', '🌟', '💫', '⚡', '🔆', '☀️', '🌙',
        '⛅', '🌈', '☁️', '🌤️', '🌞', '🌝', '🌛', '🌜'
      ]
    },
    cute: {
      name: '🎀 Cute & Kawaii',
      items: [
        '🎀', '🎁', '🎈', '🎊', '🎉', '🎂', '🧁', '🍰',
        '🍓', '🍒', '🍑', '🍊', '🍋', '🍌', '🍉', '🍇'
      ]
    },
    animals: {
      name: '🐾 Animals & Pets',
      items: [
        '🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁',
        '🐮', '🐷', '🐸', '🐵', '🦊', '🦋', '🐝', '🐞'
      ]
    },
    travel: {
      name: '✈️ Travel & Adventure',
      items: [
        '✈️', '🚗', '🚢', '🎡', '🎢', '🏰', '🗼', '🗽',
        '🏖️', '🏝️', '⛺', '🏕️', '🗻', '🏔️', '🌋', '⛰️'
      ]
    },
    objects: {
      name: '📷 Objects & Items',
      items: [
        '📷', '📸', '🎨', '🖌️', '✏️', '📝', '💌', '📮',
        '🎵', '🎶', '🎸', '🎹', '📚', '📖', '🔖', '📎'
      ]
    },
    symbols: {
      name: '💎 Symbols & Shapes',
      items: [
        '💎', '💍', '👑', '🔮', '🎭', '🎪', '🎬', '🎯',
        '💝', '🔥', '💧', '💨', '🌊', '🌀', '🎆', '🎇'
      ]
    }
  };
  const BG_PATTERNS = [
    { label: 'White',      value: '#ffffff' },
    { label: 'Cream',      value: '#fdf8f0' },
    { label: 'Black',      value: '#1a1a1a' },
    { label: 'Navy',       value: '#1e3a5f' },
    { label: 'Blush',      value: '#fce4ec' },
    { label: 'Sage',       value: '#e8f5e9' },
    { label: 'Lavender',   value: '#f3e5f5' },
    { label: 'Warm Grey',  value: '#f5f5f0' },
    { label: 'Slate',      value: '#546e7a' },
    { label: 'Rust',       value: '#bf360c' },
    { label: 'Gold',       value: '#f9a825' },
    { label: 'Forest',     value: '#2e7d32' },
  ];

  // Auto-scale
  useEffect(() => {
    const measure = () => {
      if (!canvasAreaRef.current) return;
      const h = canvasAreaRef.current.clientHeight - 60;
      const w = canvasAreaRef.current.clientWidth  - 60;
      setScale(Math.min(1, w / PAGE_W, h / PAGE_H));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Fetch photos
  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/photos/${username}`)
      .then(r => setAllPhotos(r.data)).catch(() => {});
  }, [username]);

  const page = pages[activePage] || pages[0];

  activePageRef.current = activePage;

  const updatePage = useCallback((fn) => {
    setPages(prev => prev.map((p, i) => i === activePageRef.current ? { ...fn(p) } : p));
  }, []);  // no deps - always reads fresh via ref

  /* ── Layout ── */
  const applyLayout = useCallback((key) => {
    updatePage(p => ({ ...p, layoutKey: key, photos: {} }));
    setShowLayouts(false);
  }, [updatePage]);

  /* ── Photos ── */
  const dropIntoZone = useCallback((zi, url) => {
    updatePage(p => ({ ...p, photos: { ...p.photos, [zi]: url } }));
  }, [updatePage]);

  /* ── Text ── */
  const addText = useCallback(() => {
    const id = nextId.current++;
    const newText = {
      id,
      content: 'Your text here',
      x: 10, y: 40,
      fontSize: 24,
      color: '#111111',
      fontFamily: 'Georgia',
      bold: false,
      italic: false,
      align: 'left',
    };
    updatePage(p => ({ ...p, texts: [...(p.texts || []), newText] }));
    // Select after state updates
    setTimeout(() => setSelectedText(id), 50);
  }, [updatePage]);

  /* ── Stickers ── */
  const addSticker = useCallback((emoji, x = 20, y = 20) => {
    const id = nextId.current++;
    const newSticker = {
      id,
      content: emoji,
      x, y,
      size: 48, // default size in px
      rotation: 0,
    };
    updatePage(p => ({ ...p, stickers: [...(p.stickers || []), newSticker] }));
  }, [updatePage]);

  const updateSticker = useCallback((id, changes) => {
    updatePage(p => ({
      ...p,
      stickers: (p.stickers || []).map(s => s.id === id ? { ...s, ...changes } : s)
    }));
  }, [updatePage]);

  const deleteSticker = useCallback((id) => {
    updatePage(p => ({ ...p, stickers: (p.stickers || []).filter(s => s.id !== id) }));
  }, [updatePage]);

  const updateText = useCallback((id, changes) => {
    updatePage(p => ({
      ...p,
      texts: (p.texts || []).map(t => t.id === id ? { ...t, ...changes } : t)
    }));
  }, [updatePage]);

  const deleteText = useCallback((id) => {
    updatePage(p => ({ ...p, texts: (p.texts || []).filter(t => t.id !== id) }));
    setSelectedText(null);
  }, [updatePage]);

  /* ── Pages ── */
  const addPage = useCallback(() => {
    const newP = newPage(Date.now());
    setPages(prev => [...prev, newP]);
    setActivePage(prev => prev + 1);  // works because setPages batches with this
  }, []);

  const duplicatePage = useCallback(() => {
    const copy = { ...page, id: Date.now(), texts: (page.texts||[]).map(t => ({ ...t, id: nextId.current++ })) };
    setPages(prev => [...prev.slice(0, activePage + 1), copy, ...prev.slice(activePage + 1)]);
    setActivePage(activePage + 1);
  }, [page, activePage]);

  const deletePage = useCallback((idx) => {
    setPages(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActivePage(ap => Math.min(ap, next.length - 1));
      return next;
    });
  }, []);

  /* ── Background ── */
  const setBg = useCallback((color) => {
    updatePage(p => ({ ...p, bgColor: color }));
  }, [updatePage]);

  /* ── Export ── */
  const exportPNG = async () => {
    if (!pageRef.current) return;
    const canvas = await html2canvas(pageRef.current, {
      scale: 2, useCORS: true, allowTaint: true,
      width: PAGE_W, height: PAGE_H,
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `page${activePage + 1}.png`;
    a.click();
  };

  const exportPDF = async () => {
    const pdf = new jsPDF({ unit: 'px', format: [PAGE_W, PAGE_H] });
    for (let i = 0; i < pages.length; i++) {
      setActivePage(i);
      await new Promise(r => setTimeout(r, 400));
      if (!pageRef.current) continue;
      const canvas = await html2canvas(pageRef.current, {
        scale: 2, useCORS: true, allowTaint: true,
        width: PAGE_W, height: PAGE_H,
      });
      if (i > 0) pdf.addPage([PAGE_W, PAGE_H]);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H);
    }
    pdf.save(`photobook.pdf`);
  };

  const selText = (page.texts || []).find(t => t.id === selectedText);
  const totalPhotos = Object.values(allPhotos.clusters || {}).reduce((s, a) => s + a.length, 0)
    + (allPhotos.extras?.length || 0);

  return (
    <div style={S.root} onMouseDown={() => { /* don't deselect here */ }}>

      {/* ══════════ SIDEBAR ══════════ */}
      <div style={S.sidebar}>
        <button style={Sb('dark', { width: '100%', marginBottom: 12 })} onClick={onBackToDashboard}>← Back</button>

        {/* ── Photos ── */}
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 12 }}>
          <div style={S.sideHead}>📸 Photos ({totalPhotos})</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Drag into layout zones</div>

          {Object.keys(allPhotos.clusters || {}).map(k => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={S.clusterBadge}>{k}</div>
              <div style={S.thumbGrid}>
                {allPhotos.clusters[k].map((url, i) => (
                  <img key={i} src={url} alt="" style={S.thumb}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', url)}
                  />
                ))}
              </div>
            </div>
          ))}

          {allPhotos.extras?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.clusterBadge, background: '#64748b' }}>Extras</div>
              <div style={S.thumbGrid}>
                {allPhotos.extras.map((url, i) => (
                  <img key={i} src={url} alt="" style={S.thumb}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', url)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Text Properties Panel ── */}
        {selText ? (
          <div style={S.textPanel}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#1e293b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              ✏️ Edit Text
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8', padding: 0 }}
                onClick={() => setSelectedText(null)}>×</button>
            </div>

            {/* Content */}
            <label style={S.lbl}>Content</label>
            <textarea
              value={selText.content}
              onChange={e => updateText(selText.id, { content: e.target.value })}
              style={S.textarea}
              rows={3}
              onMouseDown={e => e.stopPropagation()}
            />

            {/* Font */}
            <label style={S.lbl}>Font Family</label>
            <select value={selText.fontFamily}
              onChange={e => updateText(selText.id, { fontFamily: e.target.value })}
              style={S.sel}
              onMouseDown={e => e.stopPropagation()}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            {/* Size + Color */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={S.lbl}>Size</label>
                <input type="number" min={8} max={150} value={selText.fontSize}
                  onChange={e => updateText(selText.id, { fontSize: Math.max(8, +e.target.value) })}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ ...S.sel, width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.lbl}>Color</label>
                <input type="color" value={selText.color}
                  onChange={e => updateText(selText.id, { color: e.target.value })}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              </div>
            </div>

            {/* Style toggles */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[
                { label: 'B', prop: 'bold',   active: selText.bold,   style: { fontWeight: 700 } },
                { label: 'I', prop: 'italic', active: selText.italic, style: { fontStyle: 'italic' } },
              ].map(({ label, prop, active, style }) => (
                <button key={prop}
                  onMouseDown={e => { e.stopPropagation(); updateText(selText.id, { [prop]: !active }); }}
                  style={{ ...Sb(active ? 'purple' : 'ghost'), flex: 1, ...style }}>
                  {label}
                </button>
              ))}

              {/* Align */}
              {['left','center','right'].map(a => (
                <button key={a}
                  onMouseDown={e => { e.stopPropagation(); updateText(selText.id, { align: a }); }}
                  style={{ ...Sb(selText.align === a ? 'purple' : 'ghost'), flex: 1, fontSize: 14 }}>
                  {a === 'left' ? '⫷' : a === 'center' ? '≡' : '⫸'}
                </button>
              ))}
            </div>

            {/* Delete */}
            <button
              onMouseDown={e => { e.stopPropagation(); deleteText(selText.id); }}
              style={Sb('danger', { width: '100%', marginTop: 10 })}>
              🗑 Delete Text
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>
            Click a text element to edit it
          </div>
        )}
      </div>

      {/* ══════════ MAIN ══════════ */}
      <div style={S.main}>

        {/* ── TOOLBAR ── */}
        <div style={S.toolbar}>
          <button style={Sb('purple')} onClick={() => setShowLayouts(true)}>📐 Layouts</button>
          <button style={Sb('green')}  onClick={addText}>✏️ Text</button>
          <button style={Sb('pink')} onClick={() => setShowStickers(true)}>🎨 Stickers</button>
          <button style={Sb(showBgPanel ? 'purple' : 'ghost')} onClick={() => setShowBgPanel(v => !v)}>
            🎨 Background
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={Sb('blue')}   onClick={exportPNG}>💾 PNG</button>
            <button style={Sb('orange')} onClick={exportPDF}>📄 PDF ({pages.length}p)</button>
          </div>
        </div>

        {/* ── BACKGROUND PANEL ── */}
        {showBgPanel && (
          <div style={S.bgPanel}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginRight: 10 }}>Page Background:</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {BG_PATTERNS.map(b => (
                <div key={b.value}
                  onClick={() => setBg(b.value)}
                  title={b.label}
                  style={{
                    width: 28, height: 28,
                    borderRadius: 6,
                    background: b.value,
                    border: page.bgColor === b.value ? '3px solid #6c5ce7' : '2px solid #e2e8f0',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }} />
              ))}
              {/* Custom color */}
              <div style={{ position: 'relative' }}>
                <input type="color" value={page.bgColor}
                  onChange={e => setBg(e.target.value)}
                  title="Custom color"
                  style={{ width: 28, height: 28, border: '2px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Custom ↑</span>
            </div>
          </div>
        )}

        {/* ── PAGE TABS ── */}
        <div style={S.pageTabs}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 8 }}>Pages:</span>

          {pages.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button
                onClick={() => setActivePage(i)}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: i === activePage ? '6px 6px 0 0' : 6,
                  background: i === activePage ? '#6c5ce7' : '#f1f5f9',
                  color: i === activePage ? 'white' : '#475569',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: i === activePage ? 700 : 500,
                  borderBottom: i === activePage ? '2px solid #6c5ce7' : 'none',
                }}>
                {i + 1}
              </button>
              {pages.length > 1 && (
                <button onClick={() => deletePage(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 14, padding: '0 3px', lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          ))}

          <button onClick={addPage}
            style={{ padding: '4px 10px', border: '2px dashed #cbd5e1', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
            + Add Page
          </button>

          <button onClick={duplicatePage}
            style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12, color: '#64748b', marginLeft: 4 }}>
            ⧉ Duplicate
          </button>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
            {pages.length} page{pages.length > 1 ? 's' : ''} in book
          </span>
        </div>

        {/* ── CANVAS ── */}
        <div ref={canvasAreaRef} style={S.canvasArea}
          onMouseDown={e => { if (e.target === e.currentTarget || e.target === canvasAreaRef.current) setSelectedText(null); }}>
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: scale < 1 ? `${PAGE_H * (scale - 1)}px` : 0,
            flexShrink: 0,
          }}>
            <div ref={pageRef} style={{ ...S.page, background: page.bgColor }}
              onMouseDown={e => { if (e.target === e.currentTarget) setSelectedText(null); }}>

              {/* ZONES */}
              {(LAYOUTS[page.layoutKey]?.zones || []).map((z, zi) => {
                const photoUrl = page.photos?.[zi];
                return (
                  <div key={zi}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const url = e.dataTransfer.getData('text/plain');
                      if (url) dropIntoZone(zi, url);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${z.x}%`, top: `${z.y}%`,
                      width: `${z.w}%`, height: `${z.h}%`,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      border: photoUrl ? 'none' : '2px dashed #d1d5db',
                      background: photoUrl ? 'transparent' : '#f9fafb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: photoUrl ? 'default' : 'copy',
                    }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#d1d5db', userSelect: 'none', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 32 }}>📷</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Photo {zi + 1}</div>
                        <div style={{ fontSize: 10 }}>drag here</div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* TEXT ELEMENTS */}
              {(page.texts || []).map(t => (
                <TextElement key={t.id} text={t}
                  isSelected={selectedText === t.id}
                  onSelect={id => { setSelectedText(id); }}
                  updateText={updateText}
                  scale={scale}
                />
              ))}

              {/* STICKER ELEMENTS */}
              {(page.stickers || []).map(s => (
                <StickerElement key={s.id} sticker={s}
                  updateSticker={updateSticker}
                  deleteSticker={deleteSticker}
                  scale={scale}
                />
              ))}

              {/* Empty state hint */}
              {page.layoutKey === 'blank' && (page.texts || []).length === 0 && (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#e2e8f0', pointerEvents:'none' }}>
                  <div style={{ fontSize: 56 }}>📖</div>
                  <div style={{ fontSize: 18, marginTop: 12, fontWeight: 600 }}>Start with a Layout</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>Click "📐 Layouts" in the toolbar</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── TIPS ── */}
        <div style={S.tips}>
          <span>💡 Pick layout → drag photos into zones</span>
          <span>✏️ Click "Text" → click text on page to select</span>
          <span>🖱 Drag text to reposition</span>
          <span>📄 PDF exports ALL {pages.length} page{pages.length>1?'s':''}</span>
        </div>
      </div>

      {/* ══════════ LAYOUT PICKER MODAL ══════════ */}
      {showLayouts && (
        <div style={S.overlay} onClick={() => setShowLayouts(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'Georgia', color: '#1e293b' }}>Choose Layout</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13 }}>Page {activePage + 1}</p>

            <div style={S.layoutGrid}>
              {Object.entries(LAYOUTS).map(([key, l]) => (
                <div key={key} onClick={() => applyLayout(key)}
                  style={{
                    ...S.layoutCard,
                    border: page.layoutKey === key ? '3px solid #6c5ce7' : '2px solid #e5e7eb',
                    background: page.layoutKey === key ? '#f5f3ff' : 'white',
                  }}>
                  {/* Mini visual preview */}
                  <div style={{ width: 68, height: 85, background: '#f1f5f9', borderRadius: 4, margin: '0 auto 8px', position: 'relative', overflow: 'hidden' }}>
                    {l.zones.map((z, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: `${z.x}%`, top: `${z.y}%`,
                        width: `${z.w}%`, height: `${z.h}%`,
                        background: `hsl(${220 + i * 40}, 60%, ${75 - i * 5}%)`,
                        borderRadius: 2,
                      }} />
                    ))}
                    {l.zones.length === 0 && (
                      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#cbd5e1', fontSize: 24 }}>✦</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{l.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{l.zones.length} photo{l.zones.length !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowLayouts(false)}
              style={Sb('purple', { width: '100%', padding: 12, marginTop: 4, fontSize: 14 })}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ══════════ STICKER PICKER MODAL ══════════ */}
      {showStickers && (
        <div style={S.overlay} onClick={() => setShowStickers(false)}>
          <div style={{ ...S.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'Georgia', color: '#1e293b' }}>Add Stickers & Emojis</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13 }}>Click any sticker to add it to your page</p>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
              {Object.entries(STICKER_CATEGORIES).map(([key, cat]) => (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, position: 'sticky', top: 0, background: 'white', padding: '4px 0', zIndex: 1 }}>
                    {cat.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 8 }}>
                    {cat.items.map((item, i) => (
                      <div key={i}
                        onClick={() => {
                          addSticker(item, 20 + Math.random() * 30, 20 + Math.random() * 30);
                          setShowStickers(false);
                        }}
                        style={{
                          width: 56,
                          height: 56,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 32,
                          background: '#f8fafc',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: '2px solid #e2e8f0',
                          transition: 'all 0.15s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.borderColor = '#6c5ce7';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}>
                        {item.startsWith('http') ? (
                          <img src={item} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        ) : item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowStickers(false)}
              style={Sb('purple', { width: '100%', padding: 12, marginTop: 16, fontSize: 14 })}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DRAGGABLE TEXT ELEMENT
   KEY FIX: Calculate total displacement from start position, not incremental
══════════════════════════════════════════════════════════════════════════════ */
function TextElement({ text, isSelected, onSelect, updateText, scale }) {
  const startRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e) => {
    e.stopPropagation();
    onSelect(text.id);
    
    // Store the initial mouse position AND initial text position
    startRef.current = { 
      mouseX: e.clientX, 
      mouseY: e.clientY,
      textX: text.x,
      textY: text.y
    };
    setIsDragging(true);

    const move = (me) => {
      if (!startRef.current) return;
      
      // Calculate total mouse displacement from start
      const totalDx = (me.clientX - startRef.current.mouseX) / scale;
      const totalDy = (me.clientY - startRef.current.mouseY) / scale;
      
      // Apply displacement to the ORIGINAL position (not current position)
      const newX = startRef.current.textX + (totalDx / PAGE_W) * 100;
      const newY = startRef.current.textY + (totalDy / PAGE_H) * 100;
      
      // Clamp to page bounds
      const clampedX = Math.max(0, Math.min(85, newX));
      const clampedY = Math.max(0, Math.min(92, newY));
      
      updateText(text.id, { x: clampedX, y: clampedY });
    };
    
    const up = () => {
      setIsDragging(false);
      startRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: `${text.x}%`,
        top: `${text.y}%`,
        fontSize: text.fontSize,
        color: text.color,
        fontFamily: text.fontFamily,
        fontWeight: text.bold ? 700 : 400,
        fontStyle: text.italic ? 'italic' : 'normal',
        textAlign: text.align || 'left',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        outline: isSelected ? '2px solid #6c5ce7' : '2px solid transparent',
        outlineOffset: 3,
        borderRadius: 3,
        padding: '2px 6px',
        whiteSpace: 'pre-wrap',
        maxWidth: '80%',
        lineHeight: 1.35,
        zIndex: isSelected ? 100 : 10,
        minWidth: 40,
        boxShadow: isSelected ? '0 0 0 4px rgba(108,92,231,0.15)' : 'none',
      }}>
      {text.content}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DRAGGABLE STICKER ELEMENT
══════════════════════════════════════════════════════════════════════════════ */
function StickerElement({ sticker, updateSticker, deleteSticker, scale }) {
  const startRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const onMouseDown = (e) => {
    e.stopPropagation();
    
    // Store the initial mouse position AND initial sticker position
    startRef.current = { 
      mouseX: e.clientX, 
      mouseY: e.clientY,
      stickerX: sticker.x,
      stickerY: sticker.y
    };
    setIsDragging(true);

    const move = (me) => {
      if (!startRef.current) return;
      
      // Calculate total mouse displacement from start
      const totalDx = (me.clientX - startRef.current.mouseX) / scale;
      const totalDy = (me.clientY - startRef.current.mouseY) / scale;
      
      // Apply displacement to the ORIGINAL position
      const newX = startRef.current.stickerX + (totalDx / PAGE_W) * 100;
      const newY = startRef.current.stickerY + (totalDy / PAGE_H) * 100;
      
      // Clamp to page bounds
      const clampedX = Math.max(0, Math.min(90, newX));
      const clampedY = Math.max(0, Math.min(90, newY));
      
      updateSticker(sticker.id, { x: clampedX, y: clampedY });
    };
    
    const up = () => {
      setIsDragging(false);
      startRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: 50,
        transform: `rotate(${sticker.rotation || 0}deg)`,
        transition: isDragging ? 'none' : 'transform 0.15s',
      }}>
      {/* Sticker content */}
      {sticker.content.startsWith('http') ? (
        <img 
          src={sticker.content} 
          alt="" 
          style={{ 
            width: sticker.size, 
            height: sticker.size, 
            objectFit: 'contain',
            pointerEvents: 'none',
            filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
          }} 
        />
      ) : (
        <div style={{ 
          fontSize: sticker.size, 
          lineHeight: 1,
          filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
        }}>
          {sticker.content}
        </div>
      )}
      
      {/* Control buttons on hover */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: -28,
          right: -8,
          display: 'flex',
          gap: 4,
          background: 'rgba(255,255,255,0.95)',
          padding: '4px 6px',
          borderRadius: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
        }}>
          {/* Resize buttons */}
          <button
            onMouseDown={e => { e.stopPropagation(); updateSticker(sticker.id, { size: Math.max(24, sticker.size - 8) }); }}
            style={miniBtn}>
            −
          </button>
          <button
            onMouseDown={e => { e.stopPropagation(); updateSticker(sticker.id, { size: Math.min(120, sticker.size + 8) }); }}
            style={miniBtn}>
            +
          </button>
          {/* Rotate button */}
          <button
            onMouseDown={e => { e.stopPropagation(); updateSticker(sticker.id, { rotation: (sticker.rotation + 15) % 360 }); }}
            style={miniBtn}>
            ↻
          </button>
          {/* Delete button */}
          <button
            onMouseDown={e => { e.stopPropagation(); deleteSticker(sticker.id); }}
            style={{ ...miniBtn, color: '#dc2626' }}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

const miniBtn = {
  all: 'unset',
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  color: '#475569',
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  transition: 'all 0.15s',
};

/* ══════════════════════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════════════════════ */
// Button factory
const Sb = (variant, extra = {}) => {
  const base = { all:'unset', boxSizing:'border-box', display:'inline-flex', alignItems:'center', justifyContent:'center', padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'opacity 0.15s', textTransform:'none', letterSpacing:'normal', whiteSpace:'nowrap' };
  const variants = {
    purple:  { background: '#6c5ce7', color: 'white' },
    green:   { background: '#10b981', color: 'white' },
    blue:    { background: '#3b82f6', color: 'white' },
    orange:  { background: '#f59e0b', color: 'white' },
    pink:    { background: '#ec4899', color: 'white' },
    dark:    { background: '#334155', color: 'white' },
    danger:  { background: '#fee2e2', color: '#dc2626' },
    ghost:   { background: '#f1f5f9', color: '#475569' },
  };
  return { ...base, ...(variants[variant] || {}), ...extra };
};

const S = {
  root: { position:'fixed', inset:0, display:'flex', fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#f1f5f9', zIndex:9999, fontSize:14 },
  sidebar: { width:248, flexShrink:0, background:'white', borderRight:'1px solid #e2e8f0', overflowY:'auto', padding:14, display:'flex', flexDirection:'column' },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 },
  toolbar: { background:'white', borderBottom:'1px solid #e2e8f0', padding:'10px 18px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 },
  bgPanel: { background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'8px 18px', display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, flexShrink:0 },
  pageTabs: { background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'6px 18px', display:'flex', gap:4, alignItems:'center', flexShrink:0, flexWrap:'wrap' },
  canvasArea: { flex:1, display:'flex', justifyContent:'center', alignItems:'flex-start', padding:'28px 20px', overflowY:'auto', background:'#e2e8f0' },
  page: { width:PAGE_W, height:PAGE_H, position:'relative', boxShadow:'0 4px 32px rgba(0,0,0,0.22)', overflow:'hidden', flexShrink:0 },
  tips: { background:'#fffbeb', borderTop:'1px solid #fde68a', padding:'7px 18px', display:'flex', gap:20, fontSize:11, color:'#92400e', flexShrink:0, flexWrap:'wrap' },
  // Sidebar
  sideHead: { fontWeight:700, fontSize:13, color:'#1e293b', marginBottom:2 },
  clusterBadge: { background:'#6c5ce7', color:'white', padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:700, marginBottom:6, display:'inline-block' },
  thumbGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 },
  thumb: { width:'100%', height:76, objectFit:'cover', borderRadius:5, cursor:'grab', border:'2px solid transparent', transition:'all 0.15s', display:'block' },
  textPanel: { background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:12, marginTop:4 },
  lbl: { fontSize:11, color:'#64748b', display:'block', marginTop:8, marginBottom:3 },
  textarea: { width:'100%', resize:'vertical', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 8px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' },
  sel: { width:'100%', padding:'5px 8px', border:'1px solid #e2e8f0 !important', borderRadius:6, fontSize:13, background:'white !important', cursor:'pointer', marginBottom:'0 !important', textAlign:'left !important', outline:'none', color:'#333' },
  // Modal
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 },
  modal: { background:'white', borderRadius:16, padding:28, maxWidth:760, width:'92%', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  layoutGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:12, marginBottom:8 },
  layoutCard: { padding:'12px 8px', borderRadius:10, cursor:'pointer', textAlign:'center', transition:'all 0.15s' },
};