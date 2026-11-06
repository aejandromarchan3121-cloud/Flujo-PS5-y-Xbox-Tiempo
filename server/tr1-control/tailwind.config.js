module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { carbon: '#0B0C10', industrial: '#1F2833', neon: '#FFE600', gold: '#FFD700' },
      fontFamily: { display: ['var(--font-display)', 'sans-serif'], body: ['var(--font-body)', 'sans-serif'] },
      keyframes: {
        eq: { '0%,100%': { height: '15%' }, '50%': { height: '100%' } },
        blinkred: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
        stripes: { to: { backgroundPosition: '80px 0' } },
      },
      animation: {
        eq: 'eq 0.9s ease-in-out infinite',
        blinkred: 'blinkred 0.9s steps(2) infinite',
        stripes: 'stripes 1.2s linear infinite',
      },
    },
  },
  plugins: [],
}