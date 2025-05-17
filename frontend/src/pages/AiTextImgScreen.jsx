// frontend/src/pages/AiTextImgScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentItem } from '../contexts/CurrentItemContext';
import apiService from '../services/apiService'; // This now calls your backend proxy
// import CartIndicator from '../components/common/CartIndicator';

const AiTextImgScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentItem, setCustomization, DEFAULT_CUSTOMIZATION_POSITION } = useCurrentItem();

  const queryParams = new URLSearchParams(location.search);
  const view = queryParams.get('view') || 'front';

  const [promptInput, setPromptInput] = useState('');
  // displayedImageUrl will now be a server path like /api/images/view/xyz.png
  const [displayedImageUrl, setDisplayedImageUrl] = useState(null); 
  // Store the imageId from the backend for potential re-use or for BG removal reference
  const [currentImageId, setCurrentImageId] = useState(null); 
  const [currentFilename, setCurrentFilename] = useState(null);
  // We might still need a temporary blob if we fetch the image for client-side processing (less ideal with this backend flow)
  // For now, let's assume remove BG will work with base64 of the displayed server image.
  const [isLoading, setIsLoading] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [status, setStatusState] = useState({ message: 'Describe the image you want to create...', type: 'info' });
  
  const [imageGeneratedThisInteraction, setImageGeneratedThisInteraction] = useState(false);
  const [backgroundRemovedThisInteraction, setBackgroundRemovedThisInteraction] = useState(false);

  const [imageStyle, setImageStyle] = useState({});
  const initialImageStyle = { opacity: 0, transform: 'scale(0.95)', transition: 'opacity 0.5s ease, transform 0.5s ease' };
  const loadedImageStyle = { opacity: 1, transform: 'scale(1)' };

  // Since image URLs are now server paths, direct client-side blob revocation isn't the primary concern here.
  // The backend would manage temporary image files if any.

  const resetForNewGeneration = useCallback((statusMsg = 'Describe the image you want to create...', statusType = 'info') => {
    setDisplayedImageUrl(null);
    setCurrentImageId(null);
    setCurrentFilename(null);
    setImageGeneratedThisInteraction(false);
    setBackgroundRemovedThisInteraction(false);
    setStatusState({ message: statusMsg, type: statusType });
    setImageStyle(initialImageStyle);
  }, []);

  useEffect(() => {
    if (!currentItem || !currentItem.id) {
        console.error("AiTextImgScreen: currentItem is not available.");
        navigate('/size-selection');
        return;
    }
     if (!currentItem.size || !currentItem.thicknessName) {
        alert("Critical Error: T-shirt size or thickness not selected. Redirecting.");
        navigate('/size-selection');
        return;
    }

    const activeSideCustomization = view === 'front' ? currentItem.frontCustomization : currentItem.backCustomization;

    if (activeSideCustomization && activeSideCustomization.type === 'ai_text_image') {
      setPromptInput(activeSideCustomization.prompt || '');
      setDisplayedImageUrl(activeSideCustomization.src || null); // src should be server URL now
      setCurrentImageId(activeSideCustomization.imageId || null); // Store imageId
      setCurrentFilename(activeSideCustomization.filename || null);
      
      setImageGeneratedThisInteraction(!!activeSideCustomization.src);
      setBackgroundRemovedThisInteraction(activeSideCustomization.removedBackground || false);
      setStatusState({ message: 'Loaded existing design.', type: 'info' });
      if (activeSideCustomization.src) setImageStyle(loadedImageStyle);
    } else {
      setPromptInput('');
      resetForNewGeneration();
    }
  }, [currentItem, view, navigate, resetForNewGeneration]);


  const handleGenerateImage = async () => {
    if (!promptInput.trim()) {
      setStatusState({ message: 'Please enter a prompt text.', type: 'error' });
      return;
    }
    setIsLoading(true);
    resetForNewGeneration('Generating your creative image via backend...', 'info');

    try {
      // Assuming sessionId and kioskId might be part of currentItem or another context
      // For now, let's pass placeholders or derive them if available
      const sessionId = currentItem?.sessionId || "session_placeholder"; 
      const kioskId = currentItem?.kioskId || "kiosk_placeholder";

      const response = await apiService.generateAiTextToImage({ prompt: promptInput, sessionId, kioskId });
      
      if (response.success && response.imageUrl) {
        setDisplayedImageUrl(response.imageUrl); // This is the server URL (e.g., /api/images/view/...)
        setCurrentImageId(response.imageId);
        setCurrentFilename(response.filename);
        setImageGeneratedThisInteraction(true);
        setStatusState({ message: 'Image generated and stored on server!', type: 'success' });
      } else {
        setStatusState({ message: response.message || 'Failed to generate image via backend.', type: 'error' });
      }
    } catch (error) {
      console.error("Error generating image via backend:", error);
      setStatusState({ message: error.message || 'An unexpected error occurred with backend.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!displayedImageUrl) {
      setStatusState({ message: 'No image to process. Generate an image first.', type: 'error' });
      return;
    }

    setIsRemovingBg(true);
    setStatusState({ message: 'Requesting background removal via backend...', type: 'info' });
    setImageStyle(initialImageStyle);

    try {
        // To get base64 of the image currently displayed (which is from server)
        const imageResponse = await fetch(displayedImageUrl);
        if (!imageResponse.ok) throw new Error("Could not fetch current image for BG removal.");
        const imageBlob = await imageResponse.blob();
        
        const reader = new FileReader();
        reader.readAsDataURL(imageBlob);
        reader.onloadend = async () => {
            const base64data = reader.result;
            const sessionId = currentItem?.sessionId || "session_placeholder";
            const kioskId = currentItem?.kioskId || "kiosk_placeholder";

            const response = await apiService.removeBackgroundImage({ imageBase64: base64data, sessionId, kioskId });

            if (response.success && response.imageUrl) {
                setDisplayedImageUrl(response.imageUrl); // New server URL for BG-removed image
                setCurrentImageId(response.imageId);
                setCurrentFilename(response.filename);
                setBackgroundRemovedThisInteraction(true);
                setStatusState({ message: 'Background removed and new image stored on server!', type: 'success' });
            } else {
                setStatusState({ message: response.message || 'Failed to remove background via backend.', type: 'error' });
                setImageStyle(loadedImageStyle); // Re-show old image if fail
            }
            setIsRemovingBg(false);
        };
        reader.onerror = (error) => {
            console.error("FileReader error for BG removal input:", error);
            setIsRemovingBg(false);
            setStatusState({ message: 'Error preparing image for background removal request.', type: 'error'});
            setImageStyle(loadedImageStyle);
        };
    } catch (error) {
      console.error("Error removing background via backend:", error);
      setStatusState({ message: error.message || 'An unexpected error occurred with backend BG removal.', type: 'error' });
      setIsRemovingBg(false);
      setImageStyle(loadedImageStyle);
    }
  };

  const handleConfirmImage = () => {
    if (!displayedImageUrl || !imageGeneratedThisInteraction || !currentImageId) {
      setStatusState({ message: 'No valid server image to confirm.', type: 'error' });
      return;
    }
    const customizationDetails = {
      type: 'ai_text_image',
      src: displayedImageUrl,         // Server URL (e.g., /api/images/view/xyz.png)
      imageId: currentImageId,        // ID from your backend DB
      filename: currentFilename,      // Filename from backend
      // _blobDataForUpload is NO LONGER NEEDED here if src is a server URL managed by backend.
      // If cart needs a displayable blob for some reason, OrderPreviewScreen might fetch it.
      prompt: promptInput,
      removedBackground: backgroundRemovedThisInteraction,
      position: { ...DEFAULT_CUSTOMIZATION_POSITION }
    };
    setCustomization(view, customizationDetails);
    console.log(`AI_SCREEN: Confirmed server image for ${view}. ImageID: ${currentImageId}`);
    navigate('/order-preview');
  };

  const handleBackNavigation = () => {
    // With server-side images, client doesn't manage their lifecycle beyond context.
    // Backend would have a cleanup mechanism for unconfirmed/temporary images.
    navigate('/feature-display');
  };

  // --- Styles (same as your previous AiTextImgScreen.jsx) ---
  const styles = { /* ... PASTE YOUR STYLES OBJECT HERE ... */ 
    pageContainer: { width: '2240px', height: '1400px', position: 'relative', background: 'white', overflow: 'hidden', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '80px' },
    title: { color: '#00566F', fontSize: '80px', fontFamily: "'SS Magnetic', sans-serif", fontWeight: 400, marginBottom: '40px', textAlign: 'center'},
    backArrow: { width: '100px', height: '100px', position: 'absolute', left: '100px', top: '80px', cursor: 'pointer' },
    inputRow: { display: 'flex', gap: '20px', marginBottom: '40px', width: '1600px', alignItems: 'center' },
    promptInput: { flexGrow: 1, height: '120px', fontSize: '36px', padding: '0 30px', borderRadius: '12px', border: '2px solid #00566F', backgroundColor: '#F4FAFF' },
    button: { height: '120px', padding: '0 40px', borderRadius: '12px', color: 'white', fontSize: '36px', fontFamily: 'Inter', fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: 'background-color 0.3s, opacity 0.3s' },
    imageArea: { width: '700px', height: '500px', background: '#e9ecef', border: `2px dashed #00566F`, borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', marginBottom: '30px' },
    statusMessage: { minHeight: '40px', fontWeight: 600, fontSize: '28px', padding: '10px 25px', borderRadius: '8px', color: '#fff', textAlign: 'center', marginBottom: '30px', width: 'fit-content', alignSelf: 'center' },
    actionsRow: { display: 'flex', gap: '30px', justifyContent: 'center', width: '100%' },
    spinner: { width: '60px', height: '60px', border: '6px solid rgba(0,0,0,0.1)', borderLeftColor: '#00566F', borderRadius: '50%', animation: 'spin 1s linear infinite', position: 'absolute' },
  };
  const generateButtonStyle = { ...styles.button, backgroundColor: '#00566F', minWidth: '300px' };
  const removeBgButtonStyle = { ...styles.button, backgroundColor: '#E67E22', minWidth: '300px' };
  const confirmButtonStyle = { ...styles.button, backgroundColor: '#27AE60', minWidth: '250px' };
  const disabledStyle = { opacity: 0.6, cursor: 'not-allowed' };
  const getStatusBackgroundColor = () => { /* ... */ if (status.type === 'error') return '#E74C3C'; if (status.type === 'success') return '#2ECC71'; if (isLoading || isRemovingBg) return 'rgba(0,86,111,0.1)'; return 'rgba(0,0,0,0.05)'; };
  const getStatusColor = () => { /* ... */ if (isLoading || isRemovingBg || status.type === 'info') return '#00566F'; return '#fff'; };


  return (
    <div style={styles.pageContainer}>
      <img style={styles.backArrow} src="/Features_Display_Img/back arrow.png" alt="Back" onClick={handleBackNavigation} />
      <div style={styles.title}>AI Text to Image ({view === 'front' ? 'Front' : 'Back'})</div>

      <div style={styles.inputRow}>
        <input type="text" style={styles.promptInput} placeholder="Describe the image (e.g., 'astronaut riding a unicorn')" value={promptInput} onChange={(e) => setPromptInput(e.target.value)} disabled={isLoading || isRemovingBg}/>
        <button style={{ ...generateButtonStyle, ...(isLoading || isRemovingBg || !promptInput.trim() ? disabledStyle : {}) }} onClick={handleGenerateImage} disabled={isLoading || isRemovingBg || !promptInput.trim()} >
          {isLoading ? 'Generating...' : 'Generate ✨'}
        </button>
      </div>

      {status.message && ( <div style={{...styles.statusMessage, backgroundColor: getStatusBackgroundColor(), color: getStatusColor()}}> {status.message} </div> )}

      <div style={styles.imageArea}>
        {(isLoading || isRemovingBg) && <div style={styles.spinner} />}
        {displayedImageUrl && !(isLoading || isRemovingBg) && (
          <img src={displayedImageUrl} alt={promptInput || 'AI Generated Image'} style={{...initialImageStyle, ...imageStyle, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} onLoad={() => setImageStyle(loadedImageStyle)} onError={() => { setStatusState({message: "Error displaying server image.", type: 'error'}); setDisplayedImageUrl(null);}} />
        )}
        {!displayedImageUrl && !(isLoading || isRemovingBg) && (<p style={{color: '#6c757d', fontSize:'20px', textAlign:'center'}}>Image will appear here</p>)}
      </div>

      <div style={styles.actionsRow}>
        <button style={{ ...removeBgButtonStyle, ...(!imageGeneratedThisInteraction || isLoading || isRemovingBg ? disabledStyle : {}) }} onClick={handleRemoveBackground} disabled={!imageGeneratedThisInteraction || isLoading || isRemovingBg} >
          {isRemovingBg ? 'Processing...' : 'Remove BG ✂️'}
        </button>
        <button style={{ ...confirmButtonStyle, ...(!imageGeneratedThisInteraction || isLoading || isRemovingBg ? disabledStyle : {}) }} onClick={handleConfirmImage} disabled={!imageGeneratedThisInteraction || isLoading || isRemovingBg} >
          Confirm 👍
        </button>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AiTextImgScreen;