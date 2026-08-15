import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import KrouHubAuthBar from "@/components/KrouHubAuthBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KrouHub Link — Acortador de Enlaces y UTM Builder",
  description: "Plataforma de acortamiento de enlaces y generador UTM para agencias de desarrollo web integrada con KrouHub",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
        <AuthProvider>
          <KrouHubAuthBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

