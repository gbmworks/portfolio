import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative, so the built app runs from whatever folder it is dropped in.
  // The portfolio serves it from studio/eyewear/, and every runtime asset is
  // already fetched through import.meta.env.BASE_URL -- which this sets to
  // './' -- so the models, the HDRI, materials.csv and the MediaPipe wasm all
  // resolve against the document rather than against the host's root.
  base: './',
  server: {
    port: 5180,
    // getUserMedia needs a secure context. localhost counts as one, so plain
    // http is fine on this machine; testing from a phone on the LAN will not
    // work without https.
    host: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // three and the mediapipe wasm glue are both large and independent of
        // app code. Splitting them keeps app rebuilds off the critical path.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@mediapipe/tasks-vision')) return 'mediapipe';
          return undefined;
        },
      },
    },
  },
});
