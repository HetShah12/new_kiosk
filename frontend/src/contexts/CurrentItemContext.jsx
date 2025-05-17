// frontend/src/contexts/CurrentItemContext.js (REFINED EXAMPLE)
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

// Define a more complete default item structure
// Ensure DEFAULT_CUSTOMIZATION_POSITION is always available
const DEFAULT_POS = { x: 10, y: 10, width: 150, height: 50 };

export const initialCurrentItemState = {
  id: Date.now(), // Initialize with an ID
  productType: 'T-Shirt',
  size: null,
  thickness: null,
  thicknessName: null,
  color: 'black',
  quantity: 1,
  frontCustomization: null,
  backCustomization: null,
  DEFAULT_CUSTOMIZATION_POSITION: DEFAULT_POS, // Directly part of the item's structure
  basePrice: 0,
  customizationPrice: 0,
  calculatedUnitPrice: 0,
  priceBreakdown: {},
  productVariant: null,
  _blobUrls: [],
};

const CurrentItemContext = createContext(undefined); // Initialize with undefined or a default shape

export const useCurrentItem = () => {
  const context = useContext(CurrentItemContext);
  if (context === undefined) {
    throw new Error('useCurrentItem must be used within a CurrentItemProvider');
  }
  return context;
};

export const CurrentItemProvider = ({ children }) => {
  const [currentItem, setCurrentItemState] = useState(initialCurrentItemState);

  // Log currentItem whenever it changes for debugging
  useEffect(() => {
    console.log("CurrentItemContext: currentItem updated", JSON.parse(JSON.stringify(currentItem)));
  }, [currentItem]);

  const updateCurrentItem = useCallback((updates) => {
    setCurrentItemState(prevItem => ({ ...prevItem, ...updates }));
  }, []);
  currentItem.frontCustomization = {
    type: 'multi_library_design', // New type
    elements: [ // Array of designs placed
        { designId: 'sw1', src: '/library_designs/swone.png', name: 'Graffiti Blast', price: 20, position: {x: 10, y: 10, width: 100, height: 100}, quadrant: 0 }, // quadrant: 0, 1, 2, or 3
        { designId: 'min1', src: '/library_designs/minimalone.png', name: 'Simple Wave', price: 20, position: {x: 5, y: 5, width: 80, height: 80}, quadrant: 2 },
        // Potentially up to 4 elements
    ]
};

  const setCustomization = useCallback((side, customizationData) => {
    setCurrentItemState(prevItem => {
      const newItem = { ...prevItem };
      if (side === 'front') {
        newItem.frontCustomization = customizationData;
      } else if (side === 'back') {
        newItem.backCustomization = customizationData;
      }
      const frontPrice = newItem.frontCustomization?.price || 0;
      const backPrice = newItem.backCustomization?.price || 0;
      newItem.customizationPrice = frontPrice + backPrice;

      const updatedItem = { ...prevItem, [key]: finalCustomizationData };
        console.log("CurrentItemContext (setCustomization): currentItem updated. New state:", JSON.parse(JSON.stringify(updatedItem)));
        return updatedItem;
      return newItem;
    });
  }, []);

  // Function to revoke all blob URLs associated with a specific item's _blobUrls array
  const revokeTheseBlobUrls = useCallback((blobUrlsArray) => {
    if (blobUrlsArray && blobUrlsArray.length > 0) {
      console.log("CurrentItemContext: Revoking blob URLs:", blobUrlsArray);
      blobUrlsArray.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn("Error revoking URL:", url, e);
        }
      });
    }
  }, []);


  const clearCurrentItemForNewProduct = useCallback(() => {
    // Revoke blobs from the item *before* it's replaced
    if (currentItem && currentItem._blobUrls) {
        revokeTheseBlobUrls(currentItem._blobUrls);
    }
    setCurrentItemState({
      ...initialCurrentItemState, // Reset to initial structure
      id: Date.now(), // Generate a new ID
      // DEFAULT_CUSTOMIZATION_POSITION is part of initialCurrentItemState
      _blobUrls: [], // Ensure blob URLs are fresh for the new item
    });
  }, [currentItem, revokeTheseBlobUrls]); // currentItem needed to access its _blobUrls

  const addBlobUrlToItem = useCallback((blobUrl) => {
    setCurrentItemState(prev => {
      // Ensure _blobUrls exists and is an array
      const existingBlobUrls = Array.isArray(prev._blobUrls) ? prev._blobUrls : [];
      return {
          ...prev,
          _blobUrls: [...existingBlobUrls, blobUrl]
      };
    });
  }, []);

  // This specific function is for revoking the current item's blobs
  // It's a bit redundant if clearCurrentItemForNewProduct handles it,
  // but might be useful if you need to revoke without clearing.
  const revokeItemBlobUrls = useCallback(() => {
    if (currentItem && currentItem._blobUrls) {
        revokeTheseBlobUrls(currentItem._blobUrls);
        // Optionally clear them from the current state too if not clearing the whole item
        setCurrentItemState(prev => ({...prev, _blobUrls: []}));
    }
  }, [currentItem, revokeTheseBlobUrls]);


  const contextValue = {
    currentItem,
    setCurrentItem: setCurrentItemState, // Direct state setter
    updateCurrentItem,
    setCustomization,
    clearCurrentItemForNewProduct,
    DEFAULT_CUSTOMIZATION_POSITION: currentItem.DEFAULT_CUSTOMIZATION_POSITION, // Get from currentItem
    addBlobUrlToItem,
    revokeItemBlobUrls, // Expose the specific function for the current item
  };

  return (
    <CurrentItemContext.Provider value={contextValue}>
      {children}
    </CurrentItemContext.Provider>
  );
};