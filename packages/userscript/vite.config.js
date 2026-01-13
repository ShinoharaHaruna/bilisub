import { userscript } from "vite-plugin-userscript";

export default {
  appType: "custom",
  plugins: [userscript()],
  build: {
    outDir: "dist",
  },
};
