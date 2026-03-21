'use client';

/**
 * CRM Connection Button
 *
 * Initiates HubSpot OAuth2 connection flow
 */

import { useState } from 'react';

interface CrmConnectButtonProps {
  onConnected?: () => void;
}

export function CrmConnectButton({ onConnected }: CrmConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/crm/connect', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to HubSpot OAuth
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Failed to connect CRM:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting...
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5 mr-2"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20.0833 5.99992C20.3655 5.99992 20.6362 6.11176 20.8355 6.31108C21.0349 6.5104 21.1467 6.78109 21.1467 7.06325V16.9366C21.1467 17.2188 21.0349 17.4894 20.8355 17.6888C20.6362 17.8881 20.3655 17.9999 20.0833 17.9999H3.91667C3.6345 17.9999 3.36381 17.8881 3.16449 17.6888C2.96517 17.4894 2.85333 17.2188 2.85333 16.9366V7.06325C2.85333 6.78109 2.96517 6.5104 3.16449 6.31108C3.36381 6.11176 3.6345 5.99992 3.91667 5.99992H5.67917V4.33325C5.67917 3.79277 5.90514 3.27446 6.30738 2.8924C6.70963 2.51034 7.255 2.29992 7.82083 2.29992H16.1792C16.745 2.29992 17.2904 2.51034 17.6926 2.8924C18.0949 3.27446 18.3208 3.79277 18.3208 4.33325V5.99992H20.0833ZM7.34583 5.99992H16.6542V4.33325C16.6542 4.15544 16.5836 3.98491 16.4578 3.85917C16.3321 3.73342 16.1615 3.66276 15.9833 3.66276H8.01667C7.83846 3.66276 7.66789 3.73342 7.54214 3.85917C7.4164 3.98491 7.34583 4.15544 7.34583 4.33325V5.99992ZM19.4792 16.3333V7.66659H4.52083V16.3333H19.4792ZM9.66667 13.6666C9.93389 13.6666 10.1902 13.5604 10.3794 13.3712C10.5686 13.182 10.6748 12.9257 10.6748 12.6585C10.6748 12.3913 10.5686 12.135 10.3794 11.9458C10.1902 11.7566 9.93389 11.6504 9.66667 11.6504C9.39945 11.6504 9.14312 11.7566 8.9539 11.9458C8.76468 12.135 8.65845 12.3913 8.65845 12.6585C8.65845 12.9257 8.76468 13.182 8.9539 13.3712C9.14312 13.5604 9.39945 13.6666 9.66667 13.6666ZM14.3333 13.6666C14.6006 13.6666 14.8569 13.5604 15.0461 13.3712C15.2353 13.182 15.3415 12.9257 15.3415 12.6585C15.3415 12.3913 15.2353 12.135 15.0461 11.9458C14.8569 11.7566 14.6006 11.6504 14.3333 11.6504C14.0661 11.6504 13.81 11.7566 13.6206 11.9458C13.4314 12.135 13.3252 12.3913 13.3252 12.6585C13.3252 12.9257 13.4314 13.182 13.6206 13.3712C13.81 13.5604 14.0661 13.6666 14.3333 13.6666Z" />
          </svg>
          Connect HubSpot
        </>
      )}
    </button>
  );
}
