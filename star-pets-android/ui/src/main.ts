/// <reference types="vite/client" />
import '@fontsource/baloo-2/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/material.css';
import './styles/motion.css';
import { createApp } from 'vue';
import App from './App.vue';
import { installMobileLayout } from './mobile-layout';
createApp(App).mount('#app');
const disposeLayout = installMobileLayout();
if (import.meta.hot) import.meta.hot.dispose(disposeLayout);
