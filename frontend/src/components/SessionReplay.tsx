import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Terminal, Bot, User } from 'lucide-react';
import type { ReplayMessage, ReplayBlock } from '../types';

interface Props {
  projectId: string;
  sessionId: string;
  onClose: () => void;
}

function ToolCallBlock({ block }: { block: ReplayBlock }) {
  const [open, setOpen] = useState(false);
  const input = block.toolInput ? JSON.stringify(block.toolInput, null, 2) : '';
  const preview = input.length > 120 ? input.slice(0, 120) + '…' : input;

  return (
    <div className="my-1 rounded-lg overflow-hidden border border-zinc-700/50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-zinc-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />}
        <Terminal className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span className="text-amber-300 text-xs font-mono font-medium">{block.toolName}</span>
        {!open && <span className="text-zinc-600 text-xs truncate ml-1">{preview}</span>}
      </button>
      {open && input && (
        <pre className="px-3 py-2 text-[11px] font-mono text-zinc-300 bg-zinc-900/60 overflow-x-auto max-h-48">{input}</pre>
      )}
    </div>
  );
}

function ToolResultBlock({ block }: { block: ReplayBlock }) {
  const [open, setOpen] = useState(false);
  const text = block.text ?? '';
  const lines = text.split('\n');
  const preview = lines.slice(0, 2).join('\n');
  const truncated = text.length > 300 || lines.length > 2;

  return (
    <div className={`my-1 rounded-lg border text-xs font-mono ${block.isError ? 'border-red-700/50 bg-red-950/20' : 'border-zinc-700/30 bg-zinc-800/30'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
        disabled={!truncated}
      >
        {truncated && (open ? <ChevronDown className="w-3 h-3 text-zinc-600 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />)}
        <span className={`flex-1 truncate ${block.isError ? 'text-red-300' : 'text-zinc-500'}`}>
          {open ? text : preview}
        </span>
      </button>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ReplayMessage }) {
  const isUser = msg.role === 'user';
  const hasOnlyToolResults = msg.blocks.every(b => b.kind === 'tool_result');

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? 'bg-blue-500/20' : 'bg-emerald-500/20'}`}>
        {isUser ? <User className="w-3.5 h-3.5 text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
      </div>
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {msg.blocks.map((block, i) => {
          if (block.kind === 'text') {
            // Skip tool-result-only user messages (just show results inline)
            if (isUser && hasOnlyToolResults) return null;
            return (
              <div
                key={i}
                className={`px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words ${
                  isUser
                    ? 'bg-blue-500/15 text-blue-100 rounded-tr-sm'
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                }`}
              >
                {block.text}
              </div>
            );
          }
          if (block.kind === 'tool_call') return <ToolCallBlock key={i} block={block} />;
          if (block.kind === 'tool_result') return <ToolResultBlock key={i} block={block} />;
          return null;
        })}
      </div>
    </div>
  );
}

export function SessionReplay({ projectId, sessionId, onClose }: Props) {
  const [messages, setMessages] = useState<ReplayMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/sessions/${sessionId}/replay`)
      .then(r => r.json())
      .then((data: ReplayMessage[]) => {
        setMessages(data);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      })
      .catch(() => {
        setError('Failed to load session');
        setLoading(false);
      });
  }, [projectId, sessionId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div>
            <h3 className="text-white font-medium text-sm">Session Replay</h3>
            <p className="text-zinc-600 text-xs font-mono">{sessionId.slice(0, 16)}…</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Loading conversation…</div>
          )}
          {error && (
            <div className="flex items-center justify-center h-32 text-red-500 text-sm">{error}</div>
          )}
          {messages && messages.length === 0 && (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No messages found</div>
          )}
          {messages?.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {messages && (
          <div className="px-5 py-2.5 border-t border-zinc-800 text-zinc-600 text-xs">
            {messages.length} messages
          </div>
        )}
      </div>
    </div>
  );
}
