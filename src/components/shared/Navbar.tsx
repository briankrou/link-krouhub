"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, useScroll, useSpring, MotionValue } from "framer-motion";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { X, Menu, Monitor, Search, LogIn, LogOut, User, LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import DesktopNavbar from "./DesktopNavbar";
import MobileNavbar from "./MobileNavbar";
import SearchModal from "../forms/Search";

import logoBlanco from "../../../public/KrouHub_Logo_blanco.png";
import logoNegro from "../../../public/KrouHub_Logo_negro.png";

export interface SubLink {
  name: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export interface NavLink {
  name: string;
  href: string;
  subLinks?: SubLink[];
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const { user, isAuthenticated, logout, krouhubUrl } = useAuth();
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {

    setMounted(true);
    const handleScroll = (): void => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const { scrollYProgress }: { scrollYProgress: MotionValue<number> } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [currentLogo, setCurrentLogo] = useState(logoBlanco);

  useEffect(() => {
    if (mounted) {
      const activeTheme = resolvedTheme || theme;

      setCurrentLogo(activeTheme === "dark" ? logoBlanco : logoNegro);
    }
  }, [mounted, resolvedTheme, theme]);

  const navLinks: NavLink[] = [
    { name: "Inicio", href: "/" },
    { name: "Nosotros", href: "/nosotros" },
    {
      name: "Servicios",
      href: "/servicios",
      subLinks: [
        {
          name: "Diseño Web",
          href: "/servicios/diseno-paginas-web",
          description: "Páginas profesionales, rápidas y optimizadas para busquedas en Google.",
          icon: Monitor,
        },
        {
          name: "Posicionamiento WEB",
          href: "/servicios/posicionamiento-web",
          description: "Escala puestos en buscadores y atrae más tráfico cualificado.",
          icon: Search,
        },
      ],
    },
    { name: "Blog", href: "/blog" },
  ];

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Cerrar dropdown al cambiar de ruta
  useEffect(() => {
    setActiveDropdown(null);

    setIsOpen(false);
  }, [pathname]);

  if (!mounted) return <nav className="fixed top-0 w-full h-[80px] z-[100] bg-transparent" />;

  return (
    <nav
      className={`fixed top-0 z-[100] w-full transition-all duration-500 ${scrolled || !isHome || isOpen || isSearchOpen
        ? "bg-background/80 backdrop-blur-xl py-3 border-b border-border/40 shadow-sm"
        : "bg-transparent py-6"
        }`}
    >
      <motion.div
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 origin-left z-[101]"
        style={{ scaleX }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center h-14">
          {/* LOGO */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-shrink-0 z-[160]">
            <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center">
              <Image
                src={currentLogo}
                alt="Logo Krou Hub"
                width={100}
                height={60}
                priority
                sizes="100px"
                quality={50}
                className="h-11 w-[90px]"
                
              />
            </Link>
          </motion.div>

          {/* MENÚ DESKTOP */}
          <DesktopNavbar
            navLinks={navLinks}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            setIsSearchOpen={setIsSearchOpen}
          />

          {/* BOTÓN MÓVIL (Trigger hamburguesa) */}
          <div className="md:hidden flex items-center gap-3 z-[160]">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 rounded-2xl bg-foreground/5 dark:bg-white/10 backdrop-blur-md text-foreground transition-all active:scale-90 cursor-pointer"
              aria-label="Buscar"
            >
              <Search size={22} />
            </button>
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Link
                  href="/perfil"
                  className="p-2.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                  aria-label="Perfil de usuario"
                  title="Perfil"
                >
                  <User size={22} />
                </Link>
                <button
                  onClick={logout}
                  className="p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all active:scale-90 cursor-pointer"
                  aria-label="Cerrar Sesión"
                  title="Cerrar Sesión"
                >
                  <LogOut size={22} />
                </button>
              </>
            ) : (
              <a
                href={`${krouhubUrl}/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                aria-label="Iniciar Sesión en KrouHub"
                title="Iniciar Sesión en KrouHub"
              >
                <LogIn size={22} />
              </a>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-2xl bg-foreground/5 dark:bg-white/10 backdrop-blur-md text-foreground transition-all active:scale-90 cursor-pointer"
              aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* MENÚ MÓVIL */}
      <MobileNavbar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        navLinks={navLinks}
      />

      {/* MODAL BÚSQUEDA */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </nav>
  );
};

export default Navbar;