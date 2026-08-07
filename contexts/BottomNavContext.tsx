import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BottomNavContextType {
    isVisible: boolean;
    hide: () => void;
    show: () => void;
}

const BottomNavContext = createContext<BottomNavContextType | undefined>(undefined);

export function BottomNavProvider({ children }: { children: ReactNode }) {
    const [isVisible, setIsVisible] = useState(true);

    const hide = () => setIsVisible(false);
    const show = () => setIsVisible(true);

    return (
        <BottomNavContext.Provider value={{ isVisible, hide, show }}>
            {children}
        </BottomNavContext.Provider>
    );
}

export function useBottomNav() {
    const context = useContext(BottomNavContext);
    if (context === undefined) {
        throw new Error('useBottomNav must be used within a BottomNavProvider');
    }
    return context;
}
