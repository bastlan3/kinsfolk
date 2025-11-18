import React, { useState } from 'react';
import { User } from '../types';
import { CheckCircle2, Clock, Mail, Share2, Plus, Trash2, X, UserPlus, Pencil } from 'lucide-react';

interface FamilyHubProps {
  members: User[];
  onAddMember: (name: string) => void;
  onRemoveMember: (id: string) => void;
  onUpdateMember: (id: string, newName: string) => void;
}

export const FamilyHub: React.FC<FamilyHubProps> = ({ members, onAddMember, onRemoveMember, onUpdateMember }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

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
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Invite link copied to clipboard!');
      } catch (err) {
        alert('Could not copy link. Please copy the URL manually.');
      }
    }
  };

  const startAdd = () => {
    setEditingId(null);
    setNameInput('');
    setIsAdding(true);
  };

  const startEdit = (member: User) => {
    setIsAdding(false);
    setEditingId(member.id);
    setNameInput(member.name);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setNameInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    if (isAdding) {
      onAddMember(nameInput.trim());
    } else if (editingId) {
      onUpdateMember(editingId, nameInput.trim());
    }

    cancelEdit();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Family Hub</h2>
          <p className="text-stone-500">Manage your circle and track contributions.</p>
        </div>
        <button 
          onClick={startAdd}
          className="text-stone-500 hover:text-rose-600 transition-colors flex items-center gap-1 text-sm font-medium"
        >
          <Plus size={16} /> Add Member
        </button>
      </header>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white p-4 rounded-2xl border border-rose-100 shadow-sm animate-fade-in">
          <h3 className="text-sm font-bold text-stone-800 mb-3">{isAdding ? 'Add New Member' : 'Edit Member'}</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name (e.g. Aunt Clara)"
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-rose-200"
              autoFocus
            />
            <button 
              type="submit"
              disabled={!nameInput.trim()}
              className="bg-stone-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-stone-800 disabled:opacity-50"
            >
              {isAdding ? 'Add' : 'Save'}
            </button>
            <button 
              type="button"
              onClick={cancelEdit}
              className="bg-stone-100 text-stone-500 px-3 py-2 rounded-xl hover:bg-stone-200"
            >
              <X size={20} />
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {members.map(member => (
          <div key={member.id} className={`bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between group transition-all ${editingId === member.id ? 'border-rose-200 ring-1 ring-rose-200' : 'border-stone-200 hover:border-stone-300'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center font-serif text-xl text-stone-600 font-bold">
                {member.avatar}
              </div>
              <div>
                <h3 className="font-bold text-stone-800">{member.name}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-stone-500">Last active: {member.status === 'ready' ? 'Today' : 'Unknown'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex">
                {member.status === 'ready' && (
                  <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                    <CheckCircle2 size={16} /> Ready
                  </span>
                )}
                {member.status === 'pending' && (
                  <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-sm font-medium">
                    <Clock size={16} /> Waiting
                  </span>
                )}
                {member.status === 'overdue' && (
                  <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full text-sm font-medium">
                    <Clock size={16} /> Overdue
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                 <button 
                   onClick={() => startEdit(member)}
                   className="text-stone-400 hover:text-stone-800 hover:bg-stone-100 p-2 rounded-full transition-colors"
                   title="Edit Name"
                 >
                   <Pencil size={18} />
                 </button>
                 <button 
                   onClick={() => onRemoveMember(member.id)}
                   className="text-stone-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors" 
                   title="Remove Member"
                 >
                   <Trash2 size={18} />
                 </button>
              </div>
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
            <UserPlus className="mx-auto text-stone-300 mb-3" size={48} />
            <p className="text-stone-500 font-medium">No family members added yet.</p>
            <button 
              onClick={startAdd}
              className="text-rose-600 font-semibold mt-2 hover:underline"
            >
              Add someone now
            </button>
          </div>
        )}
      </div>

      <div className="mt-10 p-6 bg-stone-900 rounded-2xl text-white text-center">
         <h3 className="font-serif text-xl mb-2">Invite your family</h3>
         <p className="text-stone-400 text-sm mb-4">Share the link so they can access this shared garden.</p>
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