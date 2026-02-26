import React from "react";

export function LoginLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-start ${className}`}>
      <img
        src="/icons/logo-login.svg"
        alt="AME"
        className="mt-1 w-64 md:w-76 h-auto object-contain select-none"
        draggable={false}
      />
    </div>
  );
}

export function SidebarLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/icons/logo-sidebar.png"
        alt="AME"
        className="w-50 h-auto object-contain select-none"
        draggable={false}
      />
    </div>
  );
}