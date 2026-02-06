import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aviation: {
          50: "#eff9ff",
          100: "#dff3ff",
          200: "#b9e7ff",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
      },
      boxShadow: {
        glass: "0 20px 80px rgba(2, 132, 199, 0.18)",
      },
      backgroundImage: {
        "aviation-radial": "radial-gradient(circle at top left, rgba(56, 189, 248, 0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.18), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
