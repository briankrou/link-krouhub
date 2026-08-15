"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Evitar errores de hidratación
    React.useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="p-2 w-9 h-9" />;

    const currentTheme = resolvedTheme || theme;
    const isDark = currentTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
            aria-label="Cambiar tema"
        >
            <div className="relative w-5 h-5 overflow-hidden">
                <motion.div
                    initial={false}
                    animate={{ y: isDark ? 0 : -25 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="flex flex-col items-center"
                >
                    {/* Icono Luna (Modo Oscuro) */}
                    <Moon size={20} className="text-cyan-400" />

                    {/* Espaciador */}
                    <div className="h-[5px]" />

                    {/* Icono Sol (Modo Claro) */}
                    <Sun size={20} className="text-orange-400" />
                </motion.div>
            </div>

            {/* Glow decorativo al hacer hover */}
            <div className="absolute inset-0 rounded-lg bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors" />
        </button>
    );
}