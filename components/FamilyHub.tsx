import React from 'react';
import { User } from '../types';
import { CheckCircle2, Clock, Mail, Share2 } from 'lucide-react';

export const FamilyHub: React.FC = () => {
  // Mock data
  const family: User[] = [
    { id: '1', name: 'Sarah (Sister)', avatar: 'S', status: 'ready' },
    { id: '2', name: 'Maya (Girlfriend)', avatar: 'M', status: 'pending' },
    { id: '3', name: 'Mom', avatar: 'Mo', status: 'overdue' },
  ];

  const handleInvite = async () => {
    const shareData = {
      title: 'Join my Kinsfolk Garden',
      text: 'Help me grow our family memory garden on Kinsfolk! We need your photos to unlock this week\'s capsule.',
      url: window.location.href
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback for desktop or browsers without web share API
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Invite link copied to clipboard!');
      } catch (err) {
        alert('Could not copy link. Please copy the URL manually.');
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-stone-800">Family Hub</h2>
        <p className="text-stone-500">See who's contributed to this week's capsule.</p>
      </header>

      <div className="grid gap-4">
        {family.map(member => (
          <div key={member.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center font-serif text-xl text-stone-600 font-bold">
                {member.avatar}
              </div>
              <div>
                <h3 className="font-bold text-stone-800">{member.name}</h3>
                <p className="text-xs text-stone-500">Last active: {member.status === 'ready' ? 'Today' : '3 days ago'}</p>
              </div>
            </div>

            <div>
              {member.status === 'ready' && (
                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <CheckCircle2 size={16} /> Capsule Ready
                </span>
              )}
              {member.status === 'pending' && (
                <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <Clock size={16} /> Waiting
                </span>
              )}
              {member.status === 'overdue' && (
                <div className="flex items-center gap-3">
                   <span className="text-stone-400 text-sm">Hasn't started</span>
                   <button className="text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors" title="Send Reminder">
                     <Mail size={18} />
                   </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-6 bg-stone-900 rounded-2xl text-white text-center">
         <h3 className="font-serif text-xl mb-2">Invite more family?</h3>
         <p className="text-stone-400 text-sm mb-4">The more people who share, the richer the garden grows.</p>
         <button 
           onClick={handleInvite}
           className="bg-rose-600 hover:bg-rose-700 px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 mx-auto"
         >
           <Share2 size={18} />
           Send Invite Link
         </button>
      </div>
    </div>
  );
};