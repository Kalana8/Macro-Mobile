"use client";

export function SuccessOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-olive/20">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5C6900" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div className="text-base font-bold text-text-dark">{message}</div>
    </div>
  );
}
