import React, { useEffect, useState } from 'react';
import { createAccount, getAccounts, type Account } from '@/services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Bank Account');
  const refreshAccounts = React.useCallback(() => { getAccounts().then(setAccounts).catch(() => Alert.alert('Error', 'Unable to load accounts.')); }, []);
  useFocusEffect(React.useCallback(() => { refreshAccounts(); }, [refreshAccounts]));

  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.Balance || 0),
    0
  );

  const addAccount = () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter an account name.');
      return;
    }

    createAccount({ AccountName: name.trim(), AccountType: type }).then((result: any) => { setAccounts(current => [...current, result.account]); setName(''); setType('Bank Account'); setShowForm(false); }).catch((e) => Alert.alert('Error', e.message));
  };

  const formatMoney = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>My Accounts</Text>
          <Text style={styles.subtitle}>Manage your money in one place</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>C</Text>
        </View>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL ACCOUNT BALANCE</Text>
        <Text style={styles.totalAmount}>{formatMoney(totalBalance)}</Text>
        <Text style={styles.totalNote}>
          Across {accounts.length} accounts
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your accounts</Text>
        <Text style={styles.count}>{accounts.length} accounts</Text>
      </View>

      {accounts.map((account, index) => (
        <View style={styles.accountCard} key={account.AccountID}>
          <View style={styles.accountIcon}>
            <Text style={styles.accountIconText}>
              {account.AccountType === 'Cash' ? '₹' : account.AccountType === 'Current Account' ? 'C' : 'S'}
            </Text>
          </View>

          <View style={styles.accountDetails}>
          <Text style={styles.accountName}>{account.AccountName}</Text>
            <Text style={styles.accountType}>{account.AccountType}</Text>
          </View>

          <Text style={styles.accountBalance}>
            {formatMoney(Number(account.Balance))}
          </Text>
          <TouchableOpacity onPress={() => router.push('/explore?type=income')}>
            <Text style={styles.addMoney}>Add income</Text>
          </TouchableOpacity>
        </View>
      ))}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Add new account</Text>

          <Text style={styles.fieldLabel}>Account name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. College Savings"
            placeholderTextColor="#A0AAA3"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.fieldLabel}>Account type</Text>
          <View style={styles.typeRow}>
            {['Bank Account', 'Cash', 'Current Account'].map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.typeButton, type === item && styles.typeSelected]}
                onPress={() => setType(item)}
              >
                <Text style={[styles.typeText, type === item && styles.typeTextSelected]}>
                  {item === 'Bank Account' ? 'Bank' : item === 'Current Account' ? 'Current' : 'Cash'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Opening balance</Text>
          <Text style={styles.accountType}>New accounts always start at ₹0.00. Record income to add money.</Text>

          <TouchableOpacity style={styles.saveButton} onPress={addAccount}>
            <Text style={styles.saveText}>Save account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowForm(false)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.addButtonText}>
          {showForm ? 'Close form' : '+ Add account'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        PennyWise • Your money, organised
      </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7F5' },
  screen: { flex: 1, backgroundColor: '#F5F7F5' },
  content: { padding: 20, paddingTop: 18, paddingBottom: 35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  heading: { fontSize: 25, fontWeight: '800', color: '#25332A' },
  subtitle: { fontSize: 12, color: '#89958E', marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#DCEBE0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#176B45', fontSize: 17, fontWeight: '800' },
  totalCard: { backgroundColor: '#176B45', borderRadius: 21, padding: 23, marginBottom: 28 },
  totalLabel: { color: '#D6E9DC', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  totalAmount: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 12 },
  totalNote: { color: '#D6E9DC', fontSize: 12, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: '#25332A', fontSize: 17, fontWeight: '800' },
  count: { color: '#89958E', fontSize: 11 },
  accountCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, marginBottom: 11, flexDirection: 'row', alignItems: 'center' },
  accountIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },
  accountIconText: { color: '#176B45', fontSize: 17, fontWeight: '800' },
  accountDetails: { flex: 1, marginLeft: 12 },
  accountName: { color: '#25332A', fontSize: 13, fontWeight: '700' },
  accountType: { color: '#89958E', fontSize: 10, marginTop: 5 },
  accountBalance: { color: '#25332A', fontSize: 13, fontWeight: '700' },
  addMoney: { color: '#176B45', fontSize: 11, fontWeight: '700', marginTop: 5 },
  addButton: { backgroundColor: '#176B45', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginTop: 12 },
  formTitle: { color: '#25332A', fontSize: 17, fontWeight: '800', marginBottom: 17 },
  fieldLabel: { color: '#526158', fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 10 },
  input: { backgroundColor: '#F5F7F5', borderRadius: 11, padding: 13, color: '#25332A', fontSize: 13 },
  typeRow: { flexDirection: 'row', gap: 7 },
  typeButton: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F5F7F5', alignItems: 'center' },
  typeSelected: { backgroundColor: '#DCEBE0' },
  typeText: { color: '#68766D', fontSize: 11, fontWeight: '600' },
  typeTextSelected: { color: '#176B45', fontWeight: '800' },
  saveButton: { backgroundColor: '#176B45', padding: 14, borderRadius: 11, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#68766D', fontSize: 13, fontWeight: '600' },
  footer: { color: '#A0AAA3', fontSize: 11, textAlign: 'center', marginTop: 25 },
});
