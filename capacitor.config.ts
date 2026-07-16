import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cm.dabby.market",
  appName: "DabbyMarket",
  webDir: "dist",
  backgroundColor: "#121212",
  android: {
    backgroundColor: "#121212",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
