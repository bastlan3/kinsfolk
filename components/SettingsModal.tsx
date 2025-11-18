import React, { useState, useEffect } from 'react';
import { X, Key, Save, ExternalLink, Trash2 } from 'lucide-react';
import { setUserApiKey, removeUserApiKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) setKey(stored);
    else setKey('');
  }, [isOpen]);

  const handleSave = () => {
    if (key.trim()) {
      setUserApiKey(key.trim());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    }
  };

  const handleRemove = () => {
    removeUserApiKey();
    setKey('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-serif font-bold text-stone-800">Settings</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Key size={16} className="text-stone-400" />
              Gemini API Key
            </label>
            <p className="text-xs text-stone-500 mb-3">
              Required for KinBot and Creative Studio. 
              <a 
                href="https://aistudiocdn.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-rose-600 hover:underline ml-1 inline-flex items-center gap-0.5"
              >
                Get a key <ExternalLink size={10} />
              </a>
            </p>
            <input 
              type="password" 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-mono text-sm"
            />
          </div>

          <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-500">
            <p className="mb-2"><strong>Privacy Note:</strong> Your API key is stored locally on your device. It is never sent to any server other than Google's Gemini API.</p>
          </div>

          <div className="flex gap-3">
            {key && (
              <button 
                onClick={handleRemove}
                className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-red-50 text-red-600 hover:bg-red-100"
                title="Remove API Key"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={handleSave}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                saved 
                  ? 'bg-green-600 text-white' 
                  : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
            >
              {saved ? <><CheckIcon /> Saved</> : <><Save size={18} /> Save Settings</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);