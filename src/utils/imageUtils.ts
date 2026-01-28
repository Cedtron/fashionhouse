import { API_URL } from './environment';

/**
 * Helper function to construct proper image URLs from backend paths
 * @param imagePath - The image path from the backend (e.g., "/uploads/image.jpg" or "uploads/image.jpg")
 * @returns Complete image URL or null if no path provided
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) {
    console.log('🖼️ getImageUrl: No image path provided');
    return null;
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    console.log('🖼️ getImageUrl: Already full URL:', imagePath);
    return imagePath;
  }
  
  // Clean up the API URL - remove trailing slashes
  const cleanApiUrl = API_URL.replace(/\/+$/, '');
  
  // Clean up the image path - ensure it starts with /
  let cleanImagePath = imagePath.trim();
  if (!cleanImagePath.startsWith('/')) {
    cleanImagePath = `/${cleanImagePath}`;
  }
  
  // Construct the full URL
  const fullUrl = `${cleanApiUrl}${cleanImagePath}`;
  
  console.log('🖼️ IMAGE URL CONSTRUCTED:', { 
    originalPath: imagePath, 
    backendServer: API_URL,
    cleanApiUrl, 
    cleanImagePath, 
    finalUrl: fullUrl 
  });
  
  // Test if the URL is accessible
  console.log('🔗 Try this URL in browser:', fullUrl);
  
  return fullUrl;
}

/**
 * Helper function to handle image loading errors
 * @param event - The error event from img onError
 * @param fallbackElement - Optional fallback element to show (like initials)
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>, fallbackElement?: HTMLElement | null) {
  const img = event.currentTarget;
  console.error('❌ FAILED TO LOAD IMAGE:', img.src);
  console.error('❌ This means the backend is not serving static files from /uploads');
  console.error('❌ Backend needs to configure static file serving');
  
  // Hide the image
  img.style.display = 'none';
  
  // Show fallback if provided
  if (fallbackElement) {
    fallbackElement.classList.remove('hidden');
  }
}