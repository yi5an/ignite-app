/** @type {import('tailwindcss').Config} */

// Ignite Design Tokens — merged from design-tokens/tailwind.config.ignite.js
// Extracted from prototype.html (authoritative design spec)

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Background / Surface ───
        bg:      '#0A0A0F',
        surface: '#111118',
        card:    '#18181F',
        card2:   '#1E1E28',
        border:  '#2A2A38',
        border2: '#333345',

        // ─── Brand Colors ───
        blue:     '#4F8EF7',
        blue2:    '#3B7BF5',
        green:    '#34D399',
        amber:    '#FBBF24',
        purple:   '#A78BFA',

        // ─── Text Hierarchy ───
        text:     '#E8E8F0',
        text2:    '#8888A0',
        text3:    '#55556A',

        // ─── Category Aliases ───
        work:     '#4F8EF7',
        study:    '#34D399',
        creative: '#A78BFA',

        // ─── Glow (semi-transparent backgrounds) ───
        'blueglow':   'rgba(79,142,247,0.18)',
        'greenglow':  'rgba(52,211,153,0.15)',
        'amberglow':  'rgba(251,191,36,0.15)',
        'purpleglow': 'rgba(167,139,250,0.12)',

        // ─── Phone Frame ───
        phonebg:  '#0D0D14',
        notchcam: '#1A1A22',
      },

      fontFamily: {
        heading: ["'Syne'", 'sans-serif'],
        body:    ["'DM Sans'", 'sans-serif'],
        mono:    ["'DM Mono'", 'monospace'],
      },

      fontSize: {
        // Semantic names matching prototype usage
        'logo':      ['28px', { lineHeight: '1.1', letterSpacing: '-0.5px' }],
        'greeting':  ['20px', { lineHeight: '1.3', letterSpacing: '-0.3px' }],
        'stat-num':  ['20px', { lineHeight: '1.1', letterSpacing: '-0.5px' }],
        'section':   ['18px', { lineHeight: '1.3' }],
        'timer':     ['28px', { lineHeight: '1', letterSpacing: '-1px' }],
        'streak':    ['15px', { lineHeight: '1.2' }],
        'focus-task':['15px', { lineHeight: '1.3' }],
        'body-sm':   ['13px', { lineHeight: '1.5' }],
        'body-xs':   ['12px', { lineHeight: '1.5' }],
        'tag':       ['9px',  { lineHeight: '1.4' }],
        'micro':     ['8px',  { lineHeight: '1.3' }],
      },

      spacing: {
        'xs':  '4px',
        'sm':  '8px',
        'md':  '12px',
        'lg':  '16px',
        'xl':  '24px',
        '2xl': '32px',
      },

      borderRadius: {
        'sm':   '10px',
        'md':   '16px',
        'lg':   '22px',
        'xl':   '28px',
        'pill': '99px',
        'phone':'44px',
      },

      boxShadow: {
        'phone':       'inset 0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(79,142,247,0.06)',
        'phone-hover': 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px rgba(0,0,0,0.7), 0 0 100px rgba(79,142,247,0.1)',
        'btn':         '0 4px 20px rgba(79,142,247,0.3)',
        'btn-hover':   '0 6px 28px rgba(79,142,247,0.4)',
        'fab':         '0 4px 20px rgba(79,142,247,0.4)',
        'fab-hover':   '0 6px 28px rgba(79,142,247,0.55)',
        'step-done':   '0 0 8px rgba(52,211,153,0.15)',
        'milestone':   '0 0 8px rgba(167,139,250,0.4)',
      },

      transitionTimingFunction: {
        'out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        '75':  '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '600': '600ms',
        '1000':'1000ms',
      },

      backgroundImage: {
        'btn-primary':  'linear-gradient(135deg, #3B7BF5, #4F8EF7)',
        'fab':          'linear-gradient(135deg, #3B7BF5, #4F8EF7)',
        'logo':         'linear-gradient(135deg, #4F8EF7 0%, #A78BFA 100%)',
        'prog-work':    'linear-gradient(90deg, #3B7BF5, #4F8EF7)',
        'prog-study':   'linear-gradient(90deg, #10B981, #34D399)',
        'prog-creative':'linear-gradient(90deg, #7C3AED, #A78BFA)',
        'streak-glow':  'linear-gradient(90deg, rgba(251,191,36,0.15) 0%, transparent 60%)',
        'timer-glow':   'radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.18) 0%, transparent 70%)',
        'btn-overlay':  'linear-gradient(135deg, transparent, rgba(255,255,255,0.1))',
      },

      keyframes: {
        flicker: {
          '0%':   { transform: 'scale(1) rotate(-2deg)' },
          '50%':  { transform: 'scale(1.1) rotate(1deg)' },
          '100%': { transform: 'scale(0.95) rotate(-1deg)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.6', transform: 'scale(0.8)' },
        },
        'pulse-blue': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(79,142,247,0.4)' },
          '50%':      { boxShadow: '0 0 0 4px rgba(79,142,247,0.1)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%':           { transform: 'translateY(-4px)', opacity: '1' },
        },
        'fade-in': {
          to: { opacity: '1' },
        },
      },

      animation: {
        flicker:    'flicker 2s ease-in-out infinite alternate',
        'pulse-dot':'pulse-dot 2s ease-in-out infinite',
        'pulse-blue':'pulse-blue 2s ease-in-out infinite',
        blink:      'blink 1s step-end infinite',
        'dot-bounce':'dot-bounce 1.2s ease-in-out infinite',
        'fade-in':  'fade-in 0.2s forwards',
      },
    },
  },
  plugins: [],
};
