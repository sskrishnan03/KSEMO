
export const EmailLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#EA4335"/>
    <rect x="4" y="8" width="32" height="24" rx="4" fill="white"/>
    <path d="M4 12L20 22L36 12" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 32L14 22L20 26L26 22L36 32" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 12V32H36V12" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CalendarLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#4285F4"/>
    <rect x="6" y="10" width="28" height="24" rx="4" fill="white"/>
    <rect x="6" y="10" width="28" height="6" rx="2" fill="#4285F4"/>
    <circle cx="12" cy="7" r="2" fill="#4285F4"/>
    <circle cx="28" cy="7" r="2" fill="#4285F4"/>
    <rect x="10" y="20" width="4" height="4" rx="1" fill="#4285F4" fillOpacity="0.3"/>
    <rect x="18" y="20" width="4" height="4" rx="1" fill="#4285F4" fillOpacity="0.3"/>
    <rect x="26" y="20" width="4" height="4" rx="1" fill="#4285F4" fillOpacity="0.3"/>
    <rect x="10" y="28" width="4" height="4" rx="1" fill="#4285F4" fillOpacity="0.3"/>
    <rect x="18" y="28" width="4" height="4" rx="1" fill="#4285F4" fillOpacity="0.3"/>
  </svg>
);

export const TasksLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#673AB7"/>
    <rect x="6" y="8" width="28" height="8" rx="4" fill="white"/>
    <rect x="6" y="20" width="28" height="8" rx="4" fill="white" fillOpacity="0.6"/>
    <rect x="6" y="32" width="28" height="8" rx="4" fill="white" fillOpacity="0.3"/>
    <circle cx="32" cy="12" r="3" fill="#673AB7"/>
    <path d="M31 12L31.5 12.5L33 11" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const NotesLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#F4B400"/>
    <rect x="8" y="6" width="24" height="28" rx="2" fill="white"/>
    <rect x="12" y="10" width="16" height="2" rx="1" fill="#F4B400" fillOpacity="0.4"/>
    <rect x="12" y="15" width="16" height="2" rx="1" fill="#F4B400" fillOpacity="0.4"/>
    <rect x="12" y="20" width="12" height="2" rx="1" fill="#F4B400" fillOpacity="0.4"/>
    <rect x="12" y="25" width="14" height="2" rx="1" fill="#F4B400" fillOpacity="0.4"/>
    <path d="M24 30L32 22" stroke="#F4B400" strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 30V22H24" stroke="#F4B400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const WeatherLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#03A9F4"/>
    <circle cx="16" cy="20" r="8" fill="#FFC107"/>
    <circle cx="16" cy="20" r="6" fill="#FFC107"/>
    <path d="M16 8V10M16 30V32M8 20H10M22 20H24M10 14L11.5 15.5M20.5 24.5L22 26M10 26L11.5 24.5M20.5 15.5L22 14" stroke="#FFC107" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 24C22 24 24 22 26 22C29 22 31 24 31 27C31 30 28 32 26 32H18C16 32 15 31 15 30C15 28 17 27 18 26C18 25 19 24 22 24Z" fill="white" fillOpacity="0.9"/>
  </svg>
);

export const NewsLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#FF5722"/>
    <rect x="6" y="8" width="28" height="24" rx="2" fill="white"/>
    <rect x="8" y="10" width="12" height="10" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <rect x="8" y="22" width="24" height="2" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <rect x="8" y="26" width="20" height="2" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <rect x="22" y="10" width="10" height="2" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <rect x="22" y="14" width="8" height="2" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <rect x="22" y="18" width="6" height="2" rx="1" fill="#FF5722" fillOpacity="0.2"/>
    <circle cx="32" cy="32" r="4" fill="#FF5722"/>
    <path d="M30 32L31.5 33.5L34 31" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CalculatorLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#E91E63"/>
    <rect x="8" y="6" width="24" height="28" rx="4" fill="white"/>
    <rect x="10" y="8" width="20" height="8" rx="2" fill="#E91E63" fillOpacity="0.15"/>
    <circle cx="14" cy="12" r="1.5" fill="#E91E63"/>
    <circle cx="20" cy="12" r="1.5" fill="#E91E63"/>
    <circle cx="26" cy="12" r="1.5" fill="#E91E63"/>
    <rect x="10" y="20" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
    <rect x="18" y="20" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
    <rect x="26" y="20" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
    <rect x="10" y="26" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
    <rect x="18" y="26" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
    <rect x="26" y="26" width="6" height="4" rx="1" fill="#E91E63" fillOpacity="0.2"/>
  </svg>
);

export const TimerLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#F44336"/>
    <circle cx="20" cy="22" r="12" fill="white"/>
    <circle cx="20" cy="22" r="10" stroke="#F44336" strokeWidth="2" fill="none"/>
    <path d="M20 22V16" stroke="#F44336" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 22L24 26" stroke="#F44336" strokeWidth="2" strokeLinecap="round"/>
    <rect x="18" y="6" width="4" height="4" rx="1" fill="white"/>
    <circle cx="20" cy="22" r="2" fill="#F44336"/>
  </svg>
);

export const WebSearchLogo = ({ size = 40, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#4285F4"/>
    <circle cx="18" cy="18" r="8" stroke="white" strokeWidth="3" fill="none"/>
    <circle cx="18" cy="18" r="3" fill="white"/>
    <path d="M24 24L30 30" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <path d="M12 14L14 16M22 16L24 14M14 22L12 24M22 22L24 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="28" cy="12" r="3" fill="#34A853"/>
    <circle cx="32" cy="16" r="3" fill="#EA4335"/>
    <circle cx="30" cy="20" r="3" fill="#F4B400"/>
  </svg>
);
