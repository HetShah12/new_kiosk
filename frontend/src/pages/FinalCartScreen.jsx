// frontend/src/pages/FinalCartScreen.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext'; // Assuming you have this
import { useCurrentItem } from '../contexts/CurrentItemContext'; // For revokeItemBlobUrls
import CartIndicator from '../components/common/CartIndicator'; // If you want to show it here too

// Fallback image map (adjust paths if needed, should be in /public)
const TSHIRT_COLOR_MAP = { 
    black: '/tshirtmockups/blacktshirt.png', 
    red: '/tshirtmockups/redfront.png',
    navy: '/tshirtmockups/bluefront.png', 
    brown: '/tshirtmockups/brownfront.png',
    cream: '/tshirtmockups/creamfront.png', 
    white: '/tshirtmockups/whitefront.png'
};
const DEFAULT_TSHIRT_IMAGE = "/placeholder-tshirt.png"; // Create a placeholder in /public

const FinalCartScreen = () => {
  const navigate = useNavigate();
  const { cartItems, updateCartItemQuantity, removeCartItem, clearCartForCheckout, fetchCartItems } = useCart();
  const { revokeItemBlobUrls } = useCurrentItem(); // For cleaning up blobs on removal/checkout

  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [deliveryDetails, setDeliveryDetails] = useState(null);
  const [pickupDetails, setPickupDetails] = useState(null);
  const [deliveryType, setDeliveryType] = useState(null);

  useEffect(() => {
    fetchCartItems(); // Load cart items when component mounts or if cart updates elsewhere
    const type = localStorage.getItem('deliveryType');
    setDeliveryType(type); // This is fine

    // Ensure you parse JSON safely
    const deliveryDetailsRaw = localStorage.getItem('deliveryDetails');
    const pickupDetailsRaw = localStorage.getItem('pickupDetails');

    if (type === 'home_delivery' && deliveryDetailsRaw) {
      try {
        setDeliveryDetails(JSON.parse(deliveryDetailsRaw));
      } catch (e) {
        console.error("Error parsing deliveryDetails from localStorage:", e);
        setDeliveryDetails({}); // Set to empty object or null on error
      }
    } else if (type === 'store_pickup' && pickupDetailsRaw) {
      try {
        setPickupDetails(JSON.parse(pickupDetailsRaw));
      } catch (e) {
        console.error("Error parsing pickupDetails from localStorage:", e);
        setPickupDetails({});
      }
    }
  }, [fetchCartItems]);

  const handleQuantityChange = (cartItemId, newQuantity) => {
    if (newQuantity < 1) {
      if (window.confirm("Remove this item from cart?")) {
        const itemToRemove = cartItems.find(item => item.cartItemId === cartItemId || item.id === cartItemId); // Match by cartItemId or id
        if(itemToRemove) revokeItemBlobUrls(itemToRemove); // Clean up blobs if any
        removeCartItem(cartItemId);
      }
    } else {
      updateCartItemQuantity(cartItemId, newQuantity);
    }
  };

  const handleShowItemDetails = (item) => {
    setSelectedItemForModal(item);
  };

  const handleCloseModal = () => {
    setSelectedItemForModal(null);
  };

  const handleBackNavigation = () => {
    if (deliveryType === 'home_delivery') navigate('/delivery-form');
    else if (deliveryType === 'store_pickup') navigate('/store-pickup-form');
    else navigate('/delivery-options'); // Fallback
  };

  const formatCustomizationForDisplay = (cust) => {
    // (Same function as in OrderPreviewScreen.jsx - consider moving to a utils file)
    if (!cust) return 'None';
    let text = '';
    if (cust.type === 'ai_text_image') {
        text = "AI Image";
        if (cust.prompt) text += `: "${cust.prompt.length > 20 ? cust.prompt.substring(0, 17) + '...' : cust.prompt}"`;
        if (cust.removedBackground) text += ' (BG Removed)';
    } else if (cust.type === 'embroidery_text') {
        text = "Embroidery";
        if (cust.text) text += `: "${cust.text}" (Font: ${cust.font || 'Default'}, Color: ${cust.color || 'Default'})`;
    } else if (cust.type === 'embroidery_design') {
        text = "Embroidery Design";
        if (cust.name) text += `: ${cust.name}`;
    } else if (cust.type === 'uploaded_image') {
        text = "Uploaded Image";
        if (cust.originalFileName) text += `: ${cust.originalFileName.length > 20 ? cust.originalFileName.substring(0,17) + '...' : cust.originalFileName}`;
    } else if (cust.type === 'library_design') {
        text = "Library Design";
        if (cust.name) text += `: ${cust.name}`;
    } else if (cust.type === 'ai_draw_image') {
        text = "AI Drawn Image";
        if (cust.prompt) text += `: "${cust.prompt.length > 20 ? cust.prompt.substring(0, 17) + '...' : cust.prompt}"`;
    } else {
        text = cust.type ? cust.type.replace(/_/g, ' ') : 'Custom Design';
    }
    return text;
  };

  const { subtotal, totalCustomizationCharges, deliveryCharge, grandTotal } = useMemo(() => {
    let currentSubtotal = 0;
    let currentTotalCustomizationCharges = 0;

    cartItems.forEach(item => {
      const unitPrice = parseFloat(item.calculatedUnitPrice) || 0; // Ensure it's a number
      const quantity = parseInt(item.quantity, 10) || 0;
      currentSubtotal += unitPrice * quantity;
      
      // Summing up explicit customization charges if available in priceBreakdown
      if (item.priceBreakdown) {
        currentTotalCustomizationCharges += ((parseFloat(item.priceBreakdown.designAddon) || 0) +
                                            (parseFloat(item.priceBreakdown.printFront) || 0) +
                                            (parseFloat(item.priceBreakdown.printBack) || 0)) * quantity;
      }
    });

    let currentDeliveryCharge = 0;
    if (deliveryType === 'home_delivery') currentDeliveryCharge = 49.00;
    
    const currentGrandTotal = currentSubtotal + currentDeliveryCharge;

    return {
      subtotal: currentSubtotal,
      totalCustomizationCharges: currentTotalCustomizationCharges,
      deliveryCharge: currentDeliveryCharge,
      grandTotal: currentGrandTotal,
    };
  }, [cartItems, deliveryType]);


  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }
    if (!deliveryType) {
      alert("Please select a delivery method before checking out.");
      navigate('/delivery-options');
      return;
    }

    // The `clearCartForCheckout` should ideally handle API call and then clear context/localStorage
    // It might also revoke blob URLs as part of its process.
    try {
        const orderPayload = {
            cartItems: cartItems, // Cart items might already have base64 images from earlier step
            deliveryType: deliveryType,
            deliveryDetails: deliveryType === 'home_delivery' ? deliveryDetails : null,
            pickupDetails: deliveryType === 'store_pickup' ? pickupDetails : null,
            orderTotal: grandTotal
        };
        
        // SIMULATE API CALL (Replace with actual fetch to your backend)
        console.log("FINAL_CART: Order Payload for Backend:", JSON.stringify(orderPayload, null, 2));
        // const response = await fetch('/api/your-order-endpoint', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(orderPayload),
        // });
        // const result = await response.json();
        // if (!response.ok) throw new Error(result.message || 'Order placement failed');
        
        // On successful order placement from backend:
        alert('Order Confirmed and Placed! (Simulated). Thank you!');
        clearCartForCheckout(); // This should clear context and localStorage from CartContext
        // Clean up any remaining item blobs from currentItem (though cart items should be main concern)
        cartItems.forEach(item => revokeItemBlobUrls(item));
        localStorage.removeItem('deliveryDetails');
        localStorage.removeItem('pickupDetails');
        localStorage.removeItem('deliveryType');
        localStorage.removeItem('currentConfiguredItem'); // Important: Clear the item being configured

        navigate('/'); // Navigate to home screen or an order success page
    } catch (error) {
        console.error("FINAL_CART_ERROR: Error during checkout:", error);
        alert(`Checkout failed: ${error.message || 'Please try again.'}`);
    }
  };

  // Styles (condensed for brevity, assume similar to HTML)
  const pageContainerStyle = { width: '2240px', minHeight: '1400px', position: 'relative', background: 'white', fontFamily: 'Inter, sans-serif', overflowY: 'auto', overflowX: 'hidden' };
  const cartTitleBarStyle = { display: 'flex', alignItems: 'center', padding: '94px 127px 50px 127px' };
  const cartTitleText = { color: '#00566F', fontSize: '96px', fontFamily: "'SS Magnetic', sans-serif", fontWeight: 400 };
  const backArrowImgStyle = { width: '120px', height: '120px', marginRight: '60px', cursor: 'pointer' };
  const cartContentAreaStyle = { display: 'flex', justifyContent: 'space-between', padding: '0 109px', gap: '50px', alignItems: 'flex-start' };
  const cartItemsListStyle = { flexGrow: 1, maxWidth: '1144px' };
  const cartSummaryPanelStyle = { width: '815px', minHeight: '700px', backgroundColor: '#F4FAFF', borderRadius: '10px', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', position: 'sticky', top: '30px' };
  const summaryTitleStyle = { color: '#00566F', fontSize: '36px', fontWeight: 700, marginBottom: '20px', textAlign: 'center', borderBottom: '2px solid #00566F', paddingBottom: '15px' };
  const summaryRowStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' };
  const summaryLabelStyle = { fontSize: '30px', fontWeight: 500, color: '#333' };
  const summaryValueStyle = { fontSize: '30px', fontWeight: 600, color: '#00566F' };
  const summaryDividerStyle = { border: 0, borderTop: '1px solid #cce0e8', margin: '25px 0' };
  const deliveryInfoSummaryStyle = { marginTop: '20px', marginBottom: '25px', padding: '20px', backgroundColor: '#e6f3fb', borderRadius: '8px', fontSize: '28px', borderLeft: '5px solid #00566F' };
  const checkoutButtonStyle = { width: '100%', height: '90px', backgroundColor: '#00566F', border: 'none', borderRadius: '8px', color: 'white', fontSize: '40px', fontWeight: 600, cursor: 'pointer', marginTop: 'auto', alignSelf: 'center', transition: 'background-color 0.2s ease' };

  const cartItemStyle = { display: 'flex', alignItems: 'flex-start', marginBottom: '30px', paddingBottom: '30px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'};
  const cartItemImageContainerStyle = { width: '200px', height: '200px', marginRight: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' };
  const cartItemImageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' };
  const cartItemDetailsStyle = { flexGrow: 1 };
  const itemNameStyle = { color: '#00566F', fontSize: '48px', fontWeight: 600, marginBottom: '10px' };
  const itemSpecsListStyle = { listStyle: 'none', paddingLeft: 0, margin: '0 0 15px 0' };
  const itemSpecsListItemStyle = { fontSize: '28px', color: '#333', marginBottom: '5px', lineHeight: 1.4 };
  const itemActionsStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' };
  const quantityContainerCartStyle = { width: '180px', height: '70px', display: 'flex', backgroundColor: '#F4FAFF', border: '2px solid #5D94A6', borderRadius: '10px', color: '#00566F' };
  const quantityCartBtnSpanStyle = { width: '33.33%', textAlign: 'center', fontSize: '32px', fontWeight: 600, cursor: 'pointer', lineHeight: '66px', userSelect: 'none' };
  const viewDetailsLinkStyle = { color: '#00566F', fontSize: '32px', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer', marginTop: '10px', display: 'inline-block' };
  const itemPriceDisplayStyle = { color: '#00566F', fontSize: '48px', fontWeight: 800 };

  // Modal Styles
  const modalOverlayStyle = { display: 'flex', position: 'fixed', zIndex: 1002, left: 0, top: 0, width: '100%', height: '100%', backdropFilter: 'blur(5px)', background: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' };
  const modalContentStyle = { position: 'relative', width: '1343px', maxHeight: '90vh', overflowY: 'auto', background: '#DEEFFF', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,0,0,0.2)', padding: '40px', boxSizing: 'border-box' };
  const modalCloseBtnStyle = { position: 'absolute', top: '25px', left: '25px', width: '80px', height: '80px', cursor: 'pointer', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '50%', padding: '10px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const modalHeaderStyle = { textAlign: 'center', color: '#00566F', fontSize: '72px', fontFamily: "'SS Magnetic', sans-serif", fontWeight: 400, marginBottom: '35px', marginTop: '10px' };
  const modalImageContainerStyle = { width: '400px', height: '400px', margin: '0 auto 35px auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f8ff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ccc' };
  const modalImageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' };
  const modalDetailsGridStyle = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '15px 30px', fontSize: '36px', fontFamily: 'Inter', color: '#333' };
  const modalDetailsGridItemStyle = {}; // Base for items
  const modalDetailsGridLabelStyle = { color: '#00566F', fontWeight: 700, textAlign: 'right' };
  const modalDetailsGridValueStyle = { color: '#111', fontWeight: 500 };


  return (
    <div style={pageContainerStyle}>
      <CartIndicator /> {/* Or remove if not desired on this page */}
      <div style={cartTitleBarStyle}>
        <img style={backArrowImgStyle} src="/Features_Display_Img/back arrow.png" alt="Back" onClick={handleBackNavigation} />
        <div style={cartTitleText}>My Shopping Cart ({cartItems.length})</div>
      </div>

      <div style={cartContentAreaStyle}>
        <div style={cartItemsListStyle}>
          {cartItems.length === 0 ? (
            <p style={{ fontSize: '32px', color: '#777', textAlign: 'center', padding: '50px' }}>Your cart is empty.</p>
          ) : (
            cartItems.map(item => {
              const itemDisplayImage = item.frontCustomization?.src || item.backCustomization?.src || TSHIRT_COLOR_MAP[item.color] || DEFAULT_TSHIRT_IMAGE;
              const unitPrice = parseFloat(item.calculatedUnitPrice) || 0;
              const itemTotalPrice = unitPrice * (item.quantity || 1);
              const cartItemId = item.cartItemId || item.id; // Prefer cartItemId if available

              return (
                <div key={cartItemId} style={cartItemStyle} data-cart-item-id={cartItemId}>
                  <div style={cartItemImageContainerStyle}>
                    <img 
                        src={itemDisplayImage} 
                        style={cartItemImageStyle} 
                        alt={item.productType || 'Product'}
                        onError={(e) => { 
                            e.target.onerror = null; 
                            e.target.src = TSHIRT_COLOR_MAP[item.color] || DEFAULT_TSHIRT_IMAGE; 
                            console.warn("FinalCart: Error loading item image, used fallback:", itemDisplayImage);
                        }}
                    />
                  </div>
                  <div style={cartItemDetailsStyle}>
                    <div style={itemNameStyle}>{item.productType || 'Custom T-Shirt'}</div>
                    <ul style={itemSpecsListStyle}>
                      <li style={itemSpecsListItemStyle}><strong>Size:</strong> {item.size || 'N/A'}</li>
                      <li style={itemSpecsListItemStyle}><strong>Color:</strong> {item.color ? item.color.charAt(0).toUpperCase() + item.color.slice(1) : 'N/A'}</li>
                      <li style={itemSpecsListItemStyle}><strong>Thickness:</strong> {item.thicknessName || `${item.thickness || ''} GSM`}</li>
                      <li style={itemSpecsListItemStyle}><strong>Front:</strong> {formatCustomizationForDisplay(item.frontCustomization)}</li>
                      <li style={itemSpecsListItemStyle}><strong>Back:</strong> {formatCustomizationForDisplay(item.backCustomization)}</li>
                    </ul>
                    <div style={itemActionsStyle}>
                      <div style={quantityContainerCartStyle}>
                        <span style={quantityCartBtnSpanStyle} onClick={() => handleQuantityChange(cartItemId, (item.quantity || 1) - 1)}>-</span>
                        <span style={{...quantityCartBtnSpanStyle, borderRight: '1px solid #5D94A6', borderLeft: '1px solid #5D94A6', pointerEvents: 'none', cursor: 'default' }}>
                          {(item.quantity || 1).toString().padStart(2, '0')}
                        </span>
                        <span style={quantityCartBtnSpanStyle} onClick={() => handleQuantityChange(cartItemId, (item.quantity || 1) + 1)}>+</span>
                      </div>
                      <div style={itemPriceDisplayStyle}>₹{itemTotalPrice.toFixed(2)}</div>
                    </div>
                    <div style={viewDetailsLinkStyle} onClick={() => handleShowItemDetails(item)}>View details</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={cartSummaryPanelStyle}>
          <div style={summaryTitleStyle}>ORDER SUMMARY</div>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>Subtotal</span>
            <span style={summaryValueStyle}>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={summaryRowStyle}>
            <span style={{...summaryLabelStyle, color: '#4a7c8c', fontSize:'28px'}}>Total Customization Charges</span>
            <span style={{...summaryValueStyle, color: '#4a7c8c', fontSize:'28px'}}>₹{totalCustomizationCharges.toFixed(2)}</span>
          </div>
          <hr style={summaryDividerStyle} />

          {deliveryType && (
            <div style={deliveryInfoSummaryStyle}>
              <h4 style={{marginTop:0, marginBottom:'12px', color:'#00566F', fontSize:'30px', fontWeight:700}}>Delivery Method</h4>
              <p id="deliveryTypeDisplay" style={{margin:'6px 0', lineHeight:1.5}}>{deliveryType === 'home_delivery' ? 'Home Delivery To:' : 'Store Pickup By:'}</p>
              {deliveryType === 'home_delivery' && deliveryDetails && (
                <div id="deliveryAddressDisplay">
                  <p style={{margin:'6px 0', lineHeight:1.5}}><b>{deliveryDetails.firstName || ''} {deliveryDetails.lastName || ''}</b></p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>{deliveryDetails.addressLine1 || ''}</p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>{deliveryDetails.addressLine2 || ''}, Pincode: {deliveryDetails.pincode || ''}</p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>Ph: {deliveryDetails.phoneNumber || ''}</p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>Email: {deliveryDetails.emailAddress || ''}</p>
                </div>
              )}
              {deliveryType === 'store_pickup' && pickupDetails && (
                <div id="pickupContactDisplay">
                  <p style={{margin:'6px 0', lineHeight:1.5}}><b>{pickupDetails.pickupFirstName || ''} {pickupDetails.pickupLastName || ''}</b></p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>Ph: {pickupDetails.pickupPhoneNumber || ''}</p>
                  <p style={{margin:'6px 0', lineHeight:1.5}}>Email: {pickupDetails.pickupEmailAddress || ''}</p>
                </div>
              )}
            </div>
          )}
           {!deliveryType && (
             <div style={deliveryInfoSummaryStyle}>
                <p style={{margin:'6px 0', lineHeight:1.5, color: 'red'}}>Delivery method not selected. Please go back.</p>
             </div>
           )}

          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>Delivery Charges</span>
            <span style={summaryValueStyle}>₹{deliveryCharge.toFixed(2)}</span>
          </div>
          <hr style={summaryDividerStyle} />
          <div style={{...summaryRowStyle, marginTop:'10px'}}>
            <span style={{...summaryLabelStyle, color: '#00566F', fontSize: '48px', fontWeight: 800}}>Grand Total</span>
            <span style={{...summaryValueStyle, color: '#00566F', fontSize: '48px', fontWeight: 800}}>₹{grandTotal.toFixed(2)}</span>
          </div>
          <button 
            style={{...checkoutButtonStyle, backgroundColor: (!deliveryType || cartItems.length === 0) ? '#adb5bd' : '#00566F', cursor: (!deliveryType || cartItems.length === 0) ? 'not-allowed' : 'pointer' }} 
            onClick={handleCheckout}
            disabled={!deliveryType || cartItems.length === 0}
          >
            Confirm & Place Order
          </button>
        </div>
      </div>

      {selectedItemForModal && (
        <div style={modalOverlayStyle} onClick={handleCloseModal}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <img 
                src="/Size_Selection_Img/closeicon.png" 
                alt="Close" 
                style={modalCloseBtnStyle} 
                onClick={handleCloseModal}
            />
            <div style={modalHeaderStyle}>{selectedItemForModal.productType || 'Custom T-Shirt'} - Details</div>
            <div style={modalImageContainerStyle}>
              <img 
                src={selectedItemForModal.frontCustomization?.src || selectedItemForModal.backCustomization?.src || TSHIRT_COLOR_MAP[selectedItemForModal.color] || DEFAULT_TSHIRT_IMAGE} 
                style={modalImageStyle} 
                alt="Item Preview"
                onError={(e) => {e.target.onerror = null; e.target.src=TSHIRT_COLOR_MAP[selectedItemForModal.color] || DEFAULT_TSHIRT_IMAGE;}}
              />
            </div>
            <div style={modalDetailsGridStyle}>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Product:</span><span style={modalDetailsGridValueStyle}>{selectedItemForModal.productType || 'T-Shirt'}</span></div>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Quantity:</span><span style={modalDetailsGridValueStyle}>{selectedItemForModal.quantity}</span></div>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Color:</span><span style={modalDetailsGridValueStyle}>{selectedItemForModal.color ? selectedItemForModal.color.charAt(0).toUpperCase() + selectedItemForModal.color.slice(1) : 'N/A'}</span></div>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Size:</span><span style={modalDetailsGridValueStyle}>{selectedItemForModal.size || 'N/A'}</span></div>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Thickness:</span><span style={modalDetailsGridValueStyle}>{selectedItemForModal.thicknessName || `${selectedItemForModal.thickness || ''} GSM`}</span></div>
              <div style={modalDetailsGridItemStyle}><span style={modalDetailsGridLabelStyle}>Unit Price:</span><span style={modalDetailsGridValueStyle}>₹{(parseFloat(selectedItemForModal.calculatedUnitPrice) || 0).toFixed(2)}</span></div>
              
              <div style={{...modalDetailsGridItemStyle, gridColumn: '1 / -1', marginTop:'10px'}}><span style={{...modalDetailsGridLabelStyle, textAlign:'left'}}>Front Design:</span><span style={modalDetailsGridValueStyle}> {formatCustomizationForDisplay(selectedItemForModal.frontCustomization)}</span></div>
              {selectedItemForModal.frontCustomization?.position && (
                <div style={{...modalDetailsGridItemStyle, gridColumn: '1 / -1'}}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C', textAlign:'left'}}>    Position (W,H @ X,Y):</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}> {(selectedItemForModal.frontCustomization.position.width || 0).toFixed(0)},{(selectedItemForModal.frontCustomization.position.height || 0).toFixed(0)} @ {(selectedItemForModal.frontCustomization.position.x || 0).toFixed(0)},{(selectedItemForModal.frontCustomization.position.y || 0).toFixed(0)}px</span></div>
              )}
              
              <div style={{...modalDetailsGridItemStyle, gridColumn: '1 / -1', marginTop:'10px'}}><span style={{...modalDetailsGridLabelStyle, textAlign:'left'}}>Back Design:</span><span style={modalDetailsGridValueStyle}> {formatCustomizationForDisplay(selectedItemForModal.backCustomization)}</span></div>
               {selectedItemForModal.backCustomization?.position && (
                <div style={{...modalDetailsGridItemStyle, gridColumn: '1 / -1'}}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C', textAlign:'left'}}>    Position (W,H @ X,Y):</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}> {(selectedItemForModal.backCustomization.position.width || 0).toFixed(0)},{(selectedItemForModal.backCustomization.position.height || 0).toFixed(0)} @ {(selectedItemForModal.backCustomization.position.x || 0).toFixed(0)},{(selectedItemForModal.backCustomization.position.y || 0).toFixed(0)}px</span></div>
              )}

              {selectedItemForModal.priceBreakdown && (
                  <>
                    <div style={{...modalDetailsGridItemStyle, gridColumn: '1 / -1', marginTop:'25px', paddingTop:'20px', borderTop:'1px solid #aacdd9', color:'#00566F', fontWeight:700, fontSize:'40px'}}>Price Breakdown:</div>
                    <div style={modalDetailsGridItemStyle}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C'}}>Base Shirt (GSM):</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}>₹{(parseFloat(selectedItemForModal.priceBreakdown.baseGSM) || 0).toFixed(2)}</span></div>
                    <div style={modalDetailsGridItemStyle}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C'}}>Design Add-on:</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}>₹{(parseFloat(selectedItemForModal.priceBreakdown.designAddon) || 0).toFixed(2)}</span></div>
                    <div style={modalDetailsGridItemStyle}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C'}}>Front Print:</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}>₹{(parseFloat(selectedItemForModal.priceBreakdown.printFront) || 0).toFixed(2)}</span></div>
                    <div style={modalDetailsGridItemStyle}><span style={{...modalDetailsGridLabelStyle, fontSize:'32px', color:'#2C758C'}}>Back Print:</span><span style={{...modalDetailsGridValueStyle, fontSize:'32px', color:'#004053'}}>₹{(parseFloat(selectedItemForModal.priceBreakdown.printBack) || 0).toFixed(2)}</span></div>
                  </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalCartScreen;