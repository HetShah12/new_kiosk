// frontend/src/pages/UploadImageScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import io from 'socket.io-client';
import { useCurrentItem } from '../contexts/CurrentItemContext';
import CartIndicator from '../components/common/CartIndicator'; // Ensure path is correct

const UI_OUTER_PRINTABLE_PIXEL_WIDTH = 300;
const UI_OUTER_PRINTABLE_PIXEL_HEIGHT = 488;
const DYNAMIC_MIN_CANVA_WIDTH_UPLOAD = 50;
const DYNAMIC_MIN_CANVA_HEIGHT_UPLOAD = 50;

const frontColorMap = { black: '/tshirtmockups/blacktshirt.png', red: '/tshirtmockups/redfront.png', navy: '/tshirtmockups/bluefront.png', brown: '/tshirtmockups/brownfront.png', cream: '/tshirtmockups/creamfront.png', white: '/tshirtmockups/whitefront.png', };
const backColorMap = { black: '/tshirtmockups/blackback.png', red: '/tshirtmockups/backred.png', navy: '/tshirtmockups/bluefront.png', brown: '/tshirtmockups/backbrown.png', cream: '/tshirtmockups/backcream.png', white: '/tshirtmockups/backwhite.png',};

const NODE_SERVER_BASE_URL = import.meta.env.VITE_NODE_SERVER_URL || 'http://localhost:5001';
const socketRef = React.createRef();

const UploadImageScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const contextValue = useCurrentItem();
  if (!contextValue) {
    console.error("UploadImageScreen FATAL: CurrentItemContext not available!");
    return <div style={{padding: "50px", color: "red", textAlign: "center", fontSize: "24px"}}>Critical Error: Item Configuration System Failed. Please restart.</div>;
  }
  const { currentItem, updateCurrentItem, setCustomization, DEFAULT_CUSTOMIZATION_POSITION } = contextValue;

  const queryParams = new URLSearchParams(location.search);
  const initialView = queryParams.get('view') || 'front';

  const [isFrontView, setIsFrontView] = useState(initialView === 'front');
  const [selectedColor, setSelectedColor] = useState(currentItem?.color || 'black');
  
  // --- MODIFIED Initial State for Scan Card ---
  const [isScanCardVisible, setIsScanCardVisible] = useState(true); // << Card visible by default
  const [isFlipCardShowingUploadQR, setIsFlipCardShowingUploadQR] = useState(true); // << Upload QR face visible by default
  // -------------------------------------------
  
  const [uploadQrSrc, setUploadQrSrc] = useState('');
  const [qrLoadingMessage, setQrLoadingMessage] = useState('Initializing...'); // Initial message
  const [kioskUploadStatus, setKioskUploadStatus] = useState({ message: '', type: '' });
  const [socketConnected, setSocketConnected] = useState(false);

  const activeCust = isFrontView ? currentItem?.frontCustomization : currentItem?.backCustomization;
  
  const defaultRndPos = DEFAULT_CUSTOMIZATION_POSITION || {x:10, y:10, width:150, height:150};
  const [rndPosition, setRndPosition] = useState(activeCust?.position || defaultRndPos);
  const [rndSize, setRndSize] = useState({ 
    width: activeCust?.position?.width || defaultRndPos.width, 
    height: activeCust?.position?.height || defaultRndPos.height 
  });
  
  const outerPrintableAreaRef = useRef(null);
  const instanceLocalBlobUrlRef = useRef(null);
  const isFrontViewRef = useRef(isFrontView);

  useEffect(() => {
    isFrontViewRef.current = isFrontView;
  }, [isFrontView]);

  const revokePreviousInstanceBlob = useCallback(() => {
    if (instanceLocalBlobUrlRef.current) {
        URL.revokeObjectURL(instanceLocalBlobUrlRef.current);
        instanceLocalBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    const currentActiveCustPos = activeCust?.position;
    const defPos = DEFAULT_CUSTOMIZATION_POSITION || { x: 10, y: 10, width: 150, height: 150 };
    setRndPosition({ x: currentActiveCustPos?.x ?? defPos.x, y: currentActiveCustPos?.y ?? defPos.y });
    setRndSize({ 
      width: currentActiveCustPos?.width || defPos.width, 
      height: currentActiveCustPos?.height || defPos.height 
    });
  }, [activeCust?.position, DEFAULT_CUSTOMIZATION_POSITION, isFrontView]);

  const showKioskStatus = useCallback((message, type = 'info', duration = 4500) => {
    setKioskUploadStatus({ message, type });
    setTimeout(() => {
      setKioskUploadStatus(prevStatus => (prevStatus.message === message ? { message: '', type: '' } : prevStatus));
    }, type === 'error' ? Math.max(duration, 7000) : duration);
  }, []);


  const fetchAndSetUploadQr = useCallback(() => {
    const currentSocket = socketRef.current;
    if (currentSocket && currentSocket.connected && currentSocket.id && isScanCardVisible && isFlipCardShowingUploadQR) {
      const side = isFrontViewRef.current ? 'front' : 'back';
      const qrUrlFromServer = `${NODE_SERVER_BASE_URL}/qr_code_kiosk.png?kioskId=${encodeURIComponent(currentSocket.id)}&side=${encodeURIComponent(side)}&t=${Date.now()}`;
      
      console.log(`UploadImageScreen: fetchAndSetUploadQr - Fetching Kiosk QR: ${qrUrlFromServer}`);
      setQrLoadingMessage('Loading QR Code...');
      setUploadQrSrc(''); 
      
      const img = new Image();
      img.onload = () => { setUploadQrSrc(qrUrlFromServer); setQrLoadingMessage(''); showKioskStatus(`Scan QR to upload image for the ${side}.`, 'info', 10000); };
      img.onerror = () => { setQrLoadingMessage('Error loading QR.'); setUploadQrSrc('/placeholder-qr.png'); showKioskStatus('Error loading QR code from server.', 'error');};
      img.src = qrUrlFromServer;

    } else if (isScanCardVisible && isFlipCardShowingUploadQR) {
        setQrLoadingMessage('Upload service connecting...');
        showKioskStatus('Connecting for QR code...', 'info');
        if (currentSocket && !currentSocket.connected && !currentSocket.connecting) {
            currentSocket.connect();
        } else if (!currentSocket){
             console.error("UploadImageScreen: fetchAndSetUploadQr - socketRef.current is null when trying to fetch QR.");
        }
    }
  }, [isScanCardVisible, isFlipCardShowingUploadQR, showKioskStatus]);

  useEffect(() => {
    // This effect now depends on socketConnected as well, so QR fetch attempts when socket becomes ready.
    if(isScanCardVisible && isFlipCardShowingUploadQR && socketConnected){
        fetchAndSetUploadQr();
    } else if (isScanCardVisible && !isFlipCardShowingUploadQR) { // Wi-Fi card showing
        setQrLoadingMessage(''); setUploadQrSrc('');
    } else if (!isScanCardVisible) { // Card hidden
        setQrLoadingMessage(''); setUploadQrSrc('');
    }
  }, [isScanCardVisible, isFlipCardShowingUploadQR, fetchAndSetUploadQr, socketConnected]);

  // Socket.IO Management Effect
  useEffect(() => {
    console.log("UploadImageScreen: Socket.IO Connection useEffect - Initializing.");
    if (!socketRef.current) {
      socketRef.current = io(NODE_SERVER_BASE_URL, {
        autoConnect: false, transports: ['websocket', 'polling'],
        reconnectionAttempts: 3, reconnectionDelay: 3000, timeout: 5000,
      });
      console.log("UploadImageScreen: Socket instance created.");
    }

    const localSocket = socketRef.current;
    const onConnect = () => { 
      setSocketConnected(true); 
      console.log('UploadImageScreen: Socket connected. ID:', localSocket.id); 
      showKioskStatus('Upload service active!', 'success'); 
      // Since isFlipCardShowingUploadQR and isScanCardVisible are true by default, 
      // the other useEffect will trigger fetchAndSetUploadQr if socketConnected becomes true.
    };
    const onKioskDisplayImage = async (data) => {
        console.log('UploadImageScreen: Received "kiosk_display_image" from server:', data);
        if (data && data.imageDataUrl && data.side && data.originalFileName) {
          revokePreviousInstanceBlob();
          let imageBlob, clientDisplayUrl;
          try {
            const fetchRes = await fetch(data.imageDataUrl);
            if (!fetchRes.ok) throw new Error(`Failed to fetch image data: ${fetchRes.status}`);
            imageBlob = await fetchRes.blob();
            if (!imageBlob.type.startsWith('image/')) throw new Error (`Fetched data is not an image: ${imageBlob.type}`);
            clientDisplayUrl = URL.createObjectURL(imageBlob);
            instanceLocalBlobUrlRef.current = clientDisplayUrl;
          } catch (e) { console.error("Error creating blob from B64:", e); showKioskStatus("Error processing image.", "error"); return; }
          
          const customizationData = { type: 'uploaded_image', src: clientDisplayUrl, _blobDataForUpload: imageBlob, originalFileName: data.originalFileName, position: { ...(DEFAULT_CUSTOMIZATION_POSITION || {x:10,y:10,width:150,height:150})} };
          const targetSide = data.side === 'front' ? 'front' : 'back';
          setCustomization(targetSide, customizationData);
          const viewMatches = (data.side === 'front' && isFrontViewRef.current) || (data.side === 'back' && !isFrontViewRef.current);
          showKioskStatus(viewMatches ? `Image "${data.originalFileName}" applied!` : `Image for ${data.side} stored.`, "success");
          setIsScanCardVisible(false); // Hide card after successful upload
          setIsFlipCardShowingUploadQR(false); // Reset to Wi-Fi face for next time
        } else { showKioskStatus("Error: Invalid image data from server.", "error"); }
    };
    const onDisconnect = (reason) => { setSocketConnected(false); console.warn("Socket disconnected:", reason); showKioskStatus(`Upload service disconnected: ${reason}.`, "error"); setUploadQrSrc(''); setQrLoadingMessage('Disconnected.'); };
    const onConnectError = (error) => { setSocketConnected(false); console.error("Socket connection error:", error.message); showKioskStatus(`Cannot connect: ${error.message}.`, "error", 7000); setUploadQrSrc(''); setQrLoadingMessage('Connection error.'); };

    localSocket.on('connect', onConnect); localSocket.on('kiosk_display_image', onKioskDisplayImage);
    localSocket.on('disconnect', onDisconnect); localSocket.on('connect_error', onConnectError);

    if (!localSocket.connected && !localSocket.connecting) { 
        console.log("UploadImageScreen: Socket not connected in main useEffect, calling connect().");
        localSocket.connect(); 
    } else if (localSocket.connected && !socketConnected) { 
        // If socket connected somehow before this effect's state caught up
        setSocketConnected(true); 
    }

    return () => {
      console.log("UploadImageScreen: Socket useEffect cleanup.");
      revokePreviousInstanceBlob();
      if (localSocket) {
        console.log("UploadImageScreen: Disconnecting socket in cleanup:", localSocket.id);
        localSocket.disconnect();
        localSocket.off('connect', onConnect); localSocket.off('kiosk_display_image', onKioskDisplayImage);
        localSocket.off('disconnect', onDisconnect); localSocket.off('connect_error', onConnectError);
      }
      setSocketConnected(false);
      // Consider if socketRef.current should be nulled. If component unmounts & remounts,
      // we might want a fresh instance vs trying to reuse a disconnected one.
      // For robust re-mount, nullifying is often better.
      // socketRef.current = null; 
    };
  }, []); // Empty: run once on mount, cleanup on unmount

  const handleRndInteractionEnd = useCallback((newPosition) => {
    if (activeCust && activeCust.src) {
      const currentPosInContext = activeCust.position || {};
      if (Math.abs(currentPosInContext.x - newPosition.x) > 0.01 || Math.abs(currentPosInContext.y - newPosition.y) > 0.01 ||
          Math.abs(currentPosInContext.width - newPosition.width) > 0.01 || Math.abs(currentPosInContext.height - newPosition.height) > 0.01 ||
          !activeCust.position) {
        const updatedCustomization = { ...activeCust, position: newPosition };
        setCustomization(isFrontViewRef.current ? 'front' : 'back', updatedCustomization);
      }
    }
  }, [activeCust, setCustomization, isFrontViewRef]);

  const handleColorChange = (color) => { setSelectedColor(color); updateCurrentItem({ color }); };
  const handleFlipView = () => { 
    if(activeCust && activeCust.src ) handleRndInteractionEnd({x: rndPosition.x, y: rndPosition.y, width: rndSize.width, height: rndSize.height});
    setIsFrontView(prev => !prev); 
    if(isScanCardVisible && isFlipCardShowingUploadQR){ setQrLoadingMessage('Updating QR...'); setUploadQrSrc('');}
  };
  const handleDeleteCustomization = () => { 
      if(activeCust) {
        if (activeCust.src === instanceLocalBlobUrlRef.current) revokePreviousInstanceBlob();
        setCustomization(isFrontViewRef.current ? 'front' : 'back', null);
      }
  };
  
  const toggleScanCard = useCallback(() => {
    // This function will now mostly be for HIDING the card, or for programmatically showing it (e.g. via shortcut)
    // and defaulting it to the Wi-Fi side.
    setIsScanCardVisible(prevVisibility => {
        const newVisibility = !prevVisibility;
        if (newVisibility) { // If card is being SHOWN by toggle (e.g. shortcut)
            setIsFlipCardShowingUploadQR(false); // Default to Wi-Fi side
            const currentSocket = socketRef.current;
            if (!currentSocket || !currentSocket.connected) {
                showKioskStatus('Upload service connecting...', 'info');
                if (currentSocket && !currentSocket.connecting) currentSocket.connect();
                else if(!currentSocket) console.error("toggleScanCard: socketRef.current is null when showing card.");
            }
        } else { // If card is being HIDDEN
            setIsFlipCardShowingUploadQR(false);
            setUploadQrSrc(''); setQrLoadingMessage('');
        }
        return newVisibility;
    });
  }, [showKioskStatus]);

  useEffect(() => { // Keyboard shortcut for hiding/showing scan card
    const handleKeyDown = (e) => { if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'S') { e.preventDefault(); toggleScanCard();}};
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleScanCard]);

  const handleNext = () => {
    if(activeCust && activeCust.src) {
        handleRndInteractionEnd({x: rndPosition.x, y: rndPosition.y, width: rndSize.width, height: rndSize.height});
    }
    setTimeout(() => navigate('/order-preview'), 50);
  };
  
  const tshirtSrc = isFrontViewRef.current ? frontColorMap[selectedColor] : backColorMap[selectedColor];
  const canProceed = !!activeCust?.src;

  // --- Styles ---
  const pageContainerStyle = { width: '2240px', height: '1400px', position: 'relative', background: 'white', overflow: 'hidden', fontFamily: 'Inter, sans-serif' };
  const leftPreviewPanelStyle = { width: '792px', height: '975px', left: '113px', top: '285px', position: 'absolute', background: '#F4F9FF', borderRadius: '12px' };
  const colorBarBgStyle = { width: '792px', height: '134px', top: '841px', position: 'absolute', background: 'rgba(0, 86, 111, 0.08)', boxShadow: '0px -1px 4px rgba(0, 0, 0, 0.13)' };
  const mockupSectionStyle = { position: 'absolute', left: '52px', top: '98px', width: '689px', height: '691px' };
  const tshirtImageStyle = { width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0, zIndex: 0 };
  const outerPrintableAreaDynamicStyle = { display: (activeCust && activeCust.src) ? 'flex' : 'none', justifyContent: 'center', alignItems: 'center', position: 'absolute', width: `${UI_OUTER_PRINTABLE_PIXEL_WIDTH}px`, height: `${UI_OUTER_PRINTABLE_PIXEL_HEIGHT}px`, border: '2px dashed rgba(0, 86, 111, 0.7)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', boxSizing: 'border-box', zIndex: 5, pointerEvents: 'none' };
  const rndWrapperStyle = { border: '1px solid rgba(0,86,111,1)', backgroundColor: 'rgba(0,86,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box', cursor: 'grab' };
  const uploadedImagePreviewStyleInRnd = { width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' };
  const colorOptionsStyle = { left: '142px', top: '879px', position: 'absolute', display: 'flex', gap: '30px' };
  const colorDotStyle = (bgColor, isSelected) => ({ width: '59px', height: '59px', borderRadius: '50%', cursor: 'pointer', backgroundColor: bgColor, border: isSelected ? '3px solid #00566F' : `1px solid ${bgColor === '#ffffff' ? '#ccc' : 'transparent'}`, boxShadow: isSelected ? '0 0 8px #00566F' : 'none', transition: 'border 0.2s, box-shadow 0.2s' });
  const pageTitleStyle = { width: 'auto', height: '127px', left: '50%', transform: 'translateX(-50%)', top: '91px', position: 'absolute', color: '#00566F', fontSize: '96px', fontFamily: "'SS Magnetic', sans-serif", fontWeight: 400, whiteSpace: 'nowrap', textAlign:'center' };
  const scanCardStyle = { left:'1076px', top:'279px', position: 'absolute', opacity: isScanCardVisible ? 1:0, transform: isScanCardVisible ? 'translateX(0)' : 'translateX(50px)', transition: 'transform 0.5s ease-out, opacity 0.5s ease-out', zIndex: 50, display: isScanCardVisible ? 'block' : 'none' };
  const flipCardStyle = { width: '712px', height: '800px', position: 'relative', transition: 'transform 0.8s', transformStyle: 'preserve-3d', transform: isFlipCardShowingUploadQR ? 'rotateY(180deg)' : 'rotateY(0deg)' };
  const cardFaceBaseStyle = { width: '100%', height: '100%', background: '#F4FAFF', borderRadius: '12px', position: 'absolute', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', justifyContent:'space-around', alignItems:'center', padding:'30px 20px', boxSizing:'border-box' };
  const cardFaceBackStyle = {...cardFaceBaseStyle, transform: 'rotateY(180deg)'};
  const qrCodeImageStyle = { width:'349px', height:'367px', objectFit: 'contain', marginBottom: '15px', backgroundColor:'#fff', border:'1px solid #ddd' }; 
  const uploadInstructionImageTagStyle = { width:'425px', height:'447px', objectFit: 'contain', backgroundColor: 'white', border: '1px solid #eee', marginBottom: '10px'};
  const cardTextStyle = { color: '#00566F', fontSize: '42px', fontFamily: 'Inter', fontWeight: 700, textAlign:'center' };
  const cardInfoTextStyle = {color: '#6298A9', fontSize: '32px', fontFamily: 'Inter', fontWeight: 600, textAlign:'center', lineHeight:'1.4'};
  const cardActionButtonStyle = {width: '185px', height: '80px', backgroundColor: '#00566F', border: 'none', borderRadius: '15px', color: 'white', fontSize: '36px', cursor: 'pointer', marginTop:'10px' };
  const semicircleToggleStyle = { position: 'absolute', right: '30px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '160px', backgroundColor: '#00566F', borderTopLeftRadius: '80px', borderBottomLeftRadius: '80px', cursor: 'pointer', zIndex: 100, display: isScanCardVisible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center'};
  const semicircleImageStyle = { width: '40px', height: '44px', transform: 'rotate(180deg)' };
  const nextButtonStyle = { width: '288px', height: '123px', left: '1878px', top: '1192px', position: 'absolute', borderRadius: '15px', color: 'white', fontSize: '48px', fontFamily: 'Inter', fontWeight: 700, border: 'none', backgroundColor: canProceed ? '#00566F' : 'rgba(0,86,111,0.5)', cursor: canProceed ? 'pointer' : 'default', pointerEvents: canProceed ? 'auto':'none'};
  const uploadStatusKioskStyle = { position: 'absolute', left: `calc(1076px + 712px / 2)`, top: `calc(279px + 800px + 20px)`, transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '5px', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', zIndex: 60, display: kioskUploadStatus.message ? 'block' : 'none', backgroundColor: kioskUploadStatus.type === 'success' ? '#d4edda' : kioskUploadStatus.type === 'error' ? '#f8d7da' : '#d1ecf1', color: kioskUploadStatus.type === 'success' ? '#155724' : kioskUploadStatus.type === 'error' ? '#721c24' : '#0c5460' };

  return (
    <div style={pageContainerStyle}>
      <CartIndicator />
      <div style={leftPreviewPanelStyle}>
        <div style={colorBarBgStyle}></div>
        <div style={mockupSectionStyle}>
          <img id="tshirt-image" src={tshirtSrc || frontColorMap.black} alt="T-shirt Mockup" style={tshirtImageStyle} />
          <div ref={outerPrintableAreaRef} style={outerPrintableAreaDynamicStyle}>
            {activeCust?.src && (
              <Rnd
                style={rndWrapperStyle}
                size={{ width: rndSize.width, height: rndSize.height }}
                position={{ x: rndPosition.x, y: rndPosition.y }}
                minWidth={DYNAMIC_MIN_CANVA_WIDTH_UPLOAD} minHeight={DYNAMIC_MIN_CANVA_HEIGHT_UPLOAD}
                bounds="parent"
                onDragStop={(e, d) => { setRndPosition({ x: d.x, y: d.y }); handleRndInteractionEnd({ x: d.x, y: d.y, width: rndSize.width, height: rndSize.height }); }}
                onResizeStop={(e, direction, ref, delta, position) => { const newDims = { x: position.x, y: position.y, width: parseFloat(ref.style.width), height: parseFloat(ref.style.height) }; setRndSize({ width: newDims.width, height: newDims.height }); setRndPosition({x: newDims.x, y: newDims.y }); handleRndInteractionEnd(newDims); }}
                enableResizing={{ bottomRight: true }}
                 resizeHandleComponent={{ bottomRight: <div style={{width: '24px', height: '24px', background: 'rgba(0,86,111,0.6)', borderRadius: '50%', border: '2px solid white', cursor: 'nwse-resize', position: 'absolute', right: '-12px', bottom: '-12px'}}/> }}
              >
                <img src={activeCust.src} alt={activeCust.originalFileName || "Uploaded Design"} style={uploadedImagePreviewStyleInRnd} draggable="false" 
                  onError={(e) => {console.error("Error loading RND image:", activeCust.src);}}
                />
              </Rnd>
            )}
          </div>
        </div>
        <div style={colorOptionsStyle}>
          {['black', 'red', 'navy', 'brown', 'cream', 'white'].map(color => (
            <div key={color} style={colorDotStyle(color === 'black' ? '#1e1e1e' : color === 'white' ? '#ffffff' : color, selectedColor === color)} onClick={() => handleColorChange(color)} />
          ))}
        </div>
        {activeCust?.src && (<img id="deleteCustomizationBtn" src="/QR_Screen_Img/Delete.png" alt="Delete" style={{ width: '50px', height: '50px', position: 'absolute', right: '20px', bottom: 'calc(134px + 20px)', cursor: 'pointer', zIndex: 7 }} onClick={handleDeleteCustomization}/>)}
        <img id="flip-icon" style={{ width: '80px', height: '80px', position: 'absolute', right: '20px', top: '20px', cursor:'pointer' }} src="/QR_Screen_Img/flip.png" alt="Flip View" onClick={handleFlipView} />
      </div>

      <Link to="/feature-display" onClick={revokePreviousInstanceBlob}>
        <img style={{ width: '100px', height: '100px', position: 'absolute', left: '100px', top: '80px', cursor: 'pointer' }} src="/Features_Display_Img/back arrow.png" alt="Back" />
      </Link>
      <div style={pageTitleStyle}>Upload Your Image ({isFrontViewRef.current ? 'Front' : 'Back'})</div>

      {/* SCAN CARD UI - Always visible, starts on Upload QR face */}
      <div id="scanCard" style={scanCardStyle}>
        <div id="flipCard" style={flipCardStyle}>
          {/* Wi-Fi Card Face (still needed for user to flip back to if they want) */}
          <div id="frontCard" style={cardFaceBaseStyle}>
            <div style={cardTextStyle}>Connect to Store Wi-Fi</div>
            <img id="wifiQrImage" src="/QR_Screen_Img/wifi_qr_placeholder.png" alt="Wi-Fi QR Code" style={qrCodeImageStyle}/>
            <div style={cardInfoTextStyle}>1. Connect phone to "KioskNet" Wi-Fi.<br/>2. Scan QR on other side to upload.</div>
            <button style={cardActionButtonStyle} onClick={() => {
                const currentSocket = socketRef.current;
                // If socket is connected, allow flip, otherwise, prompt to wait or trigger connect
                if (currentSocket && currentSocket.connected) { 
                    setIsFlipCardShowingUploadQR(true); // This will trigger QR fetch
                } else { 
                    showKioskStatus("Connecting to upload service... Please wait.", "info"); 
                    if (currentSocket && !currentSocket.connecting) {
                        currentSocket.connect();
                    } else if (!currentSocket) {
                        // This scenario means the main useEffect for socket init hasn't run or failed
                        console.error("Wi-Fi Card 'Next': socketRef.current is null! Main effect should initialize it.");
                        // Attempt to re-initialize or alert user of a more severe issue
                        // For now, status message should cover it.
                    }
                }
            }}>Show Upload QR →</button>
          </div>
          {/* Upload QR Card Face */}
          <div id="backCard" style={cardFaceBackStyle}>
            <div style={cardTextStyle}>Scan to Upload to <span>{isFrontViewRef.current ? 'Front' : 'Back'}</span></div>
            {qrLoadingMessage && <div style={{...uploadInstructionImageTagStyle, display:'flex', alignItems:'center', justifyContent:'center'}}><p style={{fontSize:'22px', color:'#555'}}>{qrLoadingMessage}</p></div>}
            {!qrLoadingMessage && uploadQrSrc && <img id="uploadInstructionImage" src={uploadQrSrc} alt="Scan to Upload Your Image" style={uploadInstructionImageTagStyle} />}
            {!qrLoadingMessage && !uploadQrSrc && ( <div style={{...uploadInstructionImageTagStyle, display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed #ccc'}}><p style={{fontSize:'22px', color:'#555'}}>QR will load here if service is connected.</p></div> )}
            <p style={{fontSize:'24px', color:'#555', textAlign:'center', lineHeight: '1.3', marginTop: '10px'}}>Image will appear on T-shirt after phone upload.</p>
            <button style={cardActionButtonStyle} onClick={() => setIsFlipCardShowingUploadQR(false)} >← Wi-Fi Info</button>
          </div>
        </div>
      </div>
      
      {/* Semicircle is only for HIDING the card if it's visible. 
          The Ctrl+Shift+S toggles visibility, this is a manual hide. */}
      {isScanCardVisible && (
        <div id="semicircle" style={semicircleToggleStyle} onClick={() => {setIsScanCardVisible(false); setIsFlipCardShowingUploadQR(false); setUploadQrSrc(''); setQrLoadingMessage('');}}>
            <img src="/QR_Screen_Img/chevron.png" alt="Hide QR" style={semicircleImageStyle}/>
        </div>
      )}
      
      {/* REMOVED "Toggle QR Card (DEV)" button */}

      <button style={nextButtonStyle} onClick={handleNext} disabled={!canProceed}>Next</button>
      <div style={uploadStatusKioskStyle}>{kioskUploadStatus.message}</div>
    </div>
  );
};

export default UploadImageScreen;