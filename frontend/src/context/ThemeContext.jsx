import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bunkclub_theme') || 'dark';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('bunkclub_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);