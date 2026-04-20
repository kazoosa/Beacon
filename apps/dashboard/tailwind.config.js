/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface colors — CSS variables flip between light and dark
        bg: {
          base: "rgb(var(--bg-base) / <alpha-value>)",
          raised: "rgb(var(--bg-raised) / <alpha-value>)",
          overlay: "rgb(var(--bg-overlay) / <alpha-value>)",
          hover: "rgb(var(--bg-hover) / <alpha-value>)",
          inset: "rgb(var(--bg-inset) / <alpha-value>)",
        },
        border: {
          subtle: "rgb(var(--border-subtle) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        // Semantic text colors
        fg: {
          primary: "rgb(var(--fg-primary) / <alpha-value>)",
          secondary: "rgb(var(--fg-secondary) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
          fainter: "rgb(var(--fg-fainter) / <alpha-value>)",
        },
        accent: {
          green: "#10b981",
          red: "#ef4444",
          blue: "#60a5fa",
          amber: "#fbbf24",
          purple: "#a78bfa",
          indigo: "#818cf8",
          brand: "#7c6aff",
          "brand-from": "#8b5cf6",
          "brand-to": "#5b8def",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #8b5cf6 0%, #5b8def 100%)",
        "mesh-dark":
          "radial-gradient(at 15% 20%, rgba(139, 92, 246, 0.14) 0px, transparent 50%), radial-gradient(at 85% 10%, rgba(91, 141, 239, 0.1) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%)",
        "mesh-light":
          "radial-gradient(at 15% 20%, rgba(139, 92, 246, 0.08) 0px, transparent 50%), radial-gradient(at 85% 10%, rgba(91, 141, 239, 0.06) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.04) 0px, transparent 50%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
