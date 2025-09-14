import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Device type detection
export const isSmallScreen = screenWidth < 375; // iPhone SE, older devices
export const isMediumScreen = screenWidth >= 375 && screenWidth < 414; // iPhone 12/13/14
export const isLargeScreen = screenWidth >= 414; // iPhone Plus, Pro Max
export const isTablet = screenWidth >= 768;

// Screen dimensions
export const SCREEN_WIDTH = screenWidth;
export const SCREEN_HEIGHT = screenHeight;

// Status bar height
export const getStatusBarHeight = () => {
  if (Platform.OS === 'ios') {
    return 44; // Standard iOS status bar height
  }
  return StatusBar.currentHeight || 24;
};

// Responsive scaling functions
export const scale = (size: number): number => {
  const baseWidth = 375; // iPhone X/11/12/13/14 base width
  return (screenWidth / baseWidth) * size;
};

export const verticalScale = (size: number): number => {
  const baseHeight = 812; // iPhone X/11/12/13/14 base height
  return (screenHeight / baseHeight) * size;
};

export const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

// Font scaling with minimum and maximum limits
export const scaledFont = (size: number): number => {
  const scaled = moderateScale(size, 0.3);
  
  if (isSmallScreen) {
    return Math.max(scaled * 0.9, size * 0.8); // Minimum 80% of original
  }
  if (isLargeScreen) {
    return Math.min(scaled * 1.1, size * 1.2); // Maximum 120% of original
  }
  return scaled;
};

// Spacing scaling
export const scaledSpacing = (size: number): number => {
  if (isSmallScreen) {
    return Math.max(scale(size) * 0.8, size * 0.7);
  }
  if (isLargeScreen) {
    return Math.min(scale(size) * 1.1, size * 1.3);
  }
  return scale(size);
};

// Responsive padding/margin
export const getResponsivePadding = () => {
  if (isSmallScreen) return 12;
  if (isMediumScreen) return 16;
  if (isLargeScreen) return 20;
  return 24; // Tablet
};

export const getResponsiveMargin = () => {
  if (isSmallScreen) return 8;
  if (isMediumScreen) return 12;
  if (isLargeScreen) return 16;
  return 20; // Tablet
};

// Button dimensions
export const getButtonHeight = () => {
  if (isSmallScreen) return 44;
  if (isMediumScreen) return 48;
  return 52;
};

// Icon sizes
export const getIconSize = (baseSize: number = 24) => {
  if (isSmallScreen) return Math.max(baseSize * 0.85, 20);
  if (isLargeScreen) return Math.min(baseSize * 1.15, baseSize + 6);
  return baseSize;
};

// Logo/Image scaling
export const getLogoSize = () => {
  if (isSmallScreen) return { width: 140, height: 140 };
  if (isMediumScreen) return { width: 160, height: 160 };
  if (isLargeScreen) return { width: 183, height: 183 };
  return { width: 200, height: 200 }; // Tablet
};

// Brand name font size
export const getBrandNameFontSize = () => {
  if (isSmallScreen) return 38;
  if (isMediumScreen) return 45;
  if (isLargeScreen) return 53;
  return 60; // Tablet
};

// Card dimensions
export const getCardPadding = () => {
  if (isSmallScreen) return 12;
  if (isMediumScreen) return 16;
  return 20;
};

// Modal width
export const getModalWidth = () => {
  if (isTablet) return screenWidth * 0.7;
  return screenWidth * 0.9;
};

// Safe area padding
export const getSafeAreaPadding = () => {
  const statusBarHeight = getStatusBarHeight();
  const basePadding = getResponsivePadding();
  
  return {
    top: Platform.OS === 'android' ? Math.max(statusBarHeight + basePadding, 40) : basePadding,
    horizontal: basePadding,
    bottom: basePadding
  };
};

// Input field height
export const getInputHeight = () => {
  if (isSmallScreen) return 44;
  if (isMediumScreen) return 48;
  return 52;
};

// Helper function to create responsive styles
export const createResponsiveStyles = () => {
  const padding = getResponsivePadding();
  const margin = getResponsiveMargin();
  const buttonHeight = getButtonHeight();
  const inputHeight = getInputHeight();
  const logoSize = getLogoSize();
  const brandNameFontSize = getBrandNameFontSize();
  
  return {
    padding,
    margin,
    buttonHeight,
    inputHeight,
    logoSize,
    brandNameFontSize,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    isTablet
  };
};

export default {
  scale,
  verticalScale,
  moderateScale,
  scaledFont,
  scaledSpacing,
  getResponsivePadding,
  getResponsiveMargin,
  getButtonHeight,
  getIconSize,
  getLogoSize,
  getBrandNameFontSize,
  getCardPadding,
  getModalWidth,
  getSafeAreaPadding,
  getInputHeight,
  createResponsiveStyles,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
  isTablet,
  SCREEN_WIDTH,
  SCREEN_HEIGHT
};