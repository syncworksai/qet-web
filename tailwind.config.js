/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        text: "var(--text)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        accent: "var(--accent)",
      },
      boxShadow: { soft: "0 10px 25px rgba(0,0,0,0.35)" },
      borderRadius: { xl2: "1rem" },
    },
  },
  plugins: [],
}
