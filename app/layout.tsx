import "./globals.css";
import type { Metadata } from "next";

import Script from "next/script";
export const metadata: Metadata = {
  title: "TJA Studio",
  description: "Professional TJA chart editor for Taiko-style rhythm games"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
