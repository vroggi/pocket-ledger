import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'offline',base:'/offline/',plugins:[react()],publicDir:false,build:{outDir:'../public/offline',emptyOutDir:true}});
