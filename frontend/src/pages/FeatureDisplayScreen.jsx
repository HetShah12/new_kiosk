// frontend/src/pages/FeatureDisplayScreen.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentItem } from '../contexts/CurrentItemContext';
// import CartIndicator from '../components/common/CartIndicator';

const UI_OUTER_PRINTABLE_PIXEL_WIDTH = 330;
const UI_OUTER_PRINTABLE_PIXEL_HEIGHT = 488;

const frontColorMap = {
  black: '/tshirtmockups/blacktshirt.png',
  red: '/tshirtmockups/redfront.png',
  navy: '/tshirtmockups/bluefront.png',
  brown: '/tshirtmockups/brownfront.png',
  cream: '/tshirtmockups/creamfront.png',
  white: '/tshirtmockups/whitefront.png',
};
const backColorMap = {
  black: '/tshirtmockups/blackback.png',
  red: '/tshirtmockups/backred.png',
  navy: '/tshirtmockups/backblue.png',
  brown: '/tshirtmockups/backbrown.png',
  cream: '/tshirtmockups/backcream.png',
  white: '/tshirtmockups/backwhite.png',
};

const colors = [
    { name: 'black', code: '#1e1e1e', borderStyle: 'none' }, // Added borderStyle for consistency
    { name: 'red', code: '#8b0000', borderStyle: 'none' },
    { name: 'navy', code: '#002244', borderStyle: 'none' },
    { name: 'brown', code: '#7A4824', borderStyle: 'none' },
    { name: 'cream', code: '#fdf1dc', borderStyle: 'none' },
    { name: 'white', code: '#ffffff', borderStyle: '1px solid #ccc' },
];

const featuresData = [ // Renamed to avoid conflict
    { name: 'AI Text to Image', icon: '/Features_Display_Img/aiicon.png', price: 50, path: '/ai-text-to-image', top: '421px', left: '993px', titleLeft: '130px' },
    { name: 'AI Draw to Image', icon: '/Features_Display_Img/drawimgai.png', price: 50, path: '/ai-draw-to-image', top: '421px', left: '1590px', titleLeft: '132px', iconStyle: { height: '62px'} },
    { name: 'Upload Image', icon: '/Features_Display_Img/galleryicon.png', price: 50, path: '/upload-image', top: '625px', left: '993px', titleLeft: '132px' },
    { name: 'Design Library', icon: '/Features_Display_Img/designlibrary.png', price: 20, path: '/design-library', top: '625px', left: '1590px', titleLeft: '132px', iconStyle: {width: '77px', height: '77px'} },
    { name: 'Embroidery', icon: '/Features_Display_Img/embroideryicon.png', price: null, path: '/embroidery', top: '860px', left: '1340px', titleLeft: '132px', titleTop: '60px', iconStyle: {width: '85px', height: '85px'}, id: 'embroidery-card' },
];

const FeatureDisplayScreen = () => {
  const navigate = useNavigate();
  const { currentItem, updateCurrentItem, DEFAULT_CUSTOMIZATION_POSITION } = useCurrentItem();

  const [isFrontView, setIsFrontView] = useState(true);
  // State to simulate :active for feature cards, if pure CSS :active isn't enough or for more control
  const [activeFeatureCard, setActiveFeatureCard] = useState(null);


  useEffect(() => {
    if (!currentItem || !currentItem.id) { // Check if it's a new/empty item from context
        // If currentItem is totally new, initialize some sensible defaults from context itself
        // The context's getInitialItem should handle creating a new item.
        // This component ensures it has what it needs for display (like color).
        updateCurrentItem({ // This would typically set default productType, color etc. if not present
            color: currentItem?.color || 'black',
            // ... other defaults if context initial item is too bare for this screen
        });
    } else if (!currentItem.color) { // Item exists, but color might be missing
         updateCurrentItem({ color: 'black' });
    }

    if (!currentItem || !currentItem.size || !currentItem.thicknessName) { // Check essential props
        console.warn("FeatureDisplayScreen: Size or Thickness missing from currentItem. CurrentItem:", currentItem);
        alert("Important: T-shirt size or thickness is not selected. Please go back to 'Size Selection'.");
        navigate('/size-selection');
    }
  }, [currentItem, updateCurrentItem, navigate]);

  const handleColorSelection = (colorName) => {
    updateCurrentItem({ color: colorName });
  };

  const handleFlip = () => {
    setIsFrontView(prev => !prev);
  };

  const handleNavigateToFeature = (path, featureName) => {
    setActiveFeatureCard(featureName); // For visual feedback
    setTimeout(() => {
        navigate(`${path}?view=${isFrontView ? 'front' : 'back'}`);
        setActiveFeatureCard(null);
    }, 150); // Short delay
  };

  const activeCustomization = isFrontView ? currentItem?.frontCustomization : currentItem?.backCustomization;
  const tshirtSrc = isFrontView
    ? frontColorMap[currentItem?.color || 'black'] || frontColorMap.black
    : backColorMap[currentItem?.color || 'black'] || backColorMap.black;

  // --- Styles ---
  const pageTitleStyle = {
    width: 'auto', height: '127px', left: '50%', transform: 'translateX(-50%)',
    top: '91px', position: 'absolute', color: '#00566F', fontSize: '96px',
    fontFamily: "'SS Magnetic', sans-serif", fontWeight: 400, whiteSpace: 'nowrap',
  };
  const backArrowStyle = { width: '120px', height: '120px', left: '127px', top: '94px', position: 'absolute', cursor:'pointer' };
  const leftPanelStyle = {
    width: '792px', height: '975px', left: '113px', top: '285px',
    position: 'absolute', background: '#F4F9FF', borderRadius: '12px',
  };
  const colorBarBackgroundStyle = {
    width: '100%', height: '134px', left: '0', top: '841px',
    position: 'absolute', background: 'rgba(0, 86, 111, 0.08)',
    boxShadow: '0px -1px 4px rgba(0, 0, 0, 0.13)',
  };
  const mockupSectionStyle = {
    position: 'absolute', width: '689px', height: '691px',
    left: '52px', top: '98px',
  };
  const tshirtImageStyle = { width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top:0, left:0, zIndex:0 };
  const canvaGuideOuterStyle = {
    width: `${UI_OUTER_PRINTABLE_PIXEL_WIDTH}px`,
    height: `${UI_OUTER_PRINTABLE_PIXEL_HEIGHT}px`,
    border: '2px dashed rgba(0, 86, 111, 0.5)',
    position: 'absolute', left: '50%', top: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none', opacity: 0.7, zIndex: 1, display: 'flex',
    boxSizing: 'border-box',
  };
  const appliedDesignPreviewContainerStyle = {
    position: 'absolute', zIndex: 2, overflow: 'hidden',
    display: activeCustomization && (activeCustomization.src || activeCustomization.text) ? 'block' : 'none',
    // Dynamic positioning and sizing
    ...(activeCustomization && (activeCustomization.src || activeCustomization.text) && (() => {
        const pos = activeCustomization.position || DEFAULT_CUSTOMIZATION_POSITION; // Use default from context if needed
        const mockupWidth = 689;
        const mockupHeight = 691;
        const outerGuideOffsetX = (mockupWidth - UI_OUTER_PRINTABLE_PIXEL_WIDTH) / 2;
        const outerGuideOffsetY = (mockupHeight - UI_OUTER_PRINTABLE_PIXEL_HEIGHT) / 2;
        return {
            left: `${outerGuideOffsetX + (pos.x || 0)}px`,
            top: `${outerGuideOffsetY + (pos.y || 0)}px`,
            width: `${pos.width || UI_OUTER_PRINTABLE_PIXEL_WIDTH / 4}px`,
            height: `${pos.height || UI_OUTER_PRINTABLE_PIXEL_HEIGHT / 4}px`,
        };
    })()),
  };
   const appliedDesignContentStyle = { // For both img and text div
        width: '100%', height: '100%', objectFit: 'contain', display: 'flex',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        wordBreak: 'break-word' // For text
   };
  const colorOptionsStyle = {
    left: '142px', top: '879px', position: 'absolute', display: 'flex', gap: '30px'
  };
  const colorDotBaseStyle = {
    width: '59px', height: '59px', borderRadius: '50%', cursor: 'pointer',
    border: '2px solid transparent', transition: 'border 0.2s, box-shadow 0.2s'
  };
  const flipIconStyle = {
    width: '100px', height: '100px', left: '632px', top: '33px',
    position: 'absolute', cursor: 'pointer'
  };
  const featureCardBaseStyle = {
    position: 'absolute', width: '564px', height: '170px' // Removed cursor here, apply to wrapper
  };
  const featureCardBgBaseStyle = {
    width: '544px', height: '160px', top: '10px', left: '0px',
    position: 'absolute', background: '#F4FAFF', borderRadius: '16px',
    transition: 'box-shadow 0.3s',
  };
   const featureCardActiveStyle = { // To be applied to featureCardBgBaseStyle on active state
    boxShadow: '0px 4px 26.5px rgba(0, 86, 111, 0.42)',
  };
  const featureIconStyle = {
    position: 'absolute', left: '43px', top: '50px', width: '60px', height: '60px', objectFit: 'contain'
  };
  const featureTitleStyle = {
    position: 'absolute', top: '59px', color: '#00566F',
    fontSize: '36px', fontFamily: 'Inter, sans-serif', fontWeight: 700
  };
  const featurePriceTagStyle = {
    minWidth:'97px', padding:'0 10px', height: '44px', backgroundColor: '#FEE6D1',
    position: 'absolute', borderRadius: '46px', right: '20px', top: '10px',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    color: '#D57218', fontSize: '20px', fontWeight: 600, fontFamily: 'Inter, sans-serif'
  };

  return (
    <>
      {/* <CartIndicator /> */}
      <div style={leftPanelStyle}>
        <div style={colorBarBackgroundStyle} />
        <div style={mockupSectionStyle}>
          <img id="tshirt-image" src={tshirtSrc} alt="T-shirt Mockup" style={tshirtImageStyle} />
          <div style={canvaGuideOuterStyle} /> {/* Dashed outline for print area */}
          <div style={appliedDesignPreviewContainerStyle}>
            {activeCustomization && activeCustomization.type === 'embroidery_text' && activeCustomization.text && (
              <div style={{
                ...appliedDesignContentStyle,
                fontFamily: activeCustomization.font || 'Arial',
                color: activeCustomization.textColor || 'black', // Changed from `color`
                fontSize: '24px', /* This should ideally scale with position.height */
              }}>
                {activeCustomization.text}
              </div>
            )}
            {activeCustomization && activeCustomization.src && activeCustomization.type !== 'embroidery_text' && (
              <img src={activeCustomization.src} alt={activeCustomization.type || "Custom Design"} style={appliedDesignContentStyle} />
            )}
          </div>
        </div>
        <div style={colorOptionsStyle}>
          {colors.map(colorInfo => (
            <div
              key={colorInfo.name}
              style={{
                ...colorDotBaseStyle,
                backgroundColor: colorInfo.code,
                border: currentItem?.color === colorInfo.name ? '2px solid #00566F' : colorInfo.borderStyle,
              }}
              onClick={() => handleColorSelection(colorInfo.name)}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0px 4px 10.899999618530273px 7px rgba(21.13, 59.18, 90.31, 0.44)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
            />
          ))}
        </div>
        <img
          id="flip-icon" style={flipIconStyle} src="/Features_Display_Img/flip.png"
          alt="Flip T-shirt view" onClick={handleFlip}
        />
      </div>

      <Link to="/size-selection">
        <img style={backArrowStyle} src="/Features_Display_Img/back arrow.png" alt="Back" />
      </Link>
      <div style={pageTitleStyle}>Customize your Style</div>

      {featuresData.map(feature => {
        const isDisabled = feature.id === 'embroidery-card' && !isFrontView;
        const isCardActive = activeFeatureCard === feature.name;
        return (
          <div // This outer div acts like the original '.feature-card' for positioning and click
            key={feature.name}
            style={{
              ...featureCardBaseStyle,
              left: feature.left,
              top: feature.top,
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
            }}
            onClick={() => !isDisabled && handleNavigateToFeature(feature.path, feature.name)}
          >
            <div style={{ ...featureCardBgBaseStyle, ...(isCardActive ? featureCardActiveStyle : {}) }}>
              <img src={feature.icon} alt={feature.name} style={{...featureIconStyle, ...feature.iconStyle}} />
              <div style={{ ...featureTitleStyle, left: feature.titleLeft, top: feature.titleTop || '59px' }}>
                {feature.name}
              </div>
            </div>
            {feature.price !== null && (
              <div style={featurePriceTagStyle}>+<span>₹</span>{feature.price}</div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default FeatureDisplayScreen;