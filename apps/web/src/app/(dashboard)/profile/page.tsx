// Rendering: Client page — user profile editor, protected

import type { Metadata } from 'next';
import { ProfileEditor } from './profile-editor';

export const metadata: Metadata = {
  title: 'Profile',
};

export default function ProfilePage() {
  return <ProfileEditor />;
}
