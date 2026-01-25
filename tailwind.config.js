/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      spacing: {
        15: "3.75rem", // 60px for mb-15, mt-15
      },
    },
  },
  corePlugins: {
    preflight: true, // Enable base styles
  },
  plugins: [],
};
