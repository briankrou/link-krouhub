"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useTheme } from "next-themes";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { NavLink } from "./Navbar";

interface MobileNavbarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    navLinks: NavLink[];
}

// Curva de easing tipada como tupla exacta (Framer Motion espera
// [number, number, number, number] para curvas cubic-bezier, no number[])
const easeOutExpo = [0.22, 1, 0.36, 1] as const;

// Variants para el stagger de los links principales
const listVariants: Variants = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.1,
        },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: easeOutExpo },
    },
};

export default function MobileNavbar({
    isOpen,
    setIsOpen,
    navLinks,
}: MobileNavbarProps) {
    const pathname = usePathname();
    const [isServicesExpanded, setIsServicesExpanded] = useState<boolean>(false);

    // Bloquea el scroll del body y oculta widgets flotantes (WhatsApp, chat, etc.)
    // mientras el menú está abierto
    useEffect(() => {
        if (isOpen) {
            const original = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            document.body.classList.add("mobile-menu-open");
            return () => {
                document.body.style.overflow = original;
                document.body.classList.remove("mobile-menu-open");
            };
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 z-[150] min-h-[100dvh] bg-background/95 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col md:hidden px-6 pb-28 overflow-y-auto"
                    style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
                >
                    {/* Estilos globales: ocultar widgets flotantes (WhatsApp, chat, etc.)
                        mientras el menú está abierto. Ajusta los selectores de abajo
                        para que coincidan con el widget real que usas en el sitio. */}
                    <style jsx global>{`
                        .mobile-menu-open [class*="whatsapp" i],
                        .mobile-menu-open [id*="whatsapp" i],
                        .mobile-menu-open [class*="chat-widget" i],
                        .mobile-menu-open [id*="chat-widget" i],
                        .mobile-menu-open [class*="tawk" i],
                        .mobile-menu-open [id*="tawk" i],
                        .mobile-menu-open [class*="crisp" i],
                        .mobile-menu-open [id*="crisp" i] {
                            opacity: 0 !important;
                            pointer-events: none !important;
                            transition: opacity 0.15s ease;
                        }
                    `}</style>

                    {/* Glows de fondo, calibrados por separado para tema claro y oscuro */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-[10%] -left-[10%] w-[75%] h-[45%] bg-cyan-500/[0.06] dark:bg-cyan-500/10 blur-[130px] rounded-full" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[75%] h-[45%] bg-indigo-600/[0.06] dark:bg-indigo-600/10 blur-[130px] rounded-full" />
                    </div>

                    {/* Spacer para respetar el espacio del header persistente (Logo y botones en z-[160]) */}
                    <div
                        className="relative z-10 shrink-0"
                        style={{
                            paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
                            paddingBottom: "1.5rem",
                            minHeight: "44px"
                        }}
                    />

                    <div className="relative pt-6 z-10 flex flex-col h-full justify-between">
                        {/* Enlaces Principales */}
                        <motion.div
                            variants={listVariants}
                            initial="hidden"
                            animate="show"
                            className="flex flex-col"
                        >
                            {navLinks.map((link) => {
                                const isActive = link.href && pathname === link.href;

                                return (
                                    <motion.div
                                        key={link.name}
                                        variants={itemVariants}
                                        className="border-b border-border/40 py-1.5 "
                                    >
                                        {link.subLinks ? (
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() =>
                                                        setIsServicesExpanded((isExpanded) => !isExpanded)
                                                    }
                                                    className="w-full text-left py-3 flex items-center justify-between gap-4 cursor-pointer group"
                                                >
                                                    <span
                                                        className={`text-[28px] leading-none font-black tracking-tight transition-colors ${isServicesExpanded
                                                            ? "text-cyan-500"
                                                            : "text-foreground group-active:text-cyan-500"
                                                            }`}
                                                    >
                                                        {link.name}
                                                    </span>
                                                    <span
                                                        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center border transition-colors ${isServicesExpanded
                                                            ? "bg-cyan-500 border-cyan-500 text-white"
                                                            : "border-border/60 text-muted-foreground"
                                                            }`}
                                                    >
                                                        <ChevronDown
                                                            size={18}
                                                            className={`transition-transform duration-300 ${isServicesExpanded ? "rotate-180" : ""
                                                                }`}
                                                        />
                                                    </span>
                                                </button>

                                                {/* Acordeón de Servicios */}
                                                <AnimatePresence initial={false}>
                                                    {isServicesExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="flex flex-col gap-2 pb-4">
                                                                {link.subLinks.map((sub) => {
                                                                    const SubIcon = sub.icon;
                                                                    return (
                                                                        <Link
                                                                            key={sub.name}
                                                                            href={sub.href}
                                                                            onClick={() => setIsOpen(false)}
                                                                            className="flex items-center gap-3 p-3 rounded-2xl bg-foreground/[0.03] active:bg-cyan-500/10 transition-colors"
                                                                        >
                                                                            <div className="h-10 w-10 shrink-0 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                                                                                <SubIcon size={18} />
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-sm font-extrabold text-foreground">
                                                                                    {sub.name}
                                                                                </span>
                                                                                <span className="text-xs text-muted-foreground/80 leading-snug truncate">
                                                                                    {sub.description}
                                                                                </span>
                                                                            </div>
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <Link
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className="py-3 flex items-center justify-between gap-4"
                                            >
                                                <span
                                                    className={`text-[28px] leading-none font-black tracking-tight transition-colors ${isActive
                                                        ? "text-cyan-500"
                                                        : "text-foreground active:text-cyan-500"
                                                        }`}
                                                >
                                                    {link.name}
                                                </span>
                                                {isActive && (
                                                    <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                                                )}
                                            </Link>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </motion.div>

                        {/* Botón de Contacto al Pie */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                            className="mt-10 pt-6 border-t border-border/40 flex flex-col gap-4"
                        >
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">
                                ¿Tienes un proyecto en mente?
                            </span>
                            <Link
                                href="/contactanos"
                                onClick={() => setIsOpen(false)}
                                className="w-full"
                            >
                                <motion.div
                                    animate={{
                                        boxShadow: [
                                            "0 0 0px rgba(6, 182, 212, 0)",
                                            "0 0 20px rgba(6, 182, 212, 0.3)",
                                            "0 0 0px rgba(6, 182, 212, 0)",
                                        ],
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                                >
                                    Hablemos / Contáctanos
                                    <ArrowUpRight size={16} />
                                </motion.div>
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
