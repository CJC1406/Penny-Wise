import AppTabs from '@/components/app-tabs';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { restoreAuthToken } from '@/services/api';
import { ActivityIndicator, View } from 'react-native';

export default function TabsLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => { restoreAuthToken().then((token) => { if (!token) router.replace('/login'); setReady(true); }); }, []);
  if (!ready) return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator /></View>;
  return <AppTabs />;
}
