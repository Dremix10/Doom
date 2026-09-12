// Auth gate at "/": route to the app or to onboarding. Keeps the tab home ("/you")
// and onboarding ("/onboarding") from colliding on the same URL.
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { me } = useAuth();
  return <Redirect href={me ? '/leaderboard' : '/onboarding'} />;
}
