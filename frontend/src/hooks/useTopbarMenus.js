/**
 * Custom hook encapsulating Topbar dropdown, mobile drawer, body-scroll lock,
 * outside-click dismissal, and Escape-key closing behavior.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Manages Topbar navigation menu state and DOM dismissal listeners.
 * @returns {{
 *   isMobileMenuOpen: boolean,
 *   isUserDropdownOpen: boolean,
 *   isMoreDropdownOpen: boolean,
 *   userDropdownRef: React.RefObject<HTMLDivElement|null>,
 *   moreDropdownRef: React.RefObject<HTMLDivElement|null>,
 *   closeAllMenus: () => void,
 *   toggleMoreDropdown: (e: React.MouseEvent) => void,
 *   toggleUserDropdown: (e: React.MouseEvent) => void,
 *   toggleMobileMenu: () => void,
 * }} Menu state and interaction callbacks.
 */
export function useTopbarMenus() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);

  const closeAllMenus = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
    setIsMoreDropdownOpen(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target)) {
        setIsMoreDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeAllMenus();
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAllMenus]);

  const toggleMoreDropdown = useCallback((e) => {
    e.stopPropagation();
    setIsMoreDropdownOpen((prev) => !prev);
    setIsUserDropdownOpen(false);
  }, []);

  const toggleUserDropdown = useCallback((e) => {
    e.stopPropagation();
    setIsUserDropdownOpen((prev) => !prev);
    setIsMoreDropdownOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return {
    isMobileMenuOpen,
    isUserDropdownOpen,
    isMoreDropdownOpen,
    userDropdownRef,
    moreDropdownRef,
    closeAllMenus,
    toggleMoreDropdown,
    toggleUserDropdown,
    toggleMobileMenu,
  };
}
