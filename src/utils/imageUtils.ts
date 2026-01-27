import { API_URL } from './environment';

/**
 * Helper function to construct proper image URLs from backend paths
 * @param imagePath - The image path from the backend (e.g., "/uploads/image.jpg" or "uploads/image.jpg")
 * @returns Complete image URL or null if no path provided
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  // Clean up the API URL - remove trailing slashes
  const cleanApiUrl = API_URL.replace(/\/+$/, '');
  
  // Clean up the image path - ensure it starts with /
  let cleanImagePath = imagePath.trim();
  if (!cleanImagePath.startsWith('/')) {
    cleanImagePath = `/${cleanImagePath}`;
  }
  
  // Construct the full URL
  const fullUrl = `${cleanApiUrl}${cleanImagePath}`;
  
  console.log('Image URL constructed:', { imagePath, cleanApiUrl, cleanImagePath, fullUrl });
  
  return fullUrl;
}

/**
 * Helper function to handle image loading errors
 * @param event - The error event from img onError
 * @param fallbackElement - Optional fallback element to show (like initials)
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>, fallbackElement?: HTMLElement | null) {
  const img = event.currentTarget;
  console.error('Failed to load image:', img.src);
  
  // Hide the image
  img.style.display = 'none';
  
  // Show fallback if provided
  if (fallbackElement) {
    fallbackElement.classList.remove('hidden');
  }
}