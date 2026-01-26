import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { getToken, getUser } from '../../utils/auth';

export default function AuthDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const info = {
      // From localStorage
      tokenFromStorage: localStorage.getItem('token'),
      userFromStorage: localStorage.getItem('user'),
      
      // From cookies
      tokenFromCookies: Cookies.get('token'),
      userFromCookies: Cookies.get('user'),
      
      // From auth utils
      tokenFromUtils: getToken(),
      userFromUtils: getUser(),
      
      // All cookies
      allCookies: Cookies.get(),
      
      // Environment
      apiUrl: import.meta.env.VITE_API_URL,
    };
    
    setDebugInfo(info);
    console.log('Auth Debug Info:', info);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-md max-h-96 overflow-auto z-50">
      <h3 className="font-bold text-sm mb-2">Auth Debug Info</h3>
      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
      <button 
        onClick={() => setDebugInfo({})}
        className="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded"
      >
        Close
      </button>
    </div>
  );
}