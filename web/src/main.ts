import { createApp } from 'vue';
import App from './App.vue';
import Playground from './Playground.vue';
import './style.css';

const root = window.location.pathname.startsWith('/playground') ? Playground : App;
createApp(root).mount('#app');
