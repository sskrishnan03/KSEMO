import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Parse the URL hash for access token
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      // Send error to parent window
      window.opener?.postMessage({
        type: 'oauth_callback',
        error: error,
      }, window.location.origin);
    } else if (accessToken) {
      // Send access token to parent window
      window.opener?.postMessage({
        type: 'oauth_callback',
        access_token: accessToken,
      }, window.location.origin);
    }

    // Close the popup
    window.close();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white">Authenticating...</p>
      </div>
    </div>
  );
}
