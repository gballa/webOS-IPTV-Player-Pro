import React from 'react';
import { AppTab } from '../../types/iptv';

interface BottomPageDockProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenQuickSwitcher: () => void;
}

export const BottomPageDock: React.FC<BottomPageDockProps> = () => {
  return null;
};
