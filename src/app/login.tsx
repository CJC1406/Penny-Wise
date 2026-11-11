import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { loginUser, registerUser } from "@/services/api";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!username.trim() || !password || (registering && (!email.trim() || !fullName.trim()))) return Alert.alert("Missing details", registering ? "Enter your name, email, username, and password." : "Enter your username and password.");
    setBusy(true);
    try {
      if (registering) {
        await registerUser({ Username: username.trim(), Email: email.trim(), FullName: fullName.trim(), Password: password });
        await loginUser(username.trim(), password);
      } else await loginUser(username.trim(), password);
      router.replace("/(tabs)");
    }
    catch (e) { Alert.alert("Login failed", e instanceof Error ? e.message : "Try again."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.title}>{registering ? "Create your PennyWise account" : "Welcome to PennyWise"}</Text><Text style={styles.subtitle}>{registering ? "Your new account starts with no financial accounts and ₹0 balance." : "Sign in to manage your money"}</Text>{registering && <><TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName}/><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail}/></>}<TextInput style={styles.input} autoCapitalize="none" placeholder="Username" value={username} onChangeText={setUsername}/><TextInput style={styles.input} secureTextEntry placeholder="Password (8+ characters)" value={password} onChangeText={setPassword}/><TouchableOpacity style={[styles.primaryButton, busy && styles.disabledButton]} onPress={submit} disabled={busy}><Text style={styles.primaryText}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => setRegistering((value) => !value)}><Text style={styles.secondaryText}>{registering ? "I already have an account" : "Create a new account"}</Text></TouchableOpacity></View></SafeAreaView>;
}
const styles = StyleSheet.create({ page:{flex:1,justifyContent:"center",padding:24,backgroundColor:"#F5F7F5"}, card:{backgroundColor:"white",padding:24,borderRadius:20,gap:14}, title:{fontSize:26,fontWeight:"800",color:"#176B45"}, subtitle:{color:"#68766D",marginBottom:10}, input:{backgroundColor:"#F1F4F1",padding:14,borderRadius:10}, primaryButton:{alignSelf:'center',minWidth:150,paddingVertical:13,paddingHorizontal:24,borderRadius:28,backgroundColor:'#176B45',alignItems:'center',marginTop:4}, disabledButton:{opacity:0.6}, primaryText:{color:'#FFF',fontWeight:'800',fontSize:15}, secondaryButton:{alignSelf:'center',paddingVertical:9,paddingHorizontal:16,borderRadius:22}, secondaryText:{color:'#176B45',fontWeight:'700',fontSize:13} });
