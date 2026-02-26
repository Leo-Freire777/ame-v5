import React from "react";

export const Topbar = () => {
  return (
    <div className="fixed top-0 left-64 right-0 h-16 bg-surface border-b border-border flex items-center justify-center z-40">
      <span className="text-2xl font-black tracking-widest text-white select-none">
        AME
      </span>
    </div>
  );
};