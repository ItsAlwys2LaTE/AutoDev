import type { ComponentSpec } from '../../types';

export interface ComponentCardProps {
  component: ComponentSpec;
  sharedTechStack?: string[];
  sharedDockerImage?: string;
  onInteract?: () => void;
  className?: string;
}

export function ComponentCard({
  component,
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

  return (
    <div
      onClick={onInteract}
      tabIndex={0}
      role="region"
      aria-label={`Component ${component.component_name}`}
      className={`glass-card bg-slate-800/90 dark:bg-[#1e293b]/90 rounded-xl border border-slate-700 dark:border-white/10 p-5 relative shadow-sm flex flex-col justify-between hover:border-cyan-500/40 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${className}`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="font-mono text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-medium">
            {`ID: ${component.component_id}`}
          </span>
          <span className="text-xs font-mono bg-slate-700/80 text-slate-300 border border-slate-600 px-2 py-0.5 rounded font-medium">
            {`Order: ${component.priority_order ?? 1}`}
          </span>
        </div>

        {/* Component Name */}
        <h4 className="font-bold text-slate-100 text-base mb-1.5 tracking-tight">
          {component.component_name}
        </h4>

        {/* Description */}
        <p className="text-xs text-slate-300 dark:text-slate-400 mb-3.5 leading-relaxed">
          {component.description}
        </p>
      </div>

      <div className="space-y-2.5 pt-2.5 border-t border-slate-700/60">
        {/* Tech Stack Chips */}
        {techStack.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1">
              Stack:
            </span>
            {techStack.map((tech) => (
              <span
                key={tech}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/60 font-mono"
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
          <span className="font-mono text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
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
                  className="font-mono text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-1.5 py-0.5 rounded"
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
