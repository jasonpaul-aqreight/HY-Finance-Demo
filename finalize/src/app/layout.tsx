import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ScrollPreserver } from "@/components/layout/ScrollPreserver";
import { SWRProvider } from "@/components/layout/SWRProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hoi-Yong Finance — Dashboard",
  description: "Consolidated finance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SWRProvider>
          <TooltipProvider>
            <SidebarProvider>
              <div className="flex h-screen">
                <AppSidebar />
                <ScrollPreserver className="flex-1 overflow-y-auto">
                  {children}
                </ScrollPreserver>
              </div>
            </SidebarProvider>
          </TooltipProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
