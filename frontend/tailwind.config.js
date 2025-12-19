/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        adobe: {
          red: '#FF0000',
          dark: '#1B1B1B',
          gray: '#4B4B4B',
        },
      },
    },
  },
  plugins: [],
}
