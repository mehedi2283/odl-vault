import React, { useState, useEffect } from 'react';

interface CipherTextProps {
  text: string;
  speed?: number;
  revealDelay?: number;
}

const CipherText: React.FC<CipherTextProps> = ({ text, speed = 30, revealDelay = 0 }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

  useEffect(() => {
    let currentIndex = 0;
    let iterations = 0;
    const interval = setInterval(() => {
      if (currentIndex >= text.length) {
        clearInterval(interval);
        return;
      }

      const randomChars = text
        .split('')
        .map((char, index) => {
          if (index < currentIndex) return text[index];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');

      setDisplay(randomChars);

      if (iterations > (revealDelay / speed) + 2) { // Add some delay logic if needed
        currentIndex += 1/3; // Slower reveal
      }
      iterations++;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, revealDelay]);

  return <span>{display || text}</span>;
};

export default CipherText;