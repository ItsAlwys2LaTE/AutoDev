import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAuthStore } from '../../stores/authStore';
import { SmoothInput } from '../../components/SmoothInput';
import { TextType } from '../../components/TextType';
import { SpecularButton } from '../../components/SpecularButton';

export interface StageProductRequestProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageProductRequest: React.FC<StageProductRequestProps> = ({
  onAdvance,
  className = '',
}) => {
  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const setFeatureRequest = useAppStore((s) => s.setFeatureRequest);
  const clearIntentGate = useAppStore((s) => s.clearIntentGate);
  const clearProductEnquiry = useAppStore((s) => s.clearProductEnquiry);
  const directAnswer = useAppStore((s) => s.directAnswer);

  const [prompt, setPrompt] = useState(storeFeatureRequest || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTitleComplete, setIsTitleComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const handleTitleComplete = useCallback(() => {
    setIsTitleComplete(true);
  }, []);

  useEffect(() => {
    // Autofocus textarea on mount / page load so the user can immediately start typing
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if ('setSelectionRange' in textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (storeFeatureRequest && storeFeatureRequest !== prompt) {
      setPrompt(storeFeatureRequest);
    }
  }, [storeFeatureRequest]);

  // Dynamic username from user profile with backward-compatible Alex fallback
  const authUser = useAuthStore((s) => s.user);
  const username = authUser?.display_name || authUser?.username || 'Alex';
  const headingPhrases = useMemo(
    () => ['Welcome to AutoDev', `What are we developing ${username}?`],
    [username]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      const msg = 'Please enter a product prompt or software idea to start development.';
      setErrorMessage(msg);
      try {
        useSessionStore.getState().showWarningToast(msg, 'Input Required');
      } catch { /* ignore */ }
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    setFeatureRequest(trimmed);
    clearIntentGate();
    clearProductEnquiry();
    setIsSubmitting(false);
    onAdvance(2); // Always advance to Stage 2 (Product Enquiry Agent)
  }, [
    prompt,
    setFeatureRequest,
    clearIntentGate,
    clearProductEnquiry,
    onAdvance,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      handleSubmit();
    }
  };


  return (
    <div
      id="stageProductRequest"
      className={`h-full flex flex-col justify-center w-full max-w-4xl lg:max-w-5xl xl:max-w-[1080px] mx-auto px-4 sm:px-6 py-6 select-none space-y-6 ${className}`}
    >
      <div className="w-full max-w-4xl lg:max-w-5xl xl:max-w-[1080px] mx-auto space-y-2.5 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-[45px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight min-h-[2.75rem] md:min-h-[3.5rem] flex items-center justify-center text-center drop-shadow-sm whitespace-normal sm:whitespace-nowrap">
          <TextType
            as="span"
            text={headingPhrases}
            typingSpeed={55}
            deletingSpeed={35}
            pauseDuration={1500}
            initialDelay={250}
            loop={false}
            showCursor={true}
            cursorCharacter="|"
            cursorClassName="text-slate-900 dark:text-white/80 font-semibold"
            onComplete={handleTitleComplete}
          />
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={isTitleComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-xs sm:text-sm md:text-[15px] text-slate-600 dark:text-slate-300 min-h-[1.5rem]"
        >
          Describe the product you want to build.
        </motion.p>
      </div>

      {errorMessage && (
        <div
          id="errorSection"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-center justify-between backdrop-blur-xl shadow-sm"
        >
          <span id="errorText">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-Software Direct Answer Gate */}
      {directAnswer && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/30 backdrop-blur-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-300">
            <InformationCircleIcon className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            <span>Informational Query Response (Non-Software)</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{directAnswer}</p>
          <div className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
            AutoDev only develops software systems and technical tools. Please provide a software feature or application request.
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                clearIntentGate();
                textareaRef.current?.focus();
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white/10 dark:hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer shadow-sm"
            >
              Enter Software Engineering Request
            </button>
          </div>
        </div>
      )}

      {/* Glassmorphic SmoothInput Textarea with ScrollFade */}
      <SmoothInput
        id="featureRequest"
        ref={textareaRef}
        autoFocus={true}
        as="textarea"
        autoResize={true}
        minHeight={135}
        maxHeight={280}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Build a real-time collaborative task board with drag-and-drop columns, user assignments, and WebSocket sync..."
        disabled={isSubmitting}
        caretColorClass="text-slate-900 dark:text-white/80 font-semibold"
        wrapperClassName="rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-300 dark:border-white/[0.07] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] focus-within:border-slate-400 dark:focus-within:border-white/20 focus-within:ring-1 focus-within:ring-slate-300 dark:focus-within:ring-white/10 transition-all overflow-hidden"
        className="w-full bg-transparent border-none outline-none focus:outline-none transition-all text-sm sm:text-base md:text-[16px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 font-sans leading-relaxed resize-none p-5 sm:p-6"
        wrapperStyle={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      />

      {/* Separated and Centered Start Development Button with Colourless SpecularButton */}
      <div className="flex items-center justify-center pt-2">
        <SpecularButton
          id="submitBtn"
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !prompt.trim()}
          size="md"
          radius={20}
          tint="#ffffff"
          tintOpacity={0.04}
          blur={20}
          lineColor="#ffffff"
          baseColor="#000000"
          textColor="#ffffff"
          intensity={1.3}
          shineSize={16}
          shineFade={40}
          thickness={1.5}
          speed={0.4}
          followMouse={true}
          proximity={260}
          autoAnimate={true}
          className="px-8 md:px-9 py-3 md:py-3.5 font-semibold text-xs md:text-sm tracking-wider shadow-[0_8px_28px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="w-4.5 h-4.5 animate-spin" />
              <span>ANALYZING REQUEST...</span>
            </div>
          ) : (
            <span>START DEVELOPMENT</span>
          )}
        </SpecularButton>
      </div>
    </div>
  );
};

export default StageProductRequest;
