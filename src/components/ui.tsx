"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "@/lib/mobile";
import { X, LoaderCircle } from "lucide-react";
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
    >
      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
    </svg>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-hidden="true" />;
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dragged = useRef(false);
  const drag = useRef<{ y: number; time: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <button
          type="button"
          className="sheet-grabber mobile-only"
          aria-label={`Dismiss ${title}`}
          onClick={() => {
            if (!dragged.current) onClose();
            dragged.current = false;
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            dragged.current = false;
            drag.current = { y: e.clientY, time: performance.now() };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current || !ref.current) return;
            ref.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current.y)}px)`;
          }}
          onPointerUp={(e) => {
            if (!drag.current) return;
            const distance = e.clientY - drag.current.y;
            const speed =
              distance / Math.max(1, performance.now() - drag.current.time);
            drag.current = null;
            dragged.current = Math.abs(distance) > 8;
            if (ref.current) ref.current.style.transform = "";
            if (distance > 80 || (distance > 25 && speed > 0.5)) onClose();
            // A drag is not a tap on the dismiss button.
            if (Math.abs(distance) > 8) e.preventDefault();
          }}
          onPointerCancel={() => {
            drag.current = null;
            if (ref.current) ref.current.style.transform = "";
          }}
        >
          <span />
        </button>
        <div className="modal-header">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export function ActionMenu({
  title,
  className,
  onClose,
  children,
}: {
  title: string;
  className: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const mobile = useMobile();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mobile) return;
    const previous = document.activeElement;
    ref.current
      ?.querySelector<HTMLElement>("button, select")
      ?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [mobile]);
  if (mobile)
    return (
      <Modal title={title} onClose={onClose} className="action-sheet">
        <div className={`sheet-actions ${className}`}>{children}</div>
      </Modal>
    );
  return (
    <>
      <button
        type="button"
        className="menu-dismiss"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
      />
      <div
        ref={ref}
        className={`popover ${className}`}
        role="dialog"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
