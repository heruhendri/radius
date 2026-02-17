"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-md",
        // Scan line effect
        "before:absolute before:inset-0 before:pointer-events-none",
        "before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.02)_2px,rgba(0,255,255,0.02)_4px)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "w-full max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto",
          "grid gap-0 p-0 rounded-2xl",
          // Cyberpunk styling
          "bg-background/95 backdrop-blur-xl",
          "border-2 border-cyan-500/30",
          "shadow-[0_0_50px_rgba(0,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]",
          // Animation
          "duration-300",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        {...props}
      >
        {/* Top neon line */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        
        {children}
        
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "absolute top-4 right-4 rounded-lg p-2",
              "text-muted-foreground hover:text-cyan-400",
              "bg-white/5 hover:bg-white/10",
              "border border-white/10 hover:border-cyan-400/30",
              "ring-offset-background transition-all duration-300",
              "focus:ring-2 focus:ring-cyan-400/50 focus:outline-hidden",
              "disabled:pointer-events-none",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            )}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left p-6 pb-4",
        "border-b border-cyan-500/20",
        "bg-gradient-to-r from-cyan-500/5 via-transparent to-pink-500/5",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end p-6 pt-4",
        "border-t border-cyan-500/20",
        "bg-gradient-to-r from-cyan-500/5 via-transparent to-pink-500/5",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-none font-bold tracking-wide",
        "drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm leading-relaxed mt-1", className)}
      {...props}
    />
  )
}

// Dialog Body - new component for content area
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("p-6", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
