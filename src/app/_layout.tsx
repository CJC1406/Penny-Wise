
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  Stack,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();
export const unstable_settings = {
  initialRouteName: 'login',
};
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <AnimatedSplashOverlay />

        <Stack
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="reconciliation" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="search" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
