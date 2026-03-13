/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'tablet': '768px',
        // tablet-first defaults
      },
      fontSize: {
        'xxs': '0.65rem',
      },
    },
  },
  plugins: [],
}

