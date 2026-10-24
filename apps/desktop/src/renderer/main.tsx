import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';
import { applyStoredAppearance } from './lib/appearance';
import { Backdrop } from './components/Backdrop';

applyStoredAppearance();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outside <App> so no screen change (splash, login, shell) restarts it. */}
    <Backdrop />
    <App />
  </React.StrictMode>,
);
