/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  '#FDFAF4',
          100: '#F9F2E3',
          200: '#F5ECD7',
          300: '#EDD9B8',
          400: '#D9BC8A',
        },
        rose: {
          warm:   '#C9705A',
          deep:   '#9B3D2C',
        },
        clay: {
          light: '#B5947A',
          mid:   '#8C6246',
          dark:  '#5C3D2E',
        },
        ink: {
          soft:  '#3D2B1F',
          full:  '#1A0F09',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
