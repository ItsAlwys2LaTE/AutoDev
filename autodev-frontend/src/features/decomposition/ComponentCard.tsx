import type { ComponentSpec } from '../../types';
import { getComponentTheme, formatComponentTitle } from '../../utils/componentTheme';

export interface ComponentCardProps {
  component: ComponentSpec;
  componentNumber?: string;
  componentIndex?: number;
  allComponents?: Array<{ component_id: string }>;
  sharedTechStack?: string[];
  sharedDockerImage?: string;
  onInteract?: () => void;
  className?: string;
}

export function ComponentCard({
  component,
  componentNumber,
  componentIndex,
  allComponents,
  sharedTechStack = [],
  sharedDockerImage = 'node:20-alpine',
  onInteract,
  className = '',
}: ComponentCardProps) {
  const techStack =
    component.tech_stack && component.tech_stack.length > 0
      ? component.tech_stack
      : sharedTechStack;

  const dockerImage = component.docker_image || sharedDockerImage;
  const dependencies = component.dependencies_on || [];

  const theme = getComponentTheme(
    componentNumber || (componentIndex !== undefined ? componentIndex : component.component_id),
    allComponents
  );

  const displayTitle = formatComponentTitle(
    componentNumber || theme.number,
    component.component_name
  );

  return (
    <div
      onClick={onInteract}
      tabIndex={0}
      role="region"
      aria-label={`Component ${component.component_name}`}
      style={{
        backdropFilter: 'blur(14px)',
        backgroundColor: theme.bgTint,
        borderColor: theme.borderTint,
      }}
      className={`rounded-2xl backdrop-blur-md border p-5 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col justify-between hover:border-white/25 transition-all focus:outline-none focus:ring-1 focus:ring-white/20 overflow-hidden ${className}`}
    >
      {/* Soft Specular Ambient Glow line matching component hue */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.color}40, transparent)`,
        }}
        aria-hidden="true"
      />

      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="font-mono text-xs text-slate-300 bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 rounded-full font-medium">
            {`ID: ${component.component_id}`}
          </span>
          <span className="text-xs font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08] px-2 py-0.5 rounded-md font-medium">
            {`Order: ${component.priority_order ?? 1}`}
          </span>
        </div>

        {/* Component Name */}
        <h4 className="font-bold text-slate-100 text-base mb-1.5 tracking-tight">
          {displayTitle}
        </h4>

        {/* Description */}
        <p className="text-xs text-slate-300 mb-3.5 leading-relaxed font-sans">
          {component.description}
        </p>
      </div>

      <div className="space-y-2.5 pt-2.5 border-t border-white/[0.07]">
        {/* Tech Stack Chips */}
        {techStack.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1">
              Stack:
            </span>
            {techStack.map((tech) => (
              <span
                key={tech}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/[0.08] font-mono"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {/* Docker Image Tag */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Image:
          </span>
          <span className="font-mono text-[11px] text-slate-300 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-md">
            {dockerImage}
          </span>
        </div>

        {/* Dependency Tags */}
        <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Depends on:
          </span>
          {dependencies.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {dependencies.map((dep) => (
                <span
                  key={dep}
                  className="font-mono text-[11px] text-slate-300 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded"
                >
                  {dep}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-500 italic">None (Root Component)</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ComponentCard;
