module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        crm: {
          ink: '#0f172a',
          blue: '#2563eb',
          sky: '#38bdf8',
          mint: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          paper: '#f8fafc',
        },
      },
      boxShadow: {
        crm: '0 24px 70px rgba(15, 23, 42, 0.12)',
        lift: '0 16px 40px rgba(15, 23, 42, 0.08)',
      },
      backgroundImage: {
        'crm-grid':
          'linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
