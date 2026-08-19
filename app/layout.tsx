import type { Metadata, Viewport } from "next";
import { archivo, geistMono, geistSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aditya Zulkarnaen — Creative Frontend Developer",
  description:
    "Creative frontend developer. I turn scattered ideas into interfaces that feel inevitable.",
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-ink">
        {children}
      </body>
    </html>
  );
}
