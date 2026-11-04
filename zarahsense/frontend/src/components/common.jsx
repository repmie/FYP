import { categoryColor, categoryTint } from '@/lib/aqi';

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-card border border-border rounded-xl card-shadow ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action, testid }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6" data-testid={testid}>
      <div>
        <h2 className="text-[20px] font-semibold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function AqiChip({ category, className = '', withDot = true }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium text-foreground ${className}`}
      style={{ backgroundColor: categoryTint(category) }}
      data-testid="aqi-category-chip"
    >
      {withDot && (
        <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: categoryColor(category) }} />
      )}
      {category}
    </span>
  );
}

export function Loading({ label = 'Loading…', testid = 'loading-state' }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground" data-testid={testid}>
      <span className="w-4 h-4 mr-3 rounded-full border-2 border-border border-t-primary animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry, testid = 'error-state' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid={testid}>
      <p className="text-sm text-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Please try again in a moment.</p>
      {onRetry && (
        <button onClick={onRetry} className="h-10 px-4 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors" data-testid="error-retry-button">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, testid = 'empty-state' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center" data-testid={testid}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message && <p className="text-sm text-muted-foreground mt-1 max-w-md">{message}</p>}
    </div>
  );
}

export function ButtonPrimary({ className = '', children, ...props }) {
  return (
    <button
      className={`h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonSecondary({ className = '', active = false, children, ...props }) {
  return (
    <button
      className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? 'border-primary text-primary bg-primary/5' : 'border-border text-foreground hover:bg-secondary'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}