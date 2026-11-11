import React, { useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getCurrentUser, logoutUser } from '@/services/api';

type Profile = { FullName: string; Username: string; Email: string; Phone?: string };

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { getCurrentUser().then(setProfile).catch(() => Alert.alert('Error', 'Unable to load your profile.')); }, []);
  function logout() { logoutUser(); router.replace('/login'); }
  return <SafeAreaView style={styles.page}><View style={styles.header}><Text style={styles.title}>My profile</Text><Button title="Back" onPress={() => router.back()} /></View><View style={styles.card}><View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.FullName || profile?.Username || 'U').charAt(0).toUpperCase()}</Text></View><Text style={styles.name}>{profile?.FullName || 'Loading…'}</Text><Text style={styles.item}>Username: {profile?.Username || '—'}</Text><Text style={styles.item}>Email: {profile?.Email || '—'}</Text>{profile?.Phone ? <Text style={styles.item}>Phone: {profile.Phone}</Text> : null}</View><View style={styles.logout}><Button title="Log out" color="#B42318" onPress={logout} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#F5F7F5',padding:22}, header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:24}, title:{fontSize:28,fontWeight:'800',color:'#25332A'}, card:{backgroundColor:'#FFF',borderRadius:20,padding:24,alignItems:'center'}, avatar:{width:76,height:76,borderRadius:38,backgroundColor:'#DCEBE0',alignItems:'center',justifyContent:'center',marginBottom:16}, avatarText:{fontSize:30,fontWeight:'800',color:'#176B45'}, name:{fontSize:22,fontWeight:'800',color:'#25332A',marginBottom:18}, item:{alignSelf:'stretch',fontSize:15,color:'#526158',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#EEF1EE'}, logout:{marginTop:24} });
