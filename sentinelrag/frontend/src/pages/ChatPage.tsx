import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  Send, 
  Shield, 
  FileText, 
  Lock, 
  CheckCircle2, 
  Copy, 
  Trash2, 
  Download, 
  AlertTriangle, 
  Flame, 
  Check 
} from 'lucide-react';
import { ThemedSelect } from '../components/ui/ThemedSelect';

interface Citation {
  document_id?: string;
  title: string;
  page_number?: number;
  source_type?: string;
  snippet: string;
}

interface SecurityTraceData {
  user_role: string;
  department: string;
  permission_status: string;
  documents_searched: number;
  authorized_documents: number;
  denied_documents: number;
  chunks_retrieved: number;
  prompt_injection_detected: boolean;
  risk_score: number;
  threat_category?: string;
  sensitive_data_policy: string;
  redacted_items?: number;
  denied_matches?: Array<{
    document_title: string;
    sensitivity: string;
    department: string;
  }>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: Citation[];
  security_trace?: SecurityTraceData;
  isInjectionBlocked?: boolean;
  injectionDetails?: any;
}

interface AuthorizedDocument {
  id: string;
  title: string;
  file_type: string;
  department: string;
  sensitivity: string;
}

export const ChatPage = () => {
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am SentinelRAG, your Zero-Trust Enterprise AI Assistant. Every query you send is evaluated against our Pre-Retrieval Permission Engine.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [authorizedDocuments, setAuthorizedDocuments] = useState<AuthorizedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const chatLogRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const fetchAuthorizedDocuments = async () => {
      try {
        const response = await api.get('/documents/');
        if (mounted) setAuthorizedDocuments(response.data || []);
      } catch (error) {
        console.error('Failed to load authorized chat documents:', error);
        if (mounted) setAuthorizedDocuments([]);
      }
    };

    fetchAuthorizedDocuments();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (chatLog) {
      chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (customQuery?: string) => {
    const textToSend = customQuery || query;
    if (!textToSend.trim() || loading) return;

    const userMsgId = Date.now().toString();
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await api.post('/chat/', {
        query: textToSend,
        document_id: selectedDocumentId || null,
      });
      const data = response.data;

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        security_trace: data.security_trace,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      const is403 = error.response?.status === 403;
      const detail = error.response?.data?.detail;

      if (is403 && typeof detail === 'object' && detail.analysis) {
        // Quarantined Prompt Injection
        const attackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: detail.message || "Security Violation: Malicious prompt injection pattern detected and quarantined.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isInjectionBlocked: true,
          injectionDetails: detail.analysis
        };
        setMessages(prev => [...prev, attackMessage]);
      } else {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: typeof detail === 'string' ? detail : "Access Denied: You do not have permission to access the requested resource.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "Chat session cleared. Vault security monitoring remains active.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  const exportChat = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sentinelrag_transcript_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full gap-4">
      {/* Header with active role badge and action buttons */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 border border-slate-200/80 dark:border-vault-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-vault-card text-indigo-600 dark:text-cyan-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Secure Knowledge Vault Chat
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                Zero-Trust Active
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pruning unauthorized vectors before LLM synthesis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={clearChat}
            title="Clear Chat"
            className="p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={exportChat}
            title="Export Transcript"
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <section className="glass-panel border border-slate-200/80 p-4 dark:border-vault-border" aria-label="Your document access">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-vault-card dark:text-cyan-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Your document access</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Only these authorized records can enter your chat context.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            {authorizedDocuments.length} {authorizedDocuments.length === 1 ? 'document' : 'documents'} available
          </span>
        </div>

        {authorizedDocuments.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400" htmlFor="chat-document">
              Answer from document
            </label>
            <ThemedSelect
              value={selectedDocumentId}
              onChange={setSelectedDocumentId}
              options={[
                { value: '', label: 'All authorized documents' },
                ...authorizedDocuments.map((document) => ({
                  value: document.id,
                  label: `${document.title} · ${document.sensitivity} · ${document.department}`,
                })),
              ]}
              aria-label="Select an authorized document for chat"
            />
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            No authorized documents are currently available for your role and department.
          </p>
        )}
      </section>

      {/* Chat Messages Log Area */}
      <div
        ref={chatLogRef}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        className="shadcn-card-inset min-h-[460px] max-h-[620px] min-w-0 flex-1 flex flex-col gap-6 overflow-y-auto overscroll-contain rounded-3xl border border-slate-200/60 p-4 dark:border-vault-border/80 md:p-6"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
          >
            {/* User Message Bubble */}
            {msg.role === 'user' ? (
              <div className="flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[70%]">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-3.5 rounded-3xl rounded-tr-sm shadow-md text-sm leading-relaxed font-medium">
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 font-mono px-2">{msg.timestamp}</span>
              </div>
            ) : msg.isInjectionBlocked ? (
              /* Quarantined Prompt Injection Alert */
              <div className="max-w-[90%] sm:max-w-[80%] w-full rounded-3xl p-5 bg-gradient-to-br from-red-950/80 via-red-900/50 to-slate-900 border-2 border-red-500/80 shadow-cyber-rose text-white space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-red-500/40">
                  <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
                    <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                    🚨 PROMPTGUARD 2.0: ADVERSARIAL ATTACK BLOCKED
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500 text-white">
                    Risk Score: {msg.injectionDetails?.risk_score || 98}%
                  </span>
                </div>

                <p className="text-sm text-red-100 font-medium leading-relaxed">
                  {msg.content}
                </p>

                {msg.injectionDetails && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-red-500/30 text-xs space-y-1.5 font-mono">
                    <div className="text-red-300 font-semibold">
                      Category: <span className="text-white">{msg.injectionDetails.category}</span>
                    </div>
                    <div className="text-red-300 font-semibold">
                      Matched Trigger: <span className="text-amber-300">"{msg.injectionDetails.matched_pattern}"</span>
                    </div>
                    <div className="text-slate-400 text-[11px] pt-1">
                      Action: The prompt was quarantined before vector search or LLM ingestion. A critical security audit event has been dispatched to SOC telemetry.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Assistant Message */
              <div className="flex flex-col gap-3 max-w-[90%] sm:max-w-[85%] w-full">
                <div className="shadcn-card p-5 rounded-3xl rounded-tl-sm w-full border border-slate-200/80 dark:border-vault-border relative group">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-vault-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold">
                        S
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        SentinelRAG Assistant
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                      <button
                        onClick={() => copyToClipboard(msg.id, msg.content)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors p-1"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>

                {/* Citations Snippets */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {msg.citations.map((cit, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-2.5 bg-white dark:bg-vault-card px-3.5 py-2 rounded-2xl shadow-sm text-xs text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-vault-border max-w-sm"
                      >
                        <FileText className="w-4 h-4 text-indigo-500 dark:text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold truncate text-slate-800 dark:text-slate-100">{cit.title}</div>
                          <div className="text-[10px] text-slate-400">Page {cit.page_number || 1} • {cit.source_type?.toUpperCase()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Security Trace Card */}
                {msg.security_trace && (
                  <details className="mt-1 group">
                    <summary className="cursor-pointer select-none flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-cyan-400 bg-white dark:bg-vault-card w-fit px-4 py-1.5 rounded-full shadow-sm border border-slate-200/80 dark:border-vault-border hover:border-indigo-400 transition-all">
                      <Shield className="w-3.5 h-3.5" />
                      Security Trace & Verification
                    </summary>

                    <div className="mt-2.5 p-4 rounded-2xl bg-white dark:bg-vault-surface border border-slate-200/80 dark:border-vault-border text-xs space-y-2.5 shadow-md">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-vault-border">
                        <span className="text-slate-500">Evaluated Persona</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-cyan-400">
                          {msg.security_trace.user_role} ({msg.security_trace.department})
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Permission Status</span>
                        <span className={`font-semibold flex items-center gap-1 ${
                          msg.security_trace.permission_status.includes('Authorized') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {msg.security_trace.permission_status.includes('Authorized') ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {msg.security_trace.permission_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 my-1 bg-slate-50 dark:bg-vault-card/60 p-2.5 rounded-xl border border-slate-100 dark:border-vault-border/60 text-center">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Docs</div>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{msg.security_trace.documents_searched}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-emerald-500 uppercase font-semibold">Authorized</div>
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{msg.security_trace.authorized_documents}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-red-500 uppercase font-semibold">Denied</div>
                          <div className="font-mono font-bold text-red-600 dark:text-red-400">{msg.security_trace.denied_documents}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Injected Chunks to LLM</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {msg.security_trace.chunks_retrieved}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-vault-border">
                        <span className="text-slate-500">Output PII Policy</span>
                        <span className={`font-semibold ${msg.security_trace.sensitive_data_policy.includes('Redacted') ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {msg.security_trace.sensitive_data_policy}
                        </span>
                      </div>

                      {msg.security_trace.denied_matches && msg.security_trace.denied_matches.length > 0 && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                          <div className="font-bold flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Filtered Restricted Match:
                          </div>
                          Target: {msg.security_trace.denied_matches[0].document_title} ({msg.security_trace.denied_matches[0].sensitivity}). Pruned before LLM context.
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 p-4 bg-white dark:bg-vault-card rounded-2xl w-fit shadow-sm border border-slate-200 dark:border-vault-border">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-cyan-400 animate-ping"></div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Evaluating RBAC permissions & scanning vector chunks...
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask SentinelRAG as ${currentUser?.full_name.split(' ')[0]} (${currentUser?.role})...`}
            className="shadcn-input text-sm py-3.5 pl-4 pr-10"
            disabled={loading}
          />
        </div>

        <button
          onClick={() => handleSend()}
          disabled={loading || !query.trim()}
          className="shadcn-btn-primary !px-6 !py-3.5 rounded-[8px] flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};
