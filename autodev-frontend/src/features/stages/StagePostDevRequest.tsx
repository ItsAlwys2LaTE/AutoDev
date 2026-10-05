import React, { useState, useRef } from 'react';
import {
  SparklesIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { postCompletionQuery } from '../../api/endpoints';

export type PostDevOption = 'feature' | 'bug' | 'enquiry';

export interface StagePostDevRequestProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StagePostDevRequest: React.FC<StagePostDevRequestProps> = ({
  onAdvance,
  className = '',
}) => {
  const [selectedOption, setSelectedOption] = useState<PostDevOption>('feature');
  const [prompt, setPrompt] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResponse, setQueryResponse] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentCodebase = useAppStore((s) => s.currentCodebase || s.integratedCodebase);
  const currentBlueprint = useAppStore((s) => s.currentBlueprint);
  const setStorePrompt = useAppStore((s) => s.setPostCompletionPrompt);
  const setPostCompletionMode = useAppStore((s) => s.setPostCompletionMode);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic placeholders and helper copies
  const getPlaceholder = () => {
    switch (selectedOption) {
      case 'feature':
        return 'Describe the new feature or functional capability you want to add to this application...';
      case 'bug':
        return 'Describe the bug, broken behavior, or unexpected error you want resolved in the codebase...';
      case 'enquiry':
        return 'Ask any technical question regarding the architecture, components, APIs, or data flow...';
    }
  };

  const getHelperText = () => {
    switch (selectedOption) {
      case 'feature':
        return 'Full SDLC cycle: Targeted code generation, sandbox verification tests, quality critics evaluation, and live preview update.';
      case 'bug':
        return 'Defect resolution: Targeted fix synthesis, sandbox test execution, critics arbitration, and regression verification.';
      case 'enquiry':
        return 'Read-only technical explanation: Deep architectural inspection and conversational Q&A without modifying source files.';
    }
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your request or technical question.');
      return;
    }

    setErrorMessage(null);
    setStorePrompt(trimmed);

    if (selectedOption === 'feature' || selectedOption === 'bug') {
      setPostCompletionMode('modify');
      onAdvance(12); // Advance to Stage 12 (Execution View)
    } else {
      // Product Enquiry: In-place streaming technical answer
      if (!currentCodebase) {
        setErrorMessage('No codebase available for architectural enquiry.');
        return;
      }
      setIsQuerying(true);
      setQueryResponse('');
      try {
        await postCompletionQuery(
          {
            codebase: currentCodebase,
            blueprint: currentBlueprint,
            query: trimmed,
            mode: 'QUICK',
          },
          {
            onChunk: (accumulated) => setQueryResponse(accumulated),
          }
        );
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to complete technical query stream.');
      } finally {
        setIsQuerying(false);
      }
    }
  };

  const handleCopyExplanation = () => {
    if (!queryResponse) return;
    navigator.clipboard?.writeText(queryResponse).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  return (
    <div
      id="stagePostDevRequest"
      className={`h-full flex flex-col max-w-4xl mx-auto px-4 py-4 space-y-6 select-none ${className}`}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onAdvance(10)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Return to Results"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              POST-DEVELOPMENT REQUEST
            </h2>
            <p className="text-[11px] text-slate-500">
              Select a request type and describe your updates or technical questions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAdvance(10)}
          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer"
        >
          Back to Results
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* ── 3-Option Pill Toggle ── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200">
          <button
            id="pillFeatureRequest"
            type="button"
            onClick={() => setSelectedOption('feature')}
            className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              selectedOption === 'feature'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>Feature Request</span>
          </button>

          <button
            id="pillBugFixes"
            type="button"
            onClick={() => setSelectedOption('bug')}
            className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              selectedOption === 'bug'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BugAntIcon className="w-3.5 h-3.5" />
            <span>Bug Fixes</span>
          </button>

          <button
            id="pillProductEnquiry"
            type="button"
            onClick={() => setSelectedOption('enquiry')}
            className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              selectedOption === 'enquiry'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
            <span>Product Enquiry</span>
          </button>
        </div>
      </div>

      {/* Guidance Helper Note */}
      <div className="text-center">
        <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
          {getHelperText()}
        </p>
      </div>

      {/* Input Surface */}
      <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-md space-y-4">
        <textarea
          id="postDevTextarea"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={getPlaceholder()}
          rows={5}
          disabled={isQuerying}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 placeholder-slate-400 text-sm outline-none resize-y min-h-[120px] focus:bg-white focus:border-blue-500 leading-relaxed font-sans"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] font-mono text-slate-500">
            {prompt.length} characters
          </span>

          <button
            id="postDevSubmitBtn"
            type="button"
            onClick={handleSubmit}
            disabled={isQuerying || !prompt.trim()}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {isQuerying ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>STREAMING EXPLANATION...</span>
              </>
            ) : (
              <>
                <span>
                  {selectedOption === 'enquiry' ? 'ASK QUESTION' : 'START DEVELOPMENT'}
                </span>
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Technical Enquiry Streaming Answer Box */}
      {queryResponse && (
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-600" />
              <span>Technical Architectural Explanation</span>
            </h4>
            <button
              type="button"
              onClick={handleCopyExplanation}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {copyFeedback ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto custom-scrollbar font-sans p-3 bg-slate-50 border border-slate-100 rounded-xl">
            {queryResponse}
          </div>
        </div>
      )}
    </div>
  );
};

export default StagePostDevRequest;
