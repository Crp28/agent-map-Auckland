import type { Metadata, Viewport } from "next";
import "@arcgis/core/assets/esri/themes/light/main.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Location Finder",
  description: "Auckland sold property and people map",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
