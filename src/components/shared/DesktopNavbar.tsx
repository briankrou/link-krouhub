"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ChevronDown, Search, LogIn, LogOut, User, Wrench } from "lucide-react";
import { NavLink } from "./Navbar";

interface DesktopNavbarProps {
    navLinks: NavLink[];
    activeDropdown: string | null;
    setActiveDropdown: (name: string | null) => void;
    setIsSearchOpen: (isOpen: boolean) => void;
}

export default function DesktopNavbar({
    navLinks,
    activeDropdown,
    setActiveDropdown,
    setIsSearchOpen,
}: DesktopNavbarProps) {
    const { isAuthenticated, logout, krouhubUrl } = useAuth();
    const krouhubBase = krouhubUrl || process.env.NEXT_PUBLIC_KROUHUB_BASE_URL || "http://localhost:3000";

    return (
        <div className="hidden md:flex space-x-2 items-center">
            {navLinks.map((link) => (
                <div
                    key={link.name}
                    className="relative"
                    onMouseEnter={() => {
                        if (link.subLinks) {
                            setActiveDropdown(link.name);
                        }
                    }}
                    onMouseLeave={() => setActiveDropdown(null)}
                >
                    <button
                        onClick={() => {
                            if (!link.subLinks) {
                                window.location.href = link.href;
                            }
                        }}
                        className="px-5 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-all relative flex items-center gap-1.5 cursor-pointer group"
                    >
                        <span>{link.name}</span>
                        {link.subLinks && (
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-300 ${activeDropdown === link.name ? "rotate-180 text-cyan-500" : "text-muted-foreground group-hover:text-foreground"}`}
                            />
                        )}
                        <span className="absolute inset-x-5 -bottom-1 h-[2px] bg-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                    </button>

                    {/* Dropdown Desktop Premium (Estilo Stripe) */}
                    <AnimatePresence>
                        {link.subLinks && activeDropdown === link.name && (
                            <motion.div
                                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="absolute top-full left-1/2 -translate-x-[40%] mt-2.5 w-[340px] bg-background/95 dark:bg-slate-950/95 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl p-3.5 z-[110] overflow-hidden"
                            >
                                {/* Glow sutil de fondo */}
                                <div className="absolute inset-x-0 -top-12 h-20 bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent blur-md pointer-events-none" />

                                <div className="relative z-10 flex flex-col gap-1">
                                    {link.subLinks.map((sub) => {
                                        const Icon = sub.icon;
                                        return (
                                            <Link
                                                key={sub.name}
                                                href={sub.href}
                                                className="group/item flex items-start gap-4 p-3 rounded-2xl transition-all hover:bg-slate-500/5 dark:hover:bg-white/5"
                                            >
                                                <div className="p-2 rounded-xl bg-cyan-500/5 dark:bg-cyan-500/10 text-cyan-500 group-hover/item:bg-gradient-to-br group-hover/item:from-cyan-500 group-hover/item:to-blue-600 group-hover/item:text-white transition-all duration-300">
                                                    <Icon size={18} />
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-extrabold text-foreground group-hover/item:text-cyan-500 transition-colors">
                                                        {sub.name}
                                                    </span>
                                                    <p className="text-xs text-muted-foreground leading-snug">
                                                        {sub.description}
                                                    </p>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}

            <button
                onClick={() => setIsSearchOpen(true)}
                className="ml-2 p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                aria-label="Buscar"
            >
                <Search size={18} />
            </button>

            <motion.a
                href={`${krouhubBase}/contactanos`}
                whileHover={{
                    scale: 1.03,
                    boxShadow: "0 0 25px rgba(6, 182, 212, 0.4)",
                }}
                className="ml-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold px-6 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all block shadow-md shadow-cyan-500/10"
            >
                Contacto
            </motion.a>

            <div className="ml-4 pl-4 border-l border-border/50 flex items-center gap-2">
                <ThemeToggle />
                {isAuthenticated ? (
                    <>
                        <a
                            href={`${krouhubBase}/herramientas`}
                            className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all flex items-center cursor-pointer"
                            aria-label="Herramientas Exclusivas"
                            title="Herramientas Exclusivas"
                        >
                            <Wrench size={18} />
                        </a>
                        <a
                            href={`${krouhubBase}/perfil`}
                            className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 transition-all flex items-center cursor-pointer"
                            aria-label="Perfil de usuario"
                            title="Perfil"
                        >
                            <User size={18} />
                        </a>
                         <a
                            href="/logout"
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all cursor-pointer flex items-center justify-center"
                            aria-label="Cerrar Sesión"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={18} />
                        </a>
                    </>
                ) : (
                    <a
                        href={`${krouhubBase}/login`}
                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all flex items-center cursor-pointer"
                        aria-label="Iniciar Sesión en KrouHub"
                        title="Iniciar Sesión en KrouHub"
                    >
                        <LogIn size={18} />
                    </a>
                )}
            </div>
        </div>
    );
}
