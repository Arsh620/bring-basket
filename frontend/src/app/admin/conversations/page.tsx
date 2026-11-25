'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import api from '@/lib/api/client';

type Conversation = { _id: string; receiverType: string; lastMessage?: string; updatedAt: string; receiverId?: { fName?: string; name?: string } };
type Message = { _id: string; senderId: string; senderType: string; message: string; createdAt: string };

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    api.get('/admin/conversations').then((r) => setConversations(r.data.data || [])).catch(() => {});
  }, []);

  const loadMessages = (id: string) => {
    setSelected(id);
    api.get(`/admin/conversations/${id}/messages`).then((r) => setMessages(r.data.data || [])).catch(() => {});
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selected) return;
    await api.post('/admin/conversations/send', { conversationId: selected, message: newMsg });
    setNewMsg('');
    loadMessages(selected);
  };

  return (
    <AdminLayout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare size={22} className="text-[#08234b]" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Conversations</h1>
          <p className="text-sm text-slate-500">Chat with customers and vendors</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 h-[600px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-y-auto">
          {conversations.length === 0 && <p className="p-4 text-sm text-slate-400">No conversations yet.</p>}
          {conversations.map((c) => (
            <button key={c._id} onClick={() => loadMessages(c._id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition ${selected === c._id ? 'bg-slate-100' : ''}`}>
              <p className="text-sm font-medium text-slate-800">{c.receiverId?.fName || c.receiverId?.name || c.receiverType}</p>
              <p className="text-xs text-slate-400 truncate">{c.lastMessage || 'No messages'}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a conversation</div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div key={m._id} className={`flex ${m.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${m.senderType === 'admin' ? 'bg-[#08234b] text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3 flex gap-2">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08234b]" />
                <button onClick={sendMessage} className="rounded-lg bg-[#08234b] px-4 py-2 text-white hover:bg-[#0a2d5e]">
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </AdminLayout>
  );
}
