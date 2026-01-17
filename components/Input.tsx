import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, error, suffix, className = '', id, ...props }) => {
  const inputId = id || props.name || Math.random().toString(36).substr(2, 9);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`appearance-none block w-full pl-4 ${suffix ? 'pr-10' : 'pr-4'} py-3 bg-zinc-50 border ${error ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500' : 'border-zinc-200 focus:ring-indigo-200 focus:border-indigo-500'} rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all duration-200 sm:text-sm ${className}`}
          {...props}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {suffix}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 ml-1 text-sm text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export default Input;