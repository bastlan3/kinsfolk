import React, { useState } from 'react';
import { generateCreativeImage } from '../services/geminiService';
import { Wand2, Loader2, Download, Plus } from 'lucide-react';

interface CreativeStudioProps {
  onSaveToCapsule: (imageUrl: string) => void;
}

export const CreativeStudio: React.FC<CreativeStudioProps> = ({ onSaveToCapsule }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const imageUrl = await generateCreativeImage(prompt);
      setGeneratedImage(imageUrl);
    } catch (err) {
      setError("Failed to create image. Please try a different prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (generatedImage) {
      onSaveToCapsule(generatedImage);
      // Reset after save? or keep it? Let's keep it but show feedback.
      setPrompt('');
      setGeneratedImage(null);
      alert("Artwork added to your capsule!");
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
          <Wand2 className="text-purple-600" />
          Creative Studio
        </h2>
        <p className="text-stone-500">Generate cover art or fill in missing memories with AI.</p>
      </header>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex-1 flex flex-col">
        
        {/* Preview Area */}
        <div className="flex-1 bg-stone-50 rounded-2xl mb-6 flex items-center justify-center overflow-hidden relative group">
          {isGenerating ? (
             <div className="text-center">
               <Loader2 className="animate-spin text-purple-600 w-10 h-10 mx-auto mb-3" />
               <p className="text-stone-500 text-sm animate-pulse">Dreaming up your image...</p>
             </div>
          ) : generatedImage ? (
             <>
              <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={handleSave}
                   className="bg-white text-stone-800 px-4 py-2 rounded-full shadow-lg font-medium flex items-center gap-2 hover:bg-stone-50"
                 >
                   <Plus size={16} /> Add to Capsule
                 </button>
              </div>
             </>
          ) : (
             <div className="text-center p-8 opacity-40">
               <Wand2 className="w-16 h-16 mx-auto mb-4 text-stone-400" />
               <p className="text-lg font-medium text-stone-600">Ready to create</p>
             </div>
          )}
        </div>

        {/* Input Area */}
        <div className="space-y-4">
           {error && <p className="text-red-500 text-sm px-2">{error}</p>}
           
           <div className="flex gap-2">
             <input 
               type="text" 
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
               placeholder="Describe a memory, a feeling, or an abstract cover art..."
               className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
               disabled={isGenerating}
             />
             <button 
               onClick={handleGenerate}
               disabled={!prompt.trim() || isGenerating}
               className="bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               Generate
             </button>
           </div>
           
           <div className="flex gap-2 overflow-x-auto pb-2">
             {['Family dinner in watercolor style', 'Abstract shapes representing joy', 'A cozy winter cabin evening'].map(suggestion => (
               <button 
                 key={suggestion}
                 onClick={() => setPrompt(suggestion)}
                 className="whitespace-nowrap text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-1.5 rounded-full transition-colors"
               >
                 {suggestion}
               </button>
             ))}
           </div>
        </div>

      </div>
    </div>
  );
};