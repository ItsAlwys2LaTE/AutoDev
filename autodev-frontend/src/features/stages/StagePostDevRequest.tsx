import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WrenchScrewdriverIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  CommandLineIcon,
  CubeTransparentIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { SmoothInput } from '../../components/SmoothInput';

export type DetectedSupportType = 'feature' | 'bug' | 'enquiry';

export interface StagePostDevRequestProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FAQS_DATA: FAQItem[] = [
  {
    question: 'How do I run and test the AutoDev-generated software product locally?',
    category: 'Runtime & Execution',
    icon: CommandLineIcon,
    answer:
      'Extract the downloaded project ZIP archive. For Node.js/TypeScript codebases, execute "npm install" followed by "npm run dev" or "npm test". For Python codebases, initialize a virtual environment ("python -m venv venv"), activate it, install dependencies via "pip install -r requirements.txt", and launch the application entrypoint ("python main.py"). Comprehensive setup instructions are also documented in the root README.md and USER_GUIDE.md.',
  },
  {
    question: 'How does autonomous continuous enhancement work in AutoDev?',
    category: 'Post-Dev Workflow',
    icon: SparklesIcon,
    answer:
      'Enter any feature expansion or bug report into the input above. The Post-Development Support Agent automatically classifies the intent and dispatches targeted synthesis across the affected components. Modifications are verified in an isolated Docker sandbox and evaluated by multiple critique judges before committing a new atomic revision to your codebase history.',
  },
  {
    question: 'How can I export and commit this product to my personal GitHub repository?',
    category: 'Version Control',
    icon: ArrowUpTrayIcon,
    answer:
      'You can export your finalized repository directly from the Development Results stage. Clicking "Commit to GitHub" prompts for your GitHub username, repository name, and Personal Access Token (with repo scope). AutoDev commits all synthesized modules, unit tests, and documentation directly to your remote repository in a single atomic transaction.',
  },
  {
    question: 'Can I ask technical architectural questions about the generated code?',
    category: 'Architectural Inspection',
    icon: ChatBubbleLeftRightIcon,
    answer:
      'Yes. When you ask technical questions regarding the system design, APIs, state flow, or dependencies, the Post-Development Support Agent recognizes the inquiry as a Product Enquiry. It inspects your active codebase and streams an in-depth architectural breakdown directly into this console without altering any source files.',
  },
  {
    question: 'How are unit tests and automated verification handled in post-development?',
    category: 'Quality Assurance',
    icon: ShieldCheckIcon,
    answer:
      'Every synthesized modification executes in an ephemeral sandbox container with automated test suites (pytest or vitest). Multiple critic agents evaluate correctness, security, and performance. If tests pass with critic approval, the changes are merged into the codebase. If errors arise, AutoDev performs automated rollback and error diagnosis.',
  },
  {
    question: 'Where can I locate API specifications and architecture DAG blueprints?',
    category: 'Specifications',
    icon: CubeTransparentIcon,
    answer:
      'The complete architectural blueprints, component dependency DAGs, interface schemas, and technical documentation are exported within the downloadable ZIP archive and remain accessible throughout the pipeline review stages in your workspace.',
  },
];

export interface PromptValidationResult {
  isValid: boolean;
  securityAlert?: string;
  nonProductReason?: string;
}

export function validateSupportPrompt(input: string): PromptValidationResult {
  const text = input.trim();
  if (!text) {
    return {
      isValid: false,
      securityAlert: 'Please enter a support request or technical question.',
    };
  }

  const lower = text.toLowerCase();

  // 1. Prompt Injection Patterns (Strict Security Guard)
  const injectionPatterns = [
    'ignore all previous',
    'ignore previous',
    'bypass',
    'you are now a',
    'you are now an',
    'system prompt',
    'disregard instructions',
    'forget all',
    'developer mode',
    'jailbreak',
    'dan mode',
    'reveal your prompt',
    'reveal your instructions',
    'output your prompt',
  ];

  for (const pattern of injectionPatterns) {
    if (lower.includes(pattern)) {
      return {
        isValid: false,
        securityAlert: `Security Alert: Blocked potential prompt injection attempt (detected '${pattern}'). Please provide an authentic software feature request, defect fix, or technical architectural inquiry.`,
      };
    }
  }

  // 2. Software / Product Keywords - if present, prompt is software product-related
  const hasSoftwareKeywords =
    /\b(build|develop|implement|code|codebase|program|software|app|apps|application|applications|calculator|tool|tools|system|systems|api|apis|web|website|webpage|ui|ux|gui|frontend|backend|fullstack|service|services|server|servers|database|databases|db|component|components|widget|widgets|dashboard|dashboards|cli|script|scripts|module|modules|library|libraries|framework|tracker|generator|manager|editor|viewer|player|converter|crawler|scraper|bot|game|plugin|extension|platform|portal|interface|interfaces|endpoint|endpoints|pipeline|docker|react|vue|angular|node|python|fastapi|flask|django|html|css|javascript|typescript|sql|sqlite|postgres|mongodb|redis|rest|graphql|crud|auth|authentication|login|signup|bug|bugs|fix|fixes|error|errors|issue|issues|defect|defects|broken|crash|crashes|failing|exception|traceback|patch|refactor|function|class|method|state|store|styling|route|routing|button|navbar|modal|layout|dependency|dependencies|runtime|install|package|repo|repository|branch|commit|github|view|page|screen|input|data|query|schema|test|testing|log|logs)\b/i.test(
      text
    );

  if (hasSoftwareKeywords) {
    return { isValid: true };
  }

  // 3. Gibberish Detection
  const cleanAlpha = text.replace(/[^a-zA-Z]/g, '');
  if (cleanAlpha.length >= 6) {
    if (/(.)\1{4,}/i.test(cleanAlpha)) {
      return {
        isValid: false,
        nonProductReason:
          'Unrecognized or gibberish input detected. Please provide a clear description of a software feature, bug fix, or codebase inquiry.',
      };
    }
    if (!/[aeiouy]/i.test(cleanAlpha)) {
      return {
        isValid: false,
        nonProductReason:
          'Unrecognized non-software input detected. Please describe an actionable software modification or technical question.',
      };
    }
  }

  // 4. Non-Product / Non-Software Patterns (Greetings, Factual Q&A, Calculations, Creative Writing, Opinions)
  const nonProductPatterns: [RegExp, string][] = [
    [
      /^(hello|hi|hey|greetings|howdy|good\s+(morning|afternoon|evening|day)|sup|what\'?s\s+up)\b/i,
      'Greeting detected. AutoDev Post-Development Support Agent is designed to maintain and enhance software systems. Please describe a software feature to implement or defect to fix.',
    ],
    [
      /^(what|who|where|when|why|how)\s+(is|was|are|were|do|does|did|can|could|would|should|to|much|many)\b/i,
      'General knowledge or factual question detected. AutoDev builds and enhances software applications. Please specify a software feature, bug fix, or codebase architectural question.',
    ],
    [
      /^(what\'?s|who\'?s|where\'?s|when\'?s)\b/i,
      'General knowledge question detected. AutoDev is an automated software engineering platform. Please describe a software enhancement or codebase inquiry.',
    ],
    [
      /^(tell\s+me\s+about|explain\s+to\s+me\s+about)\b/i,
      'Informational query detected. AutoDev modifies software codebases. Please describe a software feature or tool to update.',
    ],
    [
      /^(distance|difference|capital|population|weather|temperature|height|weight|speed|mass|radius|diameter)\s+(between|of|in|from)\b/i,
      'General knowledge or scientific query detected. AutoDev maintains software applications. Please describe a software feature or defect to resolve.',
    ],
    [
      /^(calculate|compute|evaluate)\b/i,
      "Calculation query detected. AutoDev builds and refactors software systems rather than computing one-off calculations. If you want a calculation feature in your product, specify 'add a calculation module'.",
    ],
    [
      /^convert\s+[\d\.]+\s*[a-zA-Z]+\s+to\s+[a-zA-Z]+/i,
      "Unit conversion query detected. To add a conversion feature to your application, specify 'implement a unit converter'.",
    ],
    [
      /^[\d\+\-\*\/\^\(\)\.\s\=\%]+$/,
      'Mathematical expression detected. AutoDev develops software applications. Please describe a software feature or update.',
    ],
    [
      /^(write|compose|draft)\s+(a\s+|an\s+)?(poem|story|essay|song|joke|haiku|speech|article|letter|email|rhyme|novel)\b/i,
      'Creative writing request detected. AutoDev is an engineering platform designed for software systems and technical tools. Please describe a software feature or technical fix.',
    ],
    [
      /^(tell\s+me\s+(a\s+|an\s+)?([a-zA-Z]+\s+)?(joke|story|riddle))\b/i,
      'Conversational query detected. AutoDev is an automated engineering platform. Please provide a software feature request or bug report.',
    ],
    [
      /^(what\s+do\s+you\s+think\s+of|do\s+you\s+like|do\s+you\s+believe|what\s+is\s+your\s+opinion)\b/i,
      'Opinion query detected. AutoDev is focused exclusively on software design, code synthesis, and verification. Please submit a software modification specification.',
    ],
    [
      /^(how\s+are\s+you|how\s+is\s+it\s+going|are\s+you\s+an\s+ai|who\s+are\s+you)\b/i,
      'Conversational query detected. AutoDev builds software applications. Please describe a software project or feature to create.',
    ],
  ];

  for (const [pattern, reason] of nonProductPatterns) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        nonProductReason: reason,
      };
    }
  }

  // Word count check
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return {
      isValid: false,
      nonProductReason:
        'Request is too brief. Please describe the software feature, bug fix, or architectural question in more detail.',
    };
  }

  return { isValid: true };
}

export function isArchitecturalEnquiry(input: string): boolean {
  const text = input.trim().toLowerCase();
  const isQuestion =
    text.endsWith('?') ||
    /^(how|what|why|where|when|who|which|can you explain|explain|tell me|describe|is there|does this|could you clarify)\b/i.test(
      text
    );
  const enquiryKeywords =
    /\b(explain|how to|architecture|documentation|how does|what does|walkthrough|understand|query|question|clarify|overview|structure|stack|details|meaning|inspect|inspecting)\b/i;
  const bugKeywords =
    /\b(bug|fix|error|crash|broken|fails|failing|exception|issue|defect|regression|incorrect|unexpected|not working|doesn't work|problem|stacktrace|traceback|glitch|freeze|stuck|hang|typo)\b/i;
  const featureKeywords =
    /\b(add|new|feature|implement|create|build|support|enable|integrate|extend|expand|allow|introduce|option|capability|button|page|component|endpoint|api)\b/i;

  if (bugKeywords.test(text)) {
    if (/^(explain|why)\b/i.test(text) && !/(fix|resolve|patch|repair|solve)/i.test(text)) {
      return true;
    }
    return false;
  }
  if (featureKeywords.test(text)) {
    return false;
  }
  if (isQuestion || enquiryKeywords.test(text)) {
    return true;
  }
  return false;
}

export const StagePostDevRequest: React.FC<StagePostDevRequestProps> = ({
  onAdvance,
  className = '',
}) => {
  const [prompt, setPrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [nonProductReason, setNonProductReason] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const setStorePrompt = useAppStore((s) => s.setPostCompletionPrompt);
  const setPostCompletionMode = useAppStore((s) => s.setPostCompletionMode);
  const setPostCompletionResponse = useAppStore((s) => s.setPostCompletionResponse);
  const setPostCompletionStatus = useAppStore((s) => s.setPostCompletionStatus);

  const textareaRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      const msg = 'Please enter your support request or technical question.';
      setErrorMessage(msg);
      try {
        useSessionStore.getState().showWarningToast(msg, 'Input Required');
      } catch { /* ignore */ }
      return;
    }

    setErrorMessage(null);
    setSecurityAlert(null);
    setNonProductReason(null);

    // Guard against prompt injections and non-product related requests
    const validation = validateSupportPrompt(trimmed);
    if (!validation.isValid) {
      const alertMsg = validation.securityAlert || validation.nonProductReason || 'Invalid input detected.';
      if (validation.securityAlert) {
        setSecurityAlert(validation.securityAlert);
      } else if (validation.nonProductReason) {
        setNonProductReason(validation.nonProductReason);
      }
      try {
        useSessionStore.getState().showWarningToast(alertMsg, 'Input Required');
      } catch { /* ignore */ }
      return;
    }

    const isEnquiry = isArchitecturalEnquiry(trimmed);
    setStorePrompt(trimmed);
    setPostCompletionMode(isEnquiry ? 'query' : 'modify');
    setPostCompletionResponse('');
    setPostCompletionStatus('pending');
    onAdvance(11);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div
      id="stagePostDevRequest"
      className={`h-full flex flex-col w-full max-w-6xl mx-auto px-4 py-3 space-y-6 select-none ${className}`}
    >
      {/* ── Top Header: Standard AutoDev Agent Header (No back arrows or back to results button) ── */}
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
            <WrenchScrewdriverIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            Post-Development Support Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Autonomous software enhancement, defect resolution, and technical architectural guidance for your verified codebase.
        </p>
      </div>

      {securityAlert && (
        <div
          id="securityAlertSection"
          className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm text-rose-200 flex items-center justify-between backdrop-blur-xl shadow-lg"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <ShieldExclamationIcon className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="leading-relaxed">{securityAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityAlert(null)}
            className="text-xs text-rose-300 hover:text-white font-semibold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-200 hover:text-white font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-Product Related Request Gate */}
      {nonProductReason && (
        <div
          id="nonProductGateSection"
          className="p-5 sm:p-6 rounded-3xl bg-amber-950/40 border border-amber-500/30 backdrop-blur-xl space-y-3 shadow-lg"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-300">
            <InformationCircleIcon className="w-4.5 h-4.5 text-amber-400 shrink-0" />
            <span>Non-Product Related Request Detected</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">{nonProductReason}</p>
          <div className="text-[11px] sm:text-xs text-slate-400">
            AutoDev Post-Development Support Agent exclusively maintains, enhances, and clarifies your generated software product. Please provide a software feature request, bug fix report, or technical architectural inquiry.
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              id="rephraseSupportRequestBtn"
              onClick={() => {
                setNonProductReason(null);
                textareaRef.current?.focus();
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
            >
              Rephrase Support Request
            </button>
          </div>
        </div>
      )}

      {/* ── Input Surface: Glassmorphic Textbox Area Component Card ── */}
      <div
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 overflow-hidden transition-all">
          <SmoothInput
            id="postDevTextarea"
            ref={textareaRef}
            autoFocus={true}
            as="textarea"
            autoResize={true}
            minHeight={120}
            maxHeight={260}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (securityAlert) setSecurityAlert(null);
              if (nonProductReason) setNonProductReason(null);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Describe any continuous feature enhancement, report a codebase bug to fix, or ask technical questions regarding architecture, runtime setup, and APIs..."
            caretColorClass="text-white/80 font-semibold"
            wrapperClassName="w-full bg-transparent border-none overflow-hidden"
            className="w-full bg-transparent border-none outline-none focus:outline-none transition-all text-sm sm:text-base text-white placeholder:text-white/40 font-sans leading-relaxed resize-none p-4 sm:p-5"
          />
        </div>

        {/* Card Action Bar: Proceed Button on Right (Classification type removed from UI) */}
        <div className="flex items-center justify-end pt-2 border-t border-white/10">
          <button
            id="postDevSubmitBtn"
            type="button"
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="px-6 py-2.5 sm:py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold text-xs tracking-wide border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <span>PROCEED</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── New FAQs Section: Common Queries Regarding AutoDev Generated Software ── */}
      <div
        id="postDevFaqSection"
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 sm:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90">
              <QuestionMarkCircleIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Frequently Asked Questions &amp; Runtime Guidance
              </h3>
              <p className="text-[11px] text-slate-400">
                Essential reference on executing, extending, and publishing your generated software
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {FAQS_DATA.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            const Icon = faq.icon;

            return (
              <div
                key={`faq-${idx}`}
                className="rounded-2xl border border-white/[0.06] bg-black/20 hover:border-white/15 transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 text-slate-300">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200">
                      {faq.question}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-slate-400"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                        <p className="text-xs text-slate-300 leading-relaxed font-sans pl-10">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StagePostDevRequest;
