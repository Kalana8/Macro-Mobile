import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Macro — Field Audit & Attendance",
  description: "Employee attendance, audits, checklists and communication.",
  manifest: "/manifest.json",
  icons: { icon: "/uploads/macro-logo.webp", apple: "/uploads/macro-logo.webp" },
};

export const viewport: Viewport = {
  themeColor: "#0E62D1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
