// Shown in place of the page content while navigating between admin pages —
// the sidebar/topbar (rendered by the (admin) layout around {children})
// stays put, so this is just a spinner for the content area, not a
// full-screen splash like app/loading.tsx.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  );
}
