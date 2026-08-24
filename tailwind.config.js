/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./entrypoints/**/*.{html,ts,tsx}",
    "./components/**/*.{html,ts,tsx}",
    "./src/**/*.{html,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#09090B',       // Zinc-950 dark background
        darkCard: '#18181B',     // Zinc-900 card background
        darkBorder: '#27272A',   // Zinc-800 border
        accentCyan: '#FFFFFF',   // Minimalist White
        accentGreen: '#E4E4E7',  // Light Grey (zinc-200)
        accentPurple: '#A1A1AA', // Neutral Grey (zinc-400)
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
