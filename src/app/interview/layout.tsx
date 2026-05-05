export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {children}
    </div>
  );
}
