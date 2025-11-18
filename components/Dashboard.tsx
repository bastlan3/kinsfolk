import React from 'react';
import { CapsuleStats, View } from '../types';
import { Leaf, Calendar, Trophy, AlertCircle } from 'lucide-react';

interface DashboardProps {
  stats: CapsuleStats;
  onChangeView: (view: View) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onChangeView }) => {
  
  // Visual representation of the tree based on level
  const renderTree = () => {
    // Simple SVG tree representation that grows
    const scale = 0.5 + (stats.treeLevel * 0.1);
    return (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center transition-all duration-1000 ease-in-out">
         <div className={`absolute inset-0 bg-green-100 rounded-full blur-3xl opacity-40 transform scale-${stats.treeLevel * 20}`}></div>
         <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl" style={{ transform: `scale(${scale})` }}>
            {/* Trunk */}
            <path d="M95 200 L105 200 L100 100 Z" fill="#8D6E63" />
            {/* Branches/Leaves - complexity grows with level */}
            <circle cx="100" cy="90" r={20 + (stats.treeLevel * 10)} fill={stats.treeLevel > 1 ? "#4CAF50" : "#A5D6A7"} />
            {stats.treeLevel > 2 && <circle cx="70" cy="110" r="20" fill="#66BB6A" />}
            {stats.treeLevel > 2 && <circle cx="130" cy="110" r="20" fill="#66BB6A" />}
            {stats.treeLevel > 3 && <circle cx="100" cy="50" r="25" fill="#81C784" />}
            {stats.treeLevel > 4 && <circle cx="60" cy="70" r="15" fill="#43A047" />}
            {stats.treeLevel > 4 && <circle cx="140" cy="70" r="15" fill="#43A047" />}
         </svg>
         {stats.treeLevel < 5 && (
           <div className="absolute -bottom-4 text-center w-full">
              <p className="text-xs text-stone-500 font-medium bg-white/80 px-2 py-1 rounded-full inline-block backdrop-blur-sm">
                Add photos to grow your garden
              </p>
           </div>
         )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 animate-fade-in">
      
      <header className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">Welcome back, Alex.</h2>
        <p className="text-stone-600 text-lg">The bi-weekly capsule unlocks in <span className="font-semibold text-rose-600">2 days and 14 hours</span>.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Incentive: The Garden */}
        <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-stone-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
              <Leaf size={120} />
           </div>
           <div className="relative z-10">
             <div className="flex justify-between items-start mb-6">
               <div>
                 <h3 className="text-xl font-bold text-stone-800">Memory Garden</h3>
                 <p className="text-stone-500 text-sm mt-1">Your consistent contributions make it flourish.</p>
               </div>
               <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                 <Trophy size={14} />
                 <span>Level {stats.treeLevel}</span>
               </div>
             </div>
             
             {renderTree()}

             <div className="mt-6 flex justify-center">
               <button 
                 onClick={() => onChangeView(View.CAPSULE)}
                 className="bg-stone-900 hover:bg-stone-700 text-white px-8 py-3 rounded-full font-medium transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
               >
                 Add Memory to Water Garden
               </button>
             </div>
           </div>
        </div>

        {/* Secondary Stats/Incentives */}
        <div className="space-y-6">
          
          {/* Streak */}
          <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
             <div className="flex items-center gap-3 mb-3">
               <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                 <Calendar size={20} />
               </div>
               <h4 className="font-bold text-stone-800">Active Streak</h4>
             </div>
             <div className="text-4xl font-bold text-orange-600 mb-1">{stats.streak} <span className="text-lg font-medium text-orange-400">capsules</span></div>
             <p className="text-xs text-stone-500">Don't break the chain! Upload before Sunday.</p>
          </div>

          {/* Status Alert */}
          <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
             <h4 className="font-bold text-stone-800 mb-4">Family Status</h4>
             <div className="space-y-3">
               <div className="flex items-center justify-between text-sm">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500"></div>
                   <span className="text-stone-600">Sister</span>
                 </div>
                 <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded">Ready</span>
               </div>
               <div className="flex items-center justify-between text-sm">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                   <span className="text-stone-600">Girlfriend</span>
                 </div>
                 <span className="text-rose-600 font-medium text-xs bg-rose-50 px-2 py-1 rounded">Waiting</span>
               </div>
               <div className="flex items-center justify-between text-sm mt-4 pt-3 border-t border-stone-100">
                 <div className="flex items-center gap-2">
                    <span className="text-stone-800 font-medium">You</span>
                 </div>
                 {stats.totalPhotos > 0 ? (
                   <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded">Ready ({stats.totalPhotos})</span>
                 ) : (
                    <div className="flex items-center gap-1 text-orange-600 font-medium text-xs">
                      <AlertCircle size={12} />
                      <span>Action needed</span>
                    </div>
                 )}
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};