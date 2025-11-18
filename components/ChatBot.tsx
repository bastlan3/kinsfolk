import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { Send, MessageCircle, Bot, User as UserIcon, Loader2 } from 'lucide-react';

export const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hi! I'm KinBot. I can help you brainstorm photo ideas, suggest captions, or just chat about your family memories. How can I help today?",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Transform messages for Gemini API history format
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await generateChatResponse(history, userMsg.text);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      // Handle error elegantly in chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I'm having a little trouble connecting to the memory banks right now. Please try again in a moment.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-120px)] md:h-full flex flex-col bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
      
      <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="font-bold text-stone-800">KinBot</h3>
          <p className="text-xs text-stone-500">AI Memory Assistant</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed
              ${msg.role === 'user' 
                ? 'bg-stone-800 text-white rounded-tr-none' 
                : 'bg-stone-100 text-stone-800 rounded-tl-none'}
            `}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-stone-400" />
              <span className="text-xs text-stone-400">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-stone-100">
        <div className="flex gap-2 items-center bg-stone-50 border border-stone-200 rounded-full px-2 py-2 pl-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about photo ideas..."
            className="flex-1 bg-transparent outline-none text-stone-700 text-sm"
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

    </div>
  );
};