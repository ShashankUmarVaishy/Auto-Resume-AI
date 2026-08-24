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
        darkBg: '#090D16',       // Deepest dark blue-grey background
        darkCard: '#131A26',     // Premium card background
        darkBorder: '#1E293B',   // Border color
        accentCyan: '#06B6D4',   // Cyberpunk Cyan
        accentGreen: '#10B981',  // Success Emerald
        accentPurple: '#8B5CF6', // Pro Feature Purple
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
