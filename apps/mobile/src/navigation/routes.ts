import { MobileRole } from '../auth/route-guard.js';

export interface RouteItem {
  id: string;
  title: string;
  path: string;
  icon: string;
  allowedRoles: MobileRole[];
}

export const STUDENT_NAVIGATION_ROUTES: RouteItem[] = [
  {
    id: 'student-map',
    title: 'Live Tracking',
    path: '/(student)/map',
    icon: 'map-pin',
    allowedRoles: ['STU'],
  },
  {
    id: 'student-scan',
    title: 'Boarding Scan',
    path: '/(student)/scan',
    icon: 'qr-code',
    allowedRoles: ['STU'],
  },
  {
    id: 'student-requests',
    title: 'Leaves & Requests',
    path: '/(student)/requests',
    icon: 'file-text',
    allowedRoles: ['STU'],
  },
  {
    id: 'student-profile',
    title: 'Profile',
    path: '/(student)/profile',
    icon: 'user',
    allowedRoles: ['STU'],
  },
];

export const FACULTY_NAVIGATION_ROUTES: RouteItem[] = [
  {
    id: 'faculty-map',
    title: 'Bus Tracking',
    path: '/(faculty)/map',
    icon: 'map-pin',
    allowedRoles: ['FAC'],
  },
  {
    id: 'faculty-manifest',
    title: 'Student Manifest',
    path: '/(faculty)/manifest',
    icon: 'users',
    allowedRoles: ['FAC'],
  },
  {
    id: 'faculty-calls',
    title: 'Contact Driver',
    path: '/(faculty)/calls',
    icon: 'phone',
    allowedRoles: ['FAC'],
  },
  {
    id: 'faculty-profile',
    title: 'Profile',
    path: '/(faculty)/profile',
    icon: 'user',
    allowedRoles: ['FAC'],
  },
];

export function getRoutesForRole(role: MobileRole): RouteItem[] {
  if (role === 'STU') return STUDENT_NAVIGATION_ROUTES;
  if (role === 'FAC') return FACULTY_NAVIGATION_ROUTES;
  return [];
}
