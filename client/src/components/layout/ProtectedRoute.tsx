import { Navigate } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWeb3();

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
