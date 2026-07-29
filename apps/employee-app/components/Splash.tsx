import Image from "next/image";

export function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white">
      <Image src="/uploads/footer.webp" alt="MACRO Property Services" width={160} height={75} className="h-[75px] w-auto" priority />
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  );
}
