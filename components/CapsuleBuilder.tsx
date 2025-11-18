import React, { useCallback } from 'react';
import { Photo } from '../types';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';

interface CapsuleBuilderProps {
  photos: Photo[];
  onAddPhoto: (file: File) => void;
  onRemovePhoto: (id: string) => void;
}

export const CapsuleBuilder: React.FC<CapsuleBuilderProps> = ({ photos, onAddPhoto, onRemovePhoto }) => {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddPhoto(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800">Current Capsule</h2>
        <p className="text-stone-500">These photos will be sent to your family in 2 days.</p>
      </header>

      <div className="flex-1 bg-white rounded-3xl border border-stone-200 p-6 shadow-sm overflow-hidden flex flex-col">
        
        {/* Photo Grid */}
        <div className="flex-1 overflow-y-auto pr-2">
          {photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50 m-4">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">This capsule is empty</p>
              <p className="text-sm mt-2 max-w-xs text-center">Upload high-quality photos to share with your family and water your garden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-stone-100 shadow-sm hover:shadow-md transition-all">
                  <img src={photo.url} alt="Memory" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                  <button 
                    onClick={() => onRemovePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-white/90 text-rose-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <X size={16} />
                  </button>
                  {photo.isGenerated && (
                    <div className="absolute bottom-2 left-2 bg-purple-500/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                      AI Art
                    </div>
                  )}
                </div>
              ))}
              
              {/* Quick Add Button in Grid */}
              <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-rose-400 hover:bg-rose-50 transition-colors">
                <Plus size={32} className="text-stone-400 mb-2" />
                <span className="text-xs font-semibold text-stone-500">Add Photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-between">
           <div className="text-sm text-stone-500">
             <span className="font-bold text-stone-800">{photos.length}</span> memories collected
           </div>
           
           <div className="flex gap-3">
             <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-100 text-stone-700 font-medium hover:bg-stone-200 transition-colors cursor-pointer">
                <Upload size={18} />
                <span>Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
             </label>
           </div>
        </div>

      </div>
    </div>
  );
};