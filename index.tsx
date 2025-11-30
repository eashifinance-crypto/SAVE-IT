import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// Eras configuration
const ERAS = [
  {
    id: 'egypt',
    label: 'Ancient Egypt',
    prompt: 'Ancient Egypt, wearing a nemes headdress and golden jewelry, standing before the Pyramids of Giza. Golden hour lighting, historical cinematic style.',
    icon: '🏺'
  },
  {
    id: 'viking',
    label: 'Viking Age',
    prompt: 'The Viking Age, wearing fur and leather armor, holding a shield, standing on the deck of a longship in a fjord. Misty atmosphere, dramatic lighting.',
    icon: '⚔️'
  },
  {
    id: 'medieval',
    label: 'Medieval Knight',
    prompt: 'Medieval Europe, wearing shining plate armor (helmet off), standing in a castle courtyard. Epic fantasy style, detailed background.',
    icon: '🏰'
  },
  {
    id: 'victorian',
    label: 'Victorian London',
    prompt: 'Victorian London 1890s, wearing a formal suit/gown and top hat/bonnet, standing on a cobblestone street with gas lamps. Steampunk vibes, sepia tone.',
    icon: '🎩'
  },
  {
    id: 'western',
    label: 'Wild West',
    prompt: 'The American Wild West 1880, wearing a cowboy hat, leather vest, and bandana, standing in front of a saloon. Dusty, western movie style.',
    icon: '🤠'
  },
  {
    id: 'noir',
    label: '1940s Noir',
    prompt: '1940s Film Noir, wearing a trench coat and fedora, rainy city street at night. High contrast black and white photography, mysterious atmosphere.',
    icon: '🕵️'
  },
  {
    id: 'disco',
    label: '1970s Disco',
    prompt: '1970s Disco era, wearing colorful funky clothes and bell-bottoms, on a dance floor with a disco ball. Neon lights, vibrant colors, retro style.',
    icon: '🕺'
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk 2077',
    prompt: 'The year 2077, wearing futuristic tech-wear with glowing neon accents, in a futuristic cyberpunk city. Neon blue and pink lighting, sci-fi aesthetic.',
    icon: '🤖'
  }
];

const VISUAL_FILTERS = [
  { id: 'none', label: 'Normal', css: 'none' },
  { id: 'grayscale', label: 'B&W', css: 'grayscale(100%)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(100%)' },
  { id: 'contrast', label: 'Contrast', css: 'contrast(150%)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(50%) contrast(120%) brightness(90%)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(180deg) saturate(80%)' },
];

interface GalleryItem {
  id: string;
  imageUrl: string;
  caption: string;
  eraId: string;
  timestamp: number;
}

const App = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Gallery State - Lazy initialization from localStorage
  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem('timeTravelGallery');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse gallery from storage", e);
      return [];
    }
  });
  
  const [view, setView] = useState<'booth' | 'gallery'>('booth');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveCaption, setSaveCaption] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  useEffect(() => {
    if (view === 'booth') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [view]);

  // Automatically save gallery to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timeTravelGallery', JSON.stringify(gallery));
    } catch (e) {
      console.error("Failed to save gallery to storage", e);
      setError("Warning: Storage is full. Your gallery might not be saved persistently.");
    }
  }, [gallery]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1024 }, height: { ideal: 1024 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Square aspect ratio capture
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;
        
        // Calculate crop to center
        const xOffset = (video.videoWidth - size) / 2;
        const yOffset = (video.videoHeight - size) / 2;

        // Apply the selected filter to the context before drawing
        const filterCss = VISUAL_FILTERS.find(f => f.id === activeFilter)?.css || 'none';
        context.filter = filterCss;

        context.drawImage(video, xOffset, yOffset, size, size, 0, 0, size, size);
        
        // Reset filter just in case
        context.filter = 'none';

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setGeneratedImage(null);
    setSelectedEra(null);
    setError(null);
    setShowSaveForm(false);
    setSaveCaption('');
    // Ensure video stream is still active or restart it
    if (!stream || !stream.active) {
      startCamera();
    }
  };

  const handleTimeTravel = async () => {
    if (!capturedImage || !selectedEra) return;

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setShowSaveForm(false);

    try {
      const eraConfig = ERAS.find(e => e.id === selectedEra);
      if (!eraConfig) throw new Error("Era not found");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Remove data:image/jpeg;base64, prefix
      const base64Image = capturedImage.split(',')[1];

      const prompt = `Generate a photorealistic portrait of this person in ${eraConfig.prompt}. Maintain the person's facial features and identity from the original image, but completely change the clothing, background, and lighting to match the ${eraConfig.label} style. High quality, detailed.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            },
            {
              text: prompt
            }
          ]
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imgUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            setGeneratedImage(imgUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("No image generated by the model.");
      }

    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Something went wrong during time travel.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToGallery = () => {
    if (!generatedImage || !selectedEra) return;
    
    const newItem: GalleryItem = {
      id: Date.now().toString(),
      imageUrl: generatedImage,
      caption: saveCaption || ERAS.find(e => e.id === selectedEra)?.label || 'Time Travel',
      eraId: selectedEra,
      timestamp: Date.now()
    };
    
    // Simply update state; useEffect handles localStorage
    setGallery(prev => [newItem, ...prev]);
    
    // Reset form and show success
    setShowSaveForm(false);
    setSaveCaption('');
    alert("Photo saved to your collection!");
  };

  const handleDeleteFromGallery = (id: string) => {
    // Simply update state; useEffect handles localStorage
    setGallery(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>⌛ Time-Travel Photo Booth</h1>
        <div style={styles.navButtons}>
          <button 
            onClick={() => setView('booth')} 
            style={{...styles.navBtn, background: view === 'booth' ? 'var(--accent-color)' : 'transparent'}}
          >
            Photo Booth
          </button>
          <button 
            onClick={() => setView('gallery')} 
            style={{...styles.navBtn, background: view === 'gallery' ? 'var(--accent-color)' : 'transparent'}}
          >
            My Collection ({gallery.length})
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {view === 'gallery' ? (
          <div style={styles.galleryContainer}>
            {gallery.length === 0 ? (
              <div style={styles.emptyGallery}>
                <p>No time travel photos yet. Go back to the booth to take some!</p>
                <button onClick={() => setView('booth')} style={styles.travelBtn}>Go to Booth</button>
              </div>
            ) : (
              <div style={styles.galleryGrid}>
                {gallery.map(item => (
                  <div key={item.id} style={styles.galleryCard}>
                    <img src={item.imageUrl} alt={item.caption} style={styles.cardImage} />
                    <div style={styles.cardContent}>
                      <div style={styles.cardHeader}>
                        <span style={styles.cardEra}>
                          {ERAS.find(e => e.id === item.eraId)?.icon} {ERAS.find(e => e.id === item.eraId)?.label}
                        </span>
                        <span style={styles.cardDate}>{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p style={styles.cardCaption}>{item.caption}</p>
                      <div style={styles.cardActions}>
                        <a href={item.imageUrl} download={`time-travel-${item.id}.png`} style={styles.cardBtn}>⬇️</a>
                        <button onClick={() => handleDeleteFromGallery(item.id)} style={{...styles.cardBtn, color: '#ef4444'}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Photo Booth View */
          <>
            {/* Step 1: Camera / Captured Image */}
            <div style={styles.section}>
              <div style={styles.cameraContainer}>
                {!capturedImage ? (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{
                        ...styles.video,
                        filter: VISUAL_FILTERS.find(f => f.id === activeFilter)?.css || 'none'
                      }} 
                    />
                    <button onClick={takePhoto} style={styles.captureBtn}>
                      📸 Capture
                    </button>
                  </>
                ) : (
                  <div style={styles.previewContainer}>
                    <img src={capturedImage} alt="Selfie" style={styles.previewImage} />
                    {!generatedImage && (
                        <button onClick={retakePhoto} style={styles.retakeBtn}>
                        🔄 Retake
                        </button>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {/* Filter Selection - Only show when camera is active */}
              {!capturedImage && (
                <div style={styles.filterScrollContainer}>
                  {VISUAL_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      style={{
                        ...styles.filterBtn,
                        backgroundColor: activeFilter === filter.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                        borderColor: activeFilter === filter.id ? 'white' : 'transparent',
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Era Selection */}
            {capturedImage && !generatedImage && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Select Destination</h2>
                <div style={styles.grid}>
                  {ERAS.map(era => (
                    <button
                      key={era.id}
                      onClick={() => setSelectedEra(era.id)}
                      style={{
                        ...styles.eraBtn,
                        background: selectedEra === era.id ? 'var(--accent-color)' : 'var(--card-bg)',
                        borderColor: selectedEra === era.id ? '#fff' : 'transparent'
                      }}
                    >
                      <span style={styles.eraIcon}>{era.icon}</span>
                      <span style={styles.eraLabel}>{era.label}</span>
                    </button>
                  ))}
                </div>

                <div style={styles.actionContainer}>
                  <button 
                    onClick={handleTimeTravel} 
                    disabled={!selectedEra || loading}
                    style={{
                      ...styles.travelBtn,
                      opacity: (!selectedEra || loading) ? 0.5 : 1,
                      cursor: (!selectedEra || loading) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Traveling...' : '🚀 Travel Through Time'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Result */}
            {loading && (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Warping spacetime... This may take a few seconds.</p>
              </div>
            )}

            {generatedImage && (
              <div style={styles.resultSection}>
                <h2 style={styles.sectionTitle}>Arrival Complete</h2>
                <div style={styles.resultContainer}>
                  <img src={generatedImage} alt="Generated Time Travel" style={styles.resultImage} />
                </div>
                
                <div style={styles.saveSection}>
                    {!showSaveForm ? (
                        <div style={styles.actionContainer}>
                            <button onClick={() => setShowSaveForm(true)} style={styles.saveToGalleryBtn}>
                                💾 Save to Collection
                            </button>
                            <a href={generatedImage} download="time-travel-photo.png" style={styles.downloadBtn}>
                                ⬇️ Download
                            </a>
                        </div>
                    ) : (
                        <div style={styles.saveForm}>
                            <input 
                                type="text" 
                                placeholder="Add a caption (e.g., Me as a Pharaoh)..." 
                                value={saveCaption}
                                onChange={(e) => setSaveCaption(e.target.value)}
                                style={styles.captionInput}
                                autoFocus
                            />
                            <div style={styles.saveFormActions}>
                                <button onClick={handleSaveToGallery} style={styles.confirmSaveBtn}>Save</button>
                                <button onClick={() => setShowSaveForm(false)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {!showSaveForm && (
                    <button onClick={retakePhoto} style={styles.retakeBtn}>
                    ✨ Travel Again
                    </button>
                )}
              </div>
            )}

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '10px',
    width: '100%',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '2.5rem',
    background: 'linear-gradient(45deg, #8b5cf6, #3b82f6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
  },
  navBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  main: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    animation: 'fadeIn 0.5s ease-out',
  },
  cameraContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    aspectRatio: '1/1',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    backgroundColor: '#000',
    border: '2px solid var(--card-bg)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'filter 0.3s ease',
  },
  captureBtn: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    color: 'black',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '1rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  retakeBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    margin: '10px',
    cursor: 'pointer',
  },
  filterScrollContainer: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    maxWidth: '100%',
    padding: '10px 5px',
    scrollbarWidth: 'none',
  },
  filterBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    border: '1px solid transparent',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '1.2rem',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
    width: '100%',
  },
  eraBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    borderRadius: '16px',
    border: '2px solid transparent',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 600,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  eraIcon: {
    fontSize: '2rem',
  },
  eraLabel: {
    textAlign: 'center',
  },
  actionContainer: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  travelBtn: {
    background: 'linear-gradient(45deg, #8b5cf6, #3b82f6)',
    color: 'white',
    padding: '16px 32px',
    borderRadius: '30px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
    width: '100%',
    maxWidth: '300px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    color: 'var(--accent-color)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(139, 92, 246, 0.3)',
    borderTop: '4px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '15px',
  },
  resultSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  resultContainer: {
    width: '100%',
    maxWidth: '512px',
    aspectRatio: '1/1',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)',
    border: '2px solid var(--accent-color)',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  saveSection: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
  },
  saveToGalleryBtn: {
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '10px',
    fontWeight: 'bold',
    fontSize: '1rem',
    border: 'none',
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '1rem',
  },
  saveForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '300px',
    backgroundColor: 'var(--card-bg)',
    padding: '15px',
    borderRadius: '12px',
    marginTop: '10px',
  },
  captionInput: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: '#0f172a',
    color: 'white',
    fontSize: '1rem',
  },
  saveFormActions: {
    display: 'flex',
    gap: '10px',
  },
  confirmSaveBtn: {
    flex: 1,
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    padding: '8px',
    borderRadius: '6px',
    fontWeight: 'bold',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    color: 'var(--secondary-text)',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #475569',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    maxWidth: '100%',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  galleryContainer: {
    width: '100%',
    minHeight: '400px',
  },
  emptyGallery: {
    textAlign: 'center',
    color: 'var(--secondary-text)',
    marginTop: '50px',
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
    width: '100%',
  },
  galleryCard: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  cardImage: {
    width: '100%',
    aspectRatio: '1/1',
    objectFit: 'cover',
  },
  cardContent: {
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
    color: 'var(--secondary-text)',
  },
  cardEra: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardDate: {
    fontSize: '0.7rem',
  },
  cardCaption: {
    margin: '5px 0',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  },
  cardBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    textDecoration: 'none',
    fontSize: '0.9rem',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'center',
  },
};

// Add keyframes for spinner
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);