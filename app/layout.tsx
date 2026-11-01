import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
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
  title: "LendLoop",
  description: "Borrow what you need. Lend what you don't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ClerkProvider must wrap ConvexClientProvider, because Convex reads the Clerk session. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ClerkProvider>
            <ConvexClientProvider>
              <SiteHeader />
              {children}
            </ConvexClientProvider>
          </ClerkProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
