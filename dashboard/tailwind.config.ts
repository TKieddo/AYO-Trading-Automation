import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Apple-inspired dark palette with deep blacks and subtle grays
        primary: {
          DEFAULT: "#0A0A0A", // near‑black for buttons/surfaces
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#1F2937", // slate focus ring / chips
          soft: "#111827",
        },
        success: {
          DEFAULT: "rgb(34, 197, 94)",
          dark: "rgb(22, 163, 74)",
        },
        danger: {
          DEFAULT: "rgb(239, 68, 68)",
          dark: "rgb(220, 38, 38)",
        },
        card: {
          DEFAULT: "rgba(255,255,255,0.6)",
          dark: "rgba(17, 24, 39, 0.6)",
        },
      },
      borderRadius: {
        lg: "20px",
        xl: "28px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      boxShadow: {
        glass: "0 1px 0 rgba(255,255,255,0.08) inset, 0 8px 30px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;

