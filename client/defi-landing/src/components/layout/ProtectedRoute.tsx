import { Navigate } from 'react-router-dom';
import { useWeb3Mock } from '../../hooks/useWeb3Mock';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWeb3Mock();

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
