/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0eeff',
          100: '#e2deff',
          200: '#c7bcff',
          300: '#a899ff',
          400: '#8b72ff',
          500: '#6c47ff',
          600: '#5a35e8',
          700: '#4825c5',
          800: '#3a1d9e',
          900: '#2e1780',
        },
      },
    },
  },
  plugins: [],
}
