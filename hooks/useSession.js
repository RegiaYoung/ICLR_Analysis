import { useState, useEffect } from 'react';

// Mock session hook for demo purposes
export function useSession() {
  const [data, setData] = useState(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    // Simulate loading session
    const timer = setTimeout(() => {
      // Mock session data - you can replace this with real authentication
      const mockSession = null; // Set to null for no session, or add user data for logged in
      // const mockSession = {
      //   user: {
      //     email: 'user@example.com',
      //     name: 'Demo User'
      //   }
      // };
      
      setData(mockSession);
      setIsPending(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { data, isPending };
}