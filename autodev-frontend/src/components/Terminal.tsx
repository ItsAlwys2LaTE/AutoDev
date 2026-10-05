import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { classifyLogMessage, ClassifiedLog } from '../utils/formatters';

export interface LogItem {
  id: string;
  text: string;
  colorClass: string;
}

export interface TerminalProps {
  initialOpen?: boolean;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  initialOpen = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isConnectedRef = useRef(false);
  isConnectedRef.current = isConnected;

  // Subscribe to appStore terminalResetEpoch to automatically reset when new product is requested or development restarted
  const terminalResetEpoch = useAppStore((s) => s.terminalResetEpoch);
  const prevEpochRef = useRef(terminalResetEpoch);

  useEffect(() => {
    if (terminalResetEpoch !== undefined && terminalResetEpoch !== prevEpochRef.current) {
      prevEpochRef.current = terminalResetEpoch;
      setLogs([]);
    }
  }, [terminalResetEpoch]);

  const addLogItem = useCallback((text: string, colorClass: string) => {
    setLogs((prev) => {
      // Prevent duplicate identical consecutive lifecycle messages (e.g. backend echo of client action)
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (
          last.text === text &&
          (text.startsWith('[PAUSE]') ||
            text.startsWith('[RESUME]') ||
            text.startsWith('[RESTART]'))
        ) {
          return prev;
        }
      }
      const next = [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text, colorClass },
      ];
      // Keep up to 2,000 log entries to prevent memory saturation
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }, []);

  // Expose window.appendTerminalLog, window.toggleTerminal, and window.clearTerminal for backward compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).appendTerminalLog = (msg: string, type: string = 'info') => {
        let colorClass = 'text-slate-400';
        if (type === 'error') colorClass = 'text-red-400 font-bold';
        else if (type === 'warn') colorClass = 'text-yellow-400';
        else if (type === 'success') colorClass = 'text-emerald-400';
        else if (type === 'system') colorClass = 'text-blue-400 font-bold';
        else if (type === 'revision') colorClass = 'text-fuchsia-400 font-bold uppercase tracking-wide';

        addLogItem(msg, colorClass);
      };

      (window as any).toggleTerminal = () => {
        setIsOpen((prev) => !prev);
      };

      (window as any).clearTerminal = () => {
        setLogs([]);
      };

      const handleResetEvent = () => {
        setLogs([]);
      };
      window.addEventListener('autodev:terminal-reset', handleResetEvent);

      return () => {
        delete (window as any).appendTerminalLog;
        delete (window as any).toggleTerminal;
        delete (window as any).clearTerminal;
        window.removeEventListener('autodev:terminal-reset', handleResetEvent);
      };
    }
  }, [addLogItem]);

  // Connect to SSE log stream at /api/logs/stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    try {
      eventSource = new EventSource('/api/logs/stream');

      eventSource.onopen = () => {
        if (!isMounted) return;
        setLogs((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: 'init',
                text: '[System] Connected to AutoDev Uvicorn Backend Stream...',
                colorClass: 'text-slate-500 mb-2 block border-b border-slate-800 pb-2',
              },
            ];
          }
          if (!isConnectedRef.current) {
            return [
              ...prev,
              {
                id: `${Date.now()}-reconnect`,
                text: '[System] Connection to AutoDev Backend successfully established/reestablished.',
                colorClass: 'text-blue-400 font-bold',
              },
            ];
          }
          return prev;
        });
        setIsConnected(true);
      };

      eventSource.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;
        if (event.data === ': keepalive' || !event.data.trim()) return;

        const rawText = event.data.replace(/\\n/g, '\n');
        const classified: ClassifiedLog = classifyLogMessage(rawText);

        addLogItem(classified.cleanText, classified.colorClass);
      };

      eventSource.onerror = () => {
        if (!isMounted) return;
        if (isConnectedRef.current) {
          addLogItem('[System] Connection to Backend stream lost. Retrying...', 'text-red-400 font-bold');
          setIsConnected(false);
        }
      };
    } catch (e) {
      console.error('Failed to initialize SSE EventSource in Terminal:', e);
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [addLogItem]);

  // Auto-scroll mechanics adhering to 150px threshold
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop < el.clientHeight + 150;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const toggleTerminal = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      id="terminalPanel"
      className={`hidden ${className}`}
      style={{ display: 'none', height: '350px' }}
    >
      {/* Header */}
      <div
        id="terminalHeader"
        className="h-[40px] flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 cursor-pointer text-slate-300 hover:bg-slate-700 hover:text-white transition-colors select-none"
        onClick={toggleTerminal}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 9l3 3-3 3m5 0h3M4 6h16M4 18h16a2 2 0 002-2V8a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="font-bold text-xs uppercase tracking-wider">Live Backend Logs</span>
        </div>
        <div className="flex items-center gap-4">
          <span
            id="terminalStatusIndicator"
            className="flex h-2 w-2 relative"
            title={isConnected ? 'Connected' : 'Disconnected'}
          >
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-500' : 'bg-slate-500'
              }`}
            ></span>
          </span>
          <svg
            id="terminalChevron"
            className={`w-4 h-4 transform transition-transform duration-300 ${
              isOpen ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Log Content */}
      <div
        id="terminalContent"
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] leading-relaxed text-[11px] whitespace-pre-wrap break-all custom-scrollbar"
      >
        {logs.map((item) => (
          <span key={item.id} className={`${item.colorClass} block mb-1`}>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Terminal;
