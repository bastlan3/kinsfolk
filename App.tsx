import React, { useState, useEffect } from 'react';
import { View, Photo, CapsuleStats } from './types';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CapsuleBuilder } from './components/CapsuleBuilder';
import { CreativeStudio } from './components/CreativeStudio';
import { ChatBot } from './components/ChatBot';
import { FamilyHub } from './components/FamilyHub';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<CapsuleStats>({
    streak: 4,
    nextUnlock: Date.now() + 172800000, // +2 days approx
    totalPhotos: 0,
    treeLevel: 1
  });

  // Update stats based on photos count
  useEffect(() => {
    const count = photos.length;
    setStats(prev => ({
      ...prev,
      totalPhotos: count,
      treeLevel: Math.min(5, Math.floor(count / 2) + 1) // Level up every 2 photos, max 5
    }));
  }, [photos]);

  const addPhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    const newPhoto: Photo = {
      id: Date.now().toString(),
      url,
      dateAdded: Date.now(),
      author: 'You'
    };
    setPhotos(prev => [newPhoto, ...prev]);
    // Switch to capsule view to see it added if not already there
    if (currentView !== View.CAPSULE) {
        // Optional: stay on dashboard or move to capsule. 
        // Let's stay on dashboard if user dragged dropped, but standard input usually implies seeing it.
        // For now, we just update state.
    }
  };

  const addGeneratedPhoto = (url: string) => {
    const newPhoto: Photo = {
      id: Date.now().toString(),
      url,
      dateAdded: Date.now(),
      author: 'You (AI)',
      isGenerated: true
    };
    setPhotos(prev => [newPhoto, ...prev]);
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard stats={stats} onChangeView={setCurrentView} />;
      case View.CAPSULE:
        return <CapsuleBuilder photos={photos} onAddPhoto={addPhoto} onRemovePhoto={removePhoto} />;
      case View.STUDIO:
        return <CreativeStudio onSaveToCapsule={addGeneratedPhoto} />;
      case View.CHAT:
        return <ChatBot />;
      case View.FAMILY:
        return <FamilyHub />;
      default:
        return <Dashboard stats={stats} onChangeView={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#fcfaf8] text-stone-800 font-sans">
      <Navigation currentView={currentView} setView={setCurrentView} />
      
      <main className="flex-1 p-6 pb-24 md:p-12 md:h-screen md:overflow-y-auto">
        <div className="max-w-5xl mx-auto h-full">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;