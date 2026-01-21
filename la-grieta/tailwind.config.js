/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './web/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6B21A8',
        'primary-light': '#9333EA',
        'primary-dark': '#4C1D95',
        accent: '#F59E0B',
        'accent-light': '#FBBF24',
        jade: '#059669',
        'jade-light': '#10B981',
        fury: '#DC2626',
        calm: '#16A34A',
        mind: '#2563EB',
        body: '#EA580C',
        chaos: '#9333EA',
        order: '#EAB308'
      },
      fontFamily: {
        heading: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
        card: ['Source Sans Pro', 'sans-serif']
      }
    }
  },
  plugins: []
};
