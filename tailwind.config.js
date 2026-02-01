/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        'dot-navy': '#0a1628',
        'dot-blue': '#1e3a5f',
        'dot-slate': '#334155',
        'dot-orange': '#ea580c',
        'dot-yellow': '#f59e0b',
        'safety-green': '#16a34a',
        'dot-green': '#4a7c59',
        'fv-navy': '#0a1628',
        'fv-blue': '#1e3a5f',
        'fv-orange': '#ea580c',
        'fv-orange-dark': '#c94d08',
        'fv-yellow': '#f59e0b',
        'fv-green': '#16a34a',
      },
      fontFamily: {
        'system': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
