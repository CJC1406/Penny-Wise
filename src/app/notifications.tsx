import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNotifications, markNotificationRead, Notification } from '@/services/api';

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setItems(await getNotifications()); } catch (e) { Alert.alert('Notifications unavailable', e instanceof Error ? e.message : 'Try again.'); } finally { setRefreshing(false); } }, []);
  React.useEffect(() => { const handle = setTimeout(load, 0); return () => clearTimeout(handle); }, [load]);
  const read = async (item: Notification) => { if (item.IsRead) return; try { await markNotificationRead(item.NotificationID); setItems((current) => current.map((entry) => entry.NotificationID === item.NotificationID ? { ...entry, IsRead: true } : entry)); } catch { /* keep the notification visible */ } };
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Text style={styles.title}>Notifications</Text><Text style={styles.subtitle}>Budget alerts and account activity</Text></View><FlatList data={items} keyExtractor={(item) => String(item.NotificationID)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={items.length ? styles.list : styles.empty} ListEmptyComponent={<Text style={styles.emptyText}>You’re all caught up.</Text>} renderItem={({ item }) => <TouchableOpacity style={[styles.card, !item.IsRead && styles.unread]} onPress={() => read(item)}><View style={styles.row}><Text style={styles.type}>{item.NotificationType.replaceAll('_', ' ')}</Text>{!item.IsRead && <View style={styles.dot} />}</View><Text style={styles.message}>{item.Message}</Text>{item.CreatedAt && <Text style={styles.date}>{new Date(item.CreatedAt).toLocaleString()}</Text>}</TouchableOpacity>} /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F7F5' }, header: { padding: 24, paddingTop: 36 }, title: { color: '#25332A', fontSize: 26, fontWeight: '800' }, subtitle: { color: '#89958E', marginTop: 5 }, list: { padding: 20, paddingTop: 0 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#89958E' }, card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12 }, unread: { borderLeftWidth: 4, borderLeftColor: '#268653' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, type: { color: '#268653', fontSize: 12, fontWeight: '800' }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D69A36' }, message: { color: '#25332A', fontSize: 15, marginTop: 8, lineHeight: 21 }, date: { color: '#89958E', fontSize: 11, marginTop: 10 } });
