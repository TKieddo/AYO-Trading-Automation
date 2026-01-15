import type { Metadata } from "next";
// Use system UI font stack to avoid external font fetches
import "./globals.css";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";

const systemFontClass = "font-sans";

export const metadata: Metadata = {
  title: "AYO - Trading Dashboard",
  description: "AI Trading Agent Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={systemFontClass} suppressHydrationWarning> 
        <div className="min-h-screen flex flex-col">
          <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 flex-1 flex flex-col">
            <Topbar />
            <main className="pt-2 space-y-6 flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}

