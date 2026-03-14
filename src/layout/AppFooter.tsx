import React from 'react';

export default function AppFooter() {
  return (
    <div className="p-6 pt-0 mt-auto text-center dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 lg:border-none">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        &copy; {new Date().getFullYear()} KOPSIS Dashboard. All rights reserved. 
        <span className="mx-1">|</span>
        Design & Developed <a href="https://byjames.my.id" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 font-medium">byJames</a>
      </p>
    </div>
  );
}
