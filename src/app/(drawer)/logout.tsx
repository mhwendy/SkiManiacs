import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { clearSession } from '@/features/auth/session';

export default function LogoutScreen() {
  useEffect(() => {
    void clearSession();
  }, []);

  return <Redirect href="/" />;
}
