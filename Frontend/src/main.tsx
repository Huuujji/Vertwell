import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import './frontend.css';
import './screens.css';
import './responsive.css';
import './navigation.css';
import './auth.css';
import './admin.css';
import './staff.css';
import './redesign.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
