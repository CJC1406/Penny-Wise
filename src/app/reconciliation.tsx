import React, { useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getReconciliation } from '@/services/api';

export default function ReconciliationScreen() {
  const month = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { getReconciliation(month).then(setRows).catch((e) => Alert.alert('Reconciliation unavailable', e instanceof Error ? e.message : 'Apply the database migrations first.')); }, [month]);
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Text style={styles.title}>Monthly reconciliation</Text><Button title="Back" onPress={() => router.back()} /></View><Text style={styles.subtitle}>{month}</Text>{rows.map((row) => <View style={styles.card} key={row.AccountID}><Text style={styles.name}>{row.AccountName}</Text><Text>Expected: ₹{Number(row.ExpectedBalance).toLocaleString('en-IN')}</Text><Text>Actual: ₹{Number(row.ActualBalance).toLocaleString('en-IN')}</Text><Text style={[styles.difference, Number(row.Difference) === 0 ? styles.ok : styles.warning]}>Difference: ₹{Number(row.Difference).toLocaleString('en-IN')}</Text></View>)}{rows.length === 0 && <Text style={styles.empty}>No accounts to reconcile.</Text>}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#F5F7F5'},content:{padding:22},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:25,fontWeight:'800',color:'#25332A'},subtitle:{color:'#68766D',marginVertical:14},card:{backgroundColor:'#FFF',borderRadius:16,padding:18,marginBottom:12,gap:6},name:{fontSize:17,fontWeight:'800',color:'#25332A'},difference:{fontWeight:'800'},ok:{color:'#176B45'},warning:{color:'#B42318'},empty:{color:'#68766D',textAlign:'center',marginTop:30}});
