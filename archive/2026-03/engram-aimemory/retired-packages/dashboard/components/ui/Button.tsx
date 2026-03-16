import { clsx } from "clsx";
import { type HTMLMotionProps, motion } from "framer-motion";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-500 hover:bg-amber-400 text-[#03020A] font-semibold shadow-[0_0_12px_rgba(242,169,59,0.2)] hover:shadow-[0_0_20px_rgba(242,169,59,0.35)]",
  secondary:
    "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] text-[#A09BB8]",
  ghost:
    "bg-transparent hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-[#A09BB8]",
  danger: "bg-rose-500/80 hover:bg-rose-500/70 text-white shadow-[0_0_12px_rgba(224,92,127,0.15)]",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  whileHover,
  whileTap,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      {...props}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : (whileHover ?? { scale: 1.02 })}
      whileTap={whileTap ?? { scale: 0.98 }}
      className={clsx(
        "rounded-lg font-medium transition-all duration-150 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:ring-offset-2 focus:ring-offset-[#090818]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        "inline-flex items-center justify-center gap-1.5",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {loading && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full flex-shrink-0"
        />
      )}
      {children}
    </motion.button>
  );
}
