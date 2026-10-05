import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AutoDevProviders } from './providers';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Target container '#root' was not found in the DOM.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AutoDevProviders>
      <App />
    </AutoDevProviders>
  </React.StrictMode>
);
