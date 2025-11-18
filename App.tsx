import React, { useState, useEffect } from 'react';
import { View, Photo, CapsuleStats, User } from './types';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CapsuleBuilder } from './components/CapsuleBuilder';
import { CreativeStudio } from './components/CreativeStudio';
import { ChatBot } from './components/ChatBot';
import { FamilyHub } from './components/FamilyHub';
import { SettingsModal } from './components/SettingsModal';

const DEFAULT_FAMILY: User[] = [
  { id: '1', name: 'Sarah (Sister)', avatar: 'S', status: 'ready' },
  { id: '2', name: 'Maya (Girlfriend)', avatar: 'M', status: 'pending' },
  { id: '3', name: 'Mom', avatar: 'Mo', status: 'overdue' },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Family State with Local Storage Persistence
  const [familyMembers, setFamilyMembers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('kinsfolk_family');
      return saved ? JSON.parse(saved) : DEFAULT_FAMILY;
    } catch (e) {
      return DEFAULT_FAMILY;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kinsfolk_family', JSON.stringify(familyMembers));
    } catch (e) {
      console.warn('Could not save family members to local storage');
    }
  }, [familyMembers]);

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

  // Family Management Handlers
  const addFamilyMember = (name: string) => {
    const newMember: User = {
      id: Date.now().toString(),
      name: name,
      avatar: name.substring(0, 2).toUpperCase(),
      status: 'pending'
    };
    setFamilyMembers(prev => [...prev, newMember]);
  };

  const removeFamilyMember = (id: string) => {
    if (window.confirm('Are you sure you want to remove this family member?')) {
      setFamilyMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const updateFamilyMember = (id: string, newName: string) => {
    setFamilyMembers(prev => prev.map(m => 
      m.id === id ? { ...m, name: newName, avatar: newName.substring(0, 2).toUpperCase() } : m
    ));
  };

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard stats={stats} onChangeView={setCurrentView} />;
      case View.CAPSULE:
        return <CapsuleBuilder photos={photos} onAddPhoto={addPhoto} onRemovePhoto={removePhoto} />;
      case View.STUDIO:
        return <CreativeStudio onSaveToCapsule={addGeneratedPhoto} />
      case View.CHAT:
        return <ChatBot />;
      case View.FAMILY:
        return (
          <FamilyHub 
            members={familyMembers} 
            onAddMember={addFamilyMember} 
            onRemoveMember={removeFamilyMember} 
            onUpdateMember={updateFamilyMember}
          />
        );
      default:
        return <Dashboard stats={stats} onChangeView={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#fcfaf8] text-stone-800 font-sans">
      <Navigation 
        currentView={currentView} 
        setView={setCurrentView} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <main className="flex-1 p-6 pb-24 md:p-12 md:h-screen md:overflow-y-auto">
        <div className="max-w-5xl mx-auto h-full">
           {renderContent()}
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;