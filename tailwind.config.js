/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#EEF2F6",
          secondary: "#F8FAFC",
          tertiary: "#FFFFFF",
          panel: "#E5EAF1",
          scene: "#101820",
        },
        primary: {
          yellow: "#C99A2E",
          red: "#B42318",
          blue: "#1F2937",
          orange: "#B54708",
        },
        text: {
          DEFAULT: "#182230",
          muted: "#667085",
          yellow: "#9A6700",
        },
        accent: {
          safe: "#087443",
          danger: "#B42318",
          warn: "#9A6700",
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        "breathe-red": "breatheRed 1.5s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        breatheRed: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.8" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(255,230,0,0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(255,230,0,0.6)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
