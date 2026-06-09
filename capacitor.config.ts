import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nathanielschool.groovemetronome",
  appName: "NSM Groove Metronome",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
  },
};

export default config;
