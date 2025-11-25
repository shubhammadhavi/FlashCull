import React from 'react';

export const Logo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      {/* A professional gradient: Deep Blue/Purple to Cyan */}
      <linearGradient id="shutterGradient" x1="0" y1="0" x2="100" y2="100">
        <stop offset="0%" stopColor="#3B82F6" /> {/* Blue-500 */}
        <stop offset="100%" stopColor="#8B5CF6" /> {/* Violet-500 */}
      </linearGradient>
      
      {/* Subtle inner shadow/glow for depth */}
      <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="1" k3="-0.5"/>
      </filter>
    </defs>

    {/* The Lens/Shutter Ring */}
    <circle 
      cx="50" cy="50" r="42" 
      stroke="url(#shutterGradient)" 
      strokeWidth="8"
      fill="none"
    />

    {/* The Aperture Blades forming a lightning-like zigzag in the center */}
    <path
      d="
        M 50 20 
        L 65 45 
        L 50 50 
        L 35 45 
        Z
      "
      fill="url(#shutterGradient)"
      transform="rotate(0 50 50)"
      opacity="0.9"
    />
    <path
      d="
        M 50 20 
        L 65 45 
        L 50 50 
        L 35 45 
        Z
      "
      fill="url(#shutterGradient)"
      transform="rotate(72 50 50)"
      opacity="0.8"
    />
    <path
      d="
        M 50 20 
        L 65 45 
        L 50 50 
        L 35 45 
        Z
      "
      fill="url(#shutterGradient)"
      transform="rotate(144 50 50)"
      opacity="0.7"
    />
    <path
      d="
        M 50 20 
        L 65 45 
        L 50 50 
        L 35 45 
        Z
      "
      fill="url(#shutterGradient)"
      transform="rotate(216 50 50)"
      opacity="0.8"
    />
    <path
      d="
        M 50 20 
        L 65 45 
        L 50 50 
        L 35 45 
        Z
      "
      fill="url(#shutterGradient)"
      transform="rotate(288 50 50)"
      opacity="0.9"
    />

    {/* Central 'Flash' or 'Focus' point - negative space */}
    <circle cx="50" cy="50" r="5" fill="#0f0f0f" /> 
  </svg>
);