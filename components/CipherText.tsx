import React, { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()_+-=[]{}|;:,.<>?';

interface CipherTextProps {
  text: string;
  className?: string;
  revealDelay?: number; // ms to wait before starting
  speed?: number; // ms per frame
}

const CipherText: React.FC<CipherTextProps> = ({ text, className = '', revealDelay = 0, speed = 30 }) => {
  const [display, setDisplay] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    
    // Initial random state
    setDisplay(
        Array(text.length).fill(0).map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
    );

    timeout = setTimeout(() => {
        let iteration = 0;
        
        interval = setInterval(() => {
            setDisplay(prev => {
                const result = text.split('').map((char, index) => {
                    if (index < iteration) {
                        return text[index];
                    }
                    return CHARS[Math.floor(Math.random() * CHARS.length)];
                }).join('');
                
                if (iteration >= text.length) {
                    clearInterval(interval);
                    setIsRevealed(true);
                }
                
                return result;
            });
            
            // Dynamic speed: faster for longer text to avoid long wait times
            // Base increment is 1 char per tick. For long text (>30 chars), accelerate.
            const increment = Math.max(1, Math.floor(text.length / 20));
            iteration += increment;
        }, speed);
        
    }, revealDelay);

    return () => {
        clearTimeout(timeout);
        clearInterval(interval);
    };
  }, [text, revealDelay, speed]);

  return <span className={className}>{display}</span>;
};

export default CipherText;