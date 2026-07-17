/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f0fbfd',
          100: '#dff5fa',
          200: '#b8e8f2',
          300: '#70cad2', // ocean.co.th light teal
          400: '#19d3e8', // ocean.co.th bright cyan
          500: '#00a0cd', // Ocean Life signature color (site primary)
          600: '#0096a8',
          700: '#006f99',
          800: '#00597a',
          900: '#31456a', // ocean.co.th navy
          950: '#1f2d47',
        },
        sunset: {
          400: '#fdba43', // ocean.co.th CTA highlight
          500: '#fa9628', // ocean.co.th CTA orange
          600: '#e8791a',
        }
      }
    },
  },
  plugins: [],
};
