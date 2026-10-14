/**
 * AutoDev Landing Page
 *
 * Implements the pristine hero landing page reflecting the skeletal layout
 * in AutoDev_UI/Landing Page.JPG:
 * - Animated stroke-by-stroke cursive "AutoDev" brand logo with traveling ink glow
 * - Official product tagline
 * - Centered frosted glass "Get Started" call-to-action button
 * - Seamless integration with the 3D AeroShards ambient background
 * - Strict zero-emoji compliance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { CursiveAutoDevLogo } from '../../components/CursiveAutoDevLogo';
import { SpecularButton } from '../../components/SpecularButton';

export interface StageLandingProps {
  onGetStarted: () => void;
  className?: string;
}

export const StageLanding: React.FC<StageLandingProps> = ({
  onGetStarted,
  className = '',
}) => {
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  // Guarantee entrance reveal after stroke animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealed(true);
    }, 4200);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = useCallback(() => {
    setIsRevealed(false);
  }, []);

  const handleComplete = useCallback(() => {
    setIsRevealed(true);
  }, []);

  return (
    <div
      id="stageLanding"
      className={`h-full min-h-[85vh] flex flex-col items-center justify-center text-center px-4 pt-16 sm:pt-24 md:pt-28 pb-12 max-w-5xl mx-auto space-y-10 select-none text-slate-100 ${className}`}
    >
      {/* Brand Hero with Stroke-by-Stroke Cursive Handwriting Logo */}
      <div className="space-y-6 w-full flex flex-col items-center">
        <div className="w-full max-w-3xl sm:max-w-4xl lg:max-w-5xl mx-auto flex items-center justify-center px-4 sm:px-6">
          <CursiveAutoDevLogo
            variant="hero"
            replayable={true}
            autoPlay={true}
            strokeDuration={4200}
            onStart={handleStart}
            onComplete={handleComplete}
            className="w-full"
          />
        </div>

        {/* Tagline text smoothly fades in and rises first once stroke completes and fill starts */}
        <p
          style={{ color: '#cbd5e1' }}
          className={`text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-sans leading-relaxed tracking-normal px-4 transition-all duration-700 ease-out ${
            isRevealed
              ? 'opacity-100 translate-y-0 delay-150'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          Multi-agent AI pipeline that designs, builds, tests, and self-corrects software from a single prompt.
        </p>
      </div>

      {/* Primary Call to Action: Specular Get Started Button smoothly fades in and rises second */}
      <div
        className={`pt-2 transition-all duration-700 ease-out ${
          isRevealed
            ? 'opacity-100 translate-y-0 delay-500'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <SpecularButton
          id="landingGetStartedBtn"
          type="button"
          onClick={onGetStarted}
          forceDark={true}
          size="lg"
          radius={20}
          tint="#ffffff"
          tintOpacity={0.06}
          blur={24}
          lineColor="#ffffff"
          baseColor="#000000"
          textColor="#ffffff"
          intensity={1.5}
          shineSize={18}
          shineFade={40}
          thickness={1.6}
          speed={0.4}
          followMouse={true}
          proximity={240}
          autoAnimate={true}
          className="!px-10 !py-4 text-base font-semibold tracking-wide cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:scale-[1.03] active:scale-[0.98] transition-transform duration-300 !text-white"
        >
          <span className="text-white" style={{ color: '#ffffff' }}>Get Started</span>
          <ArrowRightIcon className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform ml-1 inline-block" style={{ color: '#ffffff' }} />
        </SpecularButton>
      </div>
    </div>
  );
};

export default StageLanding;
