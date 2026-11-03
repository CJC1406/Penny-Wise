import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Account = {
  id: number;
  name: string;
  type: string;
  balance: number;
};

const initialAccounts: Account[] = [
  { id: 1, name: 'Savings Account', type: 'Bank Account', balance: 18000 },
  { id: 2, name: 'Cash Wallet', type: 'Cash', balance: 2500 },
  { id: 3, name: 'Checking Account', type: 'Current Account', balance: 4000 },
];

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Bank Account');
  const [balance, setBalance] = useState('');

  const totalBalance = accounts.reduce(
    (total, account) => total + account.balance,
    0
  );

  const addAccount = () => {
    const amount = Number(balance);

    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter an account name.');
      return;
    }

    if (!balance.trim() || !Number.isFinite(amount) || amount < 0) {
      Alert.alert('Invalid balance', 'Enter a valid balance of 0 or more.');
      return;
    }

    setAccounts([
      ...accounts,
      {
        id: Date.now(),
        name: name.trim(),
        type,
        balance: amount,
      },
    ]);

    setName('');
    setBalance('');
    setType('Bank Account');
    setShowForm(false);
  };

  const formatMoney = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7F5" />
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
        <View style={styles.accountCard} key={account.id}>
          <View style={styles.accountIcon}>
            <Text style={styles.accountIconText}>
              {account.type === 'Cash' ? '₹' : account.type === 'Current Account' ? 'C' : 'S'}
            </Text>
          </View>

          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountType}>{account.type}</Text>
          </View>

          <Text style={styles.accountBalance}>
            {formatMoney(account.balance)}
          </Text>
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

          <Text style={styles.fieldLabel}>Current balance (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter balance"
            placeholderTextColor="#A0AAA3"
            keyboardType="decimal-pad"
            value={balance}
            onChangeText={setBalance}
          />

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
