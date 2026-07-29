import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { SessionModeProvider } from '@/shared/contexts/SessionModeContext';
import { BusinessProvider } from '@/shared/contexts/BusinessContext';
import { DogProvider } from '@/shared/contexts/DogContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SessionModeProvider>
        <BusinessProvider>
          <DogProvider>
            <App />
          </DogProvider>
        </BusinessProvider>
      </SessionModeProvider>
    </AuthProvider>
  </StrictMode>
);
