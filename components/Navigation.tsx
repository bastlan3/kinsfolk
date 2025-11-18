import React from 'react';
import { View } from '../types';
import { Home, Image, MessageCircle, Users, Palette, Camera } from 'lucide-react';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Garden', icon: Home },
    { id: View.CAPSULE, label: 'Capsule', icon: Camera },
    { id: View.STUDIO, label: 'Studio', icon: Palette },
    { id: View.CHAT, label: 'KinBot', icon: MessageCircle },
    { id: View.FAMILY, label: 'Family', icon: Users },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 px-6 py-3 flex justify-between items-center md:static md:w-64 md:flex-col md:justify-start md:border-r md:border-t-0 md:h-screen md:py-8 z-50">
      <div className="hidden md:block mb-10 px-4">
        <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Kinsfolk</h1>
        <p className="text-xs text-stone-500 uppercase tracking-wider mt-1">Family Memories</p>
      </div>

      <div className="flex md:flex-col w-full justify-between md:justify-start gap-1 md:gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                flex flex-col md:flex-row items-center md:px-4 md:py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'text-rose-600 bg-rose-50' 
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}
              `}
            >
              <Icon className={`w-6 h-6 md:w-5 md:h-5 mb-1 md:mb-0 md:mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
              <span className={`text-xs md:text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="hidden md:block mt-auto px-4 pb-4">
        <div className="bg-stone-100 rounded-lg p-3">
          <p className="text-xs text-stone-500 font-medium">Next Unlock</p>
          <p className="text-sm font-bold text-stone-800">2 Days left</p>
        </div>
      </div>
    </nav>
  );
};