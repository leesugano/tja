import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "SF Pro Text",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "system-ui",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 14px 40px rgba(0, 0, 0, 0.12)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        glow: "0 0 0 1px rgba(255, 255, 255, 0.6), 0 12px 28px rgba(15, 23, 42, 0.15)"
      },
      colors: {
        ink: {
          50: "#f6f7fb",
          100: "#e5e8f1",
          200: "#c5ccde",
          300: "#a3aec7",
          400: "#7f8baa",
          500: "#65718f",
          600: "#4c5670",
          700: "#3b4458",
          800: "#2a3142",
          900: "#1d2230"
        },
        tide: {
          50: "#f5fbff",
          100: "#dff2ff",
          200: "#b7e3ff",
          300: "#7dc8ff",
          400: "#52abff",
          500: "#2f85f7",
          600: "#1f64d0",
          700: "#1d4ea7",
          800: "#1b3b7d",
          900: "#182e5f"
        },
        salmon: {
          400: "#ff7a6b",
          500: "#ff5c4d",
          600: "#e24a3c"
        },
        matcha: {
          300: "#b1e1a5",
          400: "#7fcd78",
          500: "#58b761"
        }
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem"
      }
    }
  },
  plugins: []
};

export default config;
