import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-700 ml-1">{label}</label>}
      <input
        className={`block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;